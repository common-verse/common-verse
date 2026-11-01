import type { Locale } from "@poetry/i18n";
import type { Product, ShopSettings } from "@poetry/types";
import { type } from "arktype";
import * as m from "../paraglide/messages.js";
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
      email.allows(data.email)
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
/** Form order; the browser focuses the first invalid field. */
export const checkoutFields = ["email", ...addressFields, "country"] as const;

export type CheckoutField = (typeof checkoutFields)[number];
export type CheckoutValues = Record<CheckoutField, string>;
export type CheckoutError = "required" | "invalid";
export interface ShippingAddress
  extends Partial<Record<(typeof addressFields)[number], string>> {
  country: "DE";
}

export type CheckoutResult =
  | { ok: true; email: string; address: ShippingAddress }
  | {
      ok: false;
      values: Partial<CheckoutValues>;
      errors: Partial<Record<CheckoutField, CheckoutError>>;
      tooLong: boolean;
    };

const email = type(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).and("string <= 254");
const filled = type("string > 0");

const shippingAddress = (values: CheckoutValues): ShippingAddress => {
  const address: ShippingAddress = { country: "DE" };
  for (const field of addressFields)
    if (values[field]) address[field] = values[field];
  return address;
};

/** Shared by the server and the browser; shipping is limited to Germany. */
export const checkoutSchema = type({
  email,
  firstName: filled,
  lastName: filled,
  company: "string",
  addressLine1: filled,
  addressLine2: "string",
  postalCode: /^\d{5}$/,
  city: filled,
  country: "'DE'",
});

export const checkoutValues = (
  read: (name: CheckoutField) => unknown,
): CheckoutValues =>
  Object.fromEntries(
    checkoutFields.map((field) => {
      const value = read(field);
      return [field, typeof value === "string" ? value.trim() : ""];
    }),
  ) as CheckoutValues;

/**
 * An empty required field is missing; anything else the schema rejects is invalid.
 * The address length is checked beside the schema, so it is reported together with field errors.
 */
export function checkoutProblems(values: CheckoutValues) {
  const errors: Partial<Record<CheckoutField, CheckoutError>> = {};
  const result = checkoutSchema(values);
  if (result instanceof type.errors)
    for (const { path } of result) {
      const field = path[0] as CheckoutField;
      errors[field] =
        !values[field] && field !== "country" ? "required" : "invalid";
    }
  const tooLong =
    JSON.stringify(shippingAddress(values)).length >= maxAddressLength;
  return { errors, tooLong };
}

const invalidMessages: Partial<
  Record<CheckoutField, (inputs: {}, options: { locale: Locale }) => string>
> = {
  email: m.shop_error_email,
  postalCode: m.shop_error_postal_code,
  country: m.shop_error_country,
};

/** Every message a field can show, so its reserved line fits the longest one. */
export function fieldMessages(field: CheckoutField, locale: Locale) {
  const messages: Partial<Record<CheckoutError, string>> = {};
  if (field !== "country" && !optionalFields.has(field))
    messages.required = m.shop_error_required({}, { locale });
  const invalid = invalidMessages[field];
  if (invalid) messages.invalid = invalid({}, { locale });
  return messages;
}

export function parseCheckout(form: FormData): CheckoutResult {
  const values = checkoutValues((name) => form.get(name));
  const { errors, tooLong } = checkoutProblems(values);
  if (Object.keys(errors).length || tooLong)
    return { ok: false, values, errors, tooLong };
  return { ok: true, email: values.email, address: shippingAddress(values) };
}
