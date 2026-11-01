import type { Locale } from "@poetry/i18n";
import { type } from "arktype";
import * as m from "../paraglide/messages.js";

// Kept apart from shop.ts: ArkType is large, and only the checkout needs it in the browser.

/** Stripe metadata values hold at most 500 characters. */
const maxAddressLength = 500;

export interface CheckoutAccess {
  paymentIntentID: string;
  clientSecret: string;
  email: string;
  address: ShippingAddress;
  /** Cart contents the payment was started for; see cartSignature. */
  cart: string;
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
