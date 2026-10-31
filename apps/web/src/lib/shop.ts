import type { Locale } from "@poetry/i18n";
import type { Product, ShopSettings } from "@poetry/types";
import { eventFormatLocale } from "./event-date";
import { contentDirection } from "./homepage";

export const maxQuantity = 10;
/** Stripe metadata values hold at most 500 characters; the cart snapshot fits seven lines. */
export const maxCartLines = 7;
const maxAddressLength = 500;

export const cartCookie = "poetry-cart";
export const checkoutCookie = "poetry-checkout";
export const orderCookie = "poetry-order";

export interface CartAccess {
  id: string;
  secret: string;
}

export interface CheckoutAccess {
  paymentIntentID: string;
  clientSecret: string;
  email: string;
  address: ShippingAddress;
  /** Cart contents the payment was started for; see cartSignature. */
  cart: string;
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

export const cartSignature = (lines: CartLine[]) =>
  lines.map((line) => `${relationID(line.product)}x${line.quantity}`).join(",");

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

export function decodeCheckout(
  value: string | undefined,
): CheckoutAccess | null {
  try {
    const data = JSON.parse(value ?? "");
    return typeof data?.paymentIntentID === "string" &&
      /^pi_\w+$/.test(data.paymentIntentID) &&
      typeof data.clientSecret === "string" &&
      typeof data.cart === "string" &&
      data.address?.country === "DE" &&
      typeof data.email === "string" &&
      isEmail(data.email)
      ? {
          paymentIntentID: data.paymentIntentID,
          clientSecret: data.clientSecret,
          email: data.email,
          address: data.address,
          cart: data.cart,
        }
      : null;
  } catch {
    return null;
  }
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

const isEmail = (value: string) =>
  value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const addressFields = [
  "firstName",
  "lastName",
  "company",
  "addressLine1",
  "addressLine2",
  "postalCode",
  "city",
] as const;
export const optionalFields = new Set<string>(["company", "addressLine2"]);

export type CheckoutField =
  | "email"
  | "country"
  | (typeof addressFields)[number];
export type CheckoutError = "required" | "invalid";
export interface ShippingAddress
  extends Partial<Record<(typeof addressFields)[number], string>> {
  country: "DE";
}

export type CheckoutResult =
  | { ok: true; email: string; address: ShippingAddress }
  | {
      ok: false;
      values: Partial<Record<CheckoutField, string>>;
      errors: Partial<Record<CheckoutField, CheckoutError>>;
      tooLong: boolean;
    };

/** Validates the guest checkout form; shipping is limited to Germany. */
export function parseCheckout(form: FormData): CheckoutResult {
  const text = (name: CheckoutField) => {
    const value = form.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const values: Partial<Record<CheckoutField, string>> = {};
  const errors: Partial<Record<CheckoutField, CheckoutError>> = {};
  const email = text("email");
  values.email = email;
  if (!email) errors.email = "required";
  else if (!isEmail(email)) errors.email = "invalid";
  const address: ShippingAddress = { country: "DE" };
  for (const field of addressFields) {
    const value = text(field);
    values[field] = value;
    if (value) address[field] = value;
    else if (!optionalFields.has(field)) errors[field] = "required";
  }
  if (address.postalCode && !/^\d{5}$/.test(address.postalCode))
    errors.postalCode = "invalid";
  if (text("country") !== "DE") errors.country = "invalid";
  const tooLong = JSON.stringify(address).length >= maxAddressLength;
  if (Object.keys(errors).length || tooLong)
    return { ok: false, values, errors, tooLong };
  return { ok: true, email, address };
}
