import type { Locale } from "@poetry/i18n";
import type { Product, ShopSettings } from "@poetry/types";
import { eventFormatLocale } from "./event-date";
import { contentDirection, mediaObject } from "./homepage";
import * as m from "../paraglide/messages.js";

export const maxQuantity = 10;
/** Stripe metadata values hold at most 500 characters; the cart snapshot fits seven lines. */
export const maxCartLines = 7;

export const cartCookie = "poetry-cart";
/** Number of copies, so pages can show the cart button without asking the CMS. */
export const cartCountCookie = "poetry-cart-count";
export const checkoutCookie = "poetry-checkout";
export const orderCookie = "poetry-order";

/** An email address as checkout and the status page accept it (the checkout also limits its length). */
export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CartAccess {
  id: string;
  secret: string;
}

export interface CartLine {
  id?: string;
  product?: Product | number | string | null;
  quantity: number;
}

export const formatNumber = (value: number, locale: Locale) =>
  new Intl.NumberFormat(eventFormatLocale(locale), {
    useGrouping: false,
  }).format(value);

export function formatPrice(cents: number, locale: Locale): string {
  return new Intl.NumberFormat(eventFormatLocale(locale), {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

/** Keeps a title's own direction inside a translated sentence, where markup like <bdi> cannot go. */
export const isolate = (text: string) => `\u2068${text}\u2069`;

/** Language, pages and year, for the shop list and the order summary. */
export function bookMeta(
  product: Pick<Product, "titleLanguage" | "pages" | "year">,
  locale: Locale,
) {
  const options = { locale };
  return [
    product.titleLanguage &&
      new Intl.DisplayNames([locale], { type: "language" }).of(
        product.titleLanguage,
      ),
    product.pages &&
      m.shop_book_pages(
        { count: formatNumber(product.pages, locale) },
        options,
      ),
    product.year && formatNumber(product.year, locale),
  ]
    .filter(Boolean)
    .join(m.shop_list_separator({}, options));
}

/** Book titles are not translated; declare the edition's own language. */
export const titleAttributes = ({
  titleLanguage,
}: Pick<Product, "titleLanguage">): {
  lang?: string;
  dir: "ltr" | "rtl" | "auto";
} =>
  titleLanguage
    ? { lang: titleLanguage, dir: contentDirection(titleLanguage) }
    : { dir: "auto" };

/** A book in the order summary of checkout, confirmation and status. */
export interface SummaryLine {
  id: string;
  title: string | null;
  titleLanguage: string | null;
  quantity: number;
  unitPrice?: number;
  total?: number;
  meta?: string;
  cover?: string | null;
}

/** `product` is null when the book was deleted since. */
export function summaryLine(
  id: string,
  product: Product | null,
  quantity: number,
  unitPrice: number,
  locale: Locale,
  cmsUrl: string,
): SummaryLine {
  const media = mediaObject(product?.image);
  return {
    id,
    title: product?.title ?? null,
    titleLanguage: product?.titleLanguage ?? null,
    quantity,
    unitPrice,
    total: unitPrice * quantity,
    meta: product ? bookMeta(product, locale) : undefined,
    cover: media?.url ? new URL(media.url, cmsUrl).href : null,
  };
}

/** Shop settings stay empty until an editor saves them; checkout needs a rate. */
export const shippingRate = (settings: Partial<ShopSettings>) =>
  typeof settings.shippingRate === "number" ? settings.shippingRate : null;

export const isSoldOut = (product: Pick<Product, "inventory">) =>
  typeof product.inventory === "number" && product.inventory <= 0;

/** The ecommerce plugin rejects a zero price as missing. */
export const isPurchasable = (
  product: Pick<Product, "inventory" | "priceInEUR">,
) => Boolean(product.priceInEUR) && !isSoldOut(product);

export const availableQuantity = (product: Pick<Product, "inventory">) =>
  Math.min(maxQuantity, product.inventory ?? maxQuantity);

/** Deleted products arrive unpopulated or as null. */
export const lineProduct = (line: CartLine) =>
  line.product && typeof line.product === "object" ? line.product : null;

export function isLineAvailable(line: CartLine) {
  const product = lineProduct(line);
  return Boolean(
    product &&
      isPurchasable(product) &&
      line.quantity <= availableQuantity(product),
  );
}

/** The CMS charges current prices, so totals come from the shown lines, not the stored subtotal. */
export const cartSubtotal = (lines: CartLine[]) =>
  lines.reduce(
    (sum, line) => sum + (lineProduct(line)?.priceInEUR ?? 0) * line.quantity,
    0,
  );

export const cartCount = (lines: CartLine[]) =>
  lines.reduce((sum, line) => sum + line.quantity, 0);

export const decodeCartCount = (value: string | undefined) =>
  /^\d{1,3}$/.test(value ?? "") ? Number(value) : 0;

export interface CartViewLine {
  id: string;
  product: string | null;
  title: string | null;
  titleLanguage: string | null;
  slug: string | null;
  cover: { url: string; width: number; height: number } | null;
  unitPrice: number;
  quantity: number;
  /** Highest quantity that can be ordered: 10, or the stock if lower; 0 when sold out or deleted. */
  max: number;
  /** Lower than 10 because of stock. */
  stockLimited: boolean;
  available: boolean;
}

export interface CartView {
  lines: CartViewLine[];
  subtotal: number;
  shipping: number | null;
  priceNote: string | null;
  count: number;
  checkout: "ready" | "payments-unavailable" | "blocked";
}

/** What the cart page and the drawer show; computed on the server, rendered in both. */
export function cartView(
  lines: (CartLine & { id: string })[],
  settings: Partial<ShopSettings>,
  paymentsConfigured: boolean,
  cmsUrl: string,
): CartView {
  const shipping = shippingRate(settings);
  return {
    lines: lines.map((line) => {
      const product = lineProduct(line);
      const media = mediaObject(product?.image);
      const max =
        product && isPurchasable(product) ? availableQuantity(product) : 0;
      return {
        id: line.id,
        product: relationID(line.product),
        title: product?.title ?? null,
        titleLanguage: product?.titleLanguage ?? null,
        slug: product?.slug ?? null,
        cover: media?.url
          ? {
              url: new URL(media.url, cmsUrl).href,
              width: media.width ?? 1,
              height: media.height ?? 1,
            }
          : null,
        unitPrice: product?.priceInEUR ?? 0,
        quantity: line.quantity,
        max,
        stockLimited: max > 0 && max < maxQuantity,
        available: isLineAvailable(line),
      };
    }),
    subtotal: cartSubtotal(lines),
    shipping,
    priceNote: settings.priceNote ?? null,
    count: cartCount(lines),
    checkout:
      shipping === null || !paymentsConfigured
        ? "payments-unavailable"
        : lines.every(isLineAvailable)
          ? "ready"
          : "blocked",
  };
}

/**
 * Books, quantities, current prices and shipping of a checkout. The page sends the key it
 * showed; a different key at payment start means the buyer would pay another amount.
 */
export const checkoutKey = (lines: CartLine[], shipping: number | null) =>
  `${lines
    .map(
      (line) =>
        `${relationID(line.product)}x${line.quantity}@${lineProduct(line)?.priceInEUR ?? 0}`,
    )
    .join(",")}+${shipping ?? "none"}`;

/**
 * Reads a checkout key back: the books, quantities and prices that were paid, and the shipping.
 * The key comes from a cookie, so it is split, not matched as a whole, and its size is capped.
 */
export function parseCheckoutKey(key: string) {
  const plus = key.lastIndexOf("+");
  const shipping = key.slice(plus + 1);
  const parts = key.slice(0, Math.max(plus, 0)).split(",").filter(Boolean);
  if (
    key.length > 1000 ||
    plus < 0 ||
    parts.length > maxCartLines ||
    !/^(\d{1,9}|none)$/.test(shipping)
  )
    return null;
  const lines = [];
  for (const part of parts) {
    const match = /^([\w-]{1,64})x(\d{1,2})@(\d{1,9})$/.exec(part);
    if (!match) return null;
    lines.push({
      product: match[1]!,
      quantity: Number(match[2]),
      unitPrice: Number(match[3]),
    });
  }
  return { lines, shipping: shipping === "none" ? null : Number(shipping) };
}

export function cookieOptions(secure: boolean, maxAge = 60 * 60 * 24 * 14) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge,
  } as const;
}

const identifier = /^[\w-]{1,64}$/;

export const encodeCart = ({ id, secret }: CartAccess) => `${id}.${secret}`;

export function decodeCart(value: string | undefined): CartAccess | null {
  const [id, secret, extra] = value?.split(".") ?? [];
  return identifier.test(id ?? "") &&
    /^[A-Za-z0-9]{16,128}$/.test(secret ?? "") &&
    extra === undefined
    ? { id: id!, secret: secret! }
    : null;
}

/** Payload relationships can be populated objects or bare IDs. */
export const relationID = (
  value: Product | number | string | null | undefined,
) =>
  value === null || value === undefined
    ? null
    : String(typeof value === "object" ? value.id : value);

export function parseIdentifier(value: FormDataEntryValue | null) {
  return typeof value === "string" && identifier.test(value) ? value : null;
}

export function parseQuantity(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^\d{1,2}$/.test(value)) return null;
  const quantity = Number(value);
  return quantity >= 1 && quantity <= maxQuantity ? quantity : null;
}
