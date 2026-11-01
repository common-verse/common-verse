import type { Locale } from "@poetry/i18n";
import type { OrderLookup, OrderLookupStatus } from "@poetry/types";
import { rateLimiter } from "./address";
import { type } from "arktype";
import { email } from "./checkout";
import { eventFormatLocale } from "./event-date";
import type { PaymentFacts } from "./payment";
import * as m from "../paraglide/messages.js";

/** Placeholder until the association names its shop address. */
export const shopEmail = "shop@thepoetryproject.de";

/** Reads what buyers type as the CMS does: any case, hyphens, spaces, and O, I or L for 0 and 1. */
export function normalizeCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  return /^[0-9A-HJKMNP-TV-Z]{8}$/.test(code) ? code : null;
}

/** `K7QD93FA` → `K7QD-93FA`. */
export const formatCode = (code: string) =>
  `${code.slice(0, 4)}-${code.slice(4)}`;

export const formatOrderDate = (date: string, locale: Locale) =>
  new Intl.DateTimeFormat(eventFormatLocale(locale), {
    dateStyle: "long",
    timeZone: "Europe/Berlin",
  }).format(new Date(date));

export type LookupField = "code" | "email";
export type LookupResult =
  | { ok: true; code: string; email: string }
  | {
      ok: false;
      values: Record<LookupField, string>;
      errors: Partial<Record<LookupField, "required" | "invalid">>;
    };

const lookupSchema = type({ code: "string", email });

/** The status form: a code the CMS can read and an email address. */
export function parseLookup(form: {
  get(name: string): unknown;
}): LookupResult {
  const values = Object.fromEntries(
    (["code", "email"] as const).map((field) => {
      const value = form.get(field);
      return [field, typeof value === "string" ? value.trim() : ""];
    }),
  ) as Record<LookupField, string>;
  const errors: Partial<Record<LookupField, "required" | "invalid">> = {};
  const code = normalizeCode(values.code);
  if (!code) errors.code = values.code ? "invalid" : "required";
  if (lookupSchema(values) instanceof type.errors)
    errors.email = values.email ? "invalid" : "required";
  return code && !errors.email
    ? { ok: true, code, email: values.email }
    : { ok: false, values, errors };
}

/** Five failed lookups per IP in 15 minutes; found orders do not count. */
export const lookupAttempts = rateLimiter(5, 15 * 60 * 1000);

/**
 * Asks `find` unless the client failed too often. Only a lookup that finds nothing counts:
 * codes and emails could otherwise be guessed (the proxy's limit stays the main protection).
 */
export async function limitedLookup(
  attempts: ReturnType<typeof rateLimiter>,
  client: string,
  find: () => Promise<OrderLookup | null>,
): Promise<
  { order: OrderLookup } | { problem: "not_found" | "too_many" | "unavailable" }
> {
  if (!attempts(client)) return { problem: "too_many" };
  try {
    const order = await find();
    if (!order) return { problem: "not_found" };
    attempts(client, Date.now(), -1);
    return { order };
  } catch (error) {
    console.error(error);
    attempts(client, Date.now(), -1);
    return { problem: "unavailable" };
  }
}

/**
 * What the confirmation page keeps in the httpOnly order cookie (15 minutes, its own path), so a
 * reload shows it again. No name, address or email: those show only on the first response.
 */
export interface Receipt {
  code: string;
  status: "paid" | "payment_processing";
  /** The return URL carries it, so a reload of that URL finds this receipt. */
  paymentIntentID: string;
  /** When the buyer returned from Stripe. */
  at: string;
  /** Checkout key: books, quantities, prices and shipping that were paid. */
  cart: string;
  payment?: PaymentFacts;
}

const receipt = type({
  "+": "reject",
  code: /^[0-9A-HJKMNP-TV-Z]{8}$/,
  status: "'paid' | 'payment_processing'",
  paymentIntentID: /^pi_\w{1,64}$/,
  at: "string.date.iso",
  cart: "string <= 1000",
  "payment?": {
    "+": "reject",
    method: "'card' | 'apple_pay' | 'google_pay' | 'sepa_debit' | 'wero'",
    "brand?": "string <= 40",
    "last4?": /^\d{4}$/,
  },
});

export function decodeReceipt(value: string | undefined): Receipt | null {
  try {
    const data = receipt(JSON.parse(value ?? ""));
    return data instanceof type.errors ? null : (data as Receipt);
  } catch {
    return null;
  }
}

/**
 * How a return from Stripe ends. The PaymentIntent's status decides; when Stripe could not be
 * asked, its `redirect_status`. A succeeded payment the CMS could not confirm yet stays pending:
 * the webhook creates the order, and a reload asks again.
 */
export function returnOutcome(
  confirmed: boolean,
  paymentStatus: string | null,
  redirectStatus: string | null,
): "paid" | "payment_processing" | "failed" | "pending" {
  if (confirmed) return "paid";
  const status = paymentStatus ?? redirectStatus;
  if (status === "processing") return "payment_processing";
  if (
    status === "failed" ||
    status === "requires_payment_method" ||
    status === "requires_action" ||
    status === "canceled"
  )
    return "failed";
  return "pending";
}

export interface OrderStep {
  state: "done" | "now" | "todo" | "stop";
  title: string;
  detail?: string;
  icon: "check" | "clock" | "package" | "truck" | "x";
}

/** The timeline below a confirmation or a status: what happened, what happens now and next. */
export function orderSteps(
  status: OrderLookupStatus,
  date: string,
  locale: Locale,
): OrderStep[] {
  const options = { locale };
  const day = formatOrderDate(date, locale);
  const ordered: OrderStep = {
    state: "done",
    title: m.shop_step_ordered({ date: day }, options),
    icon: "check",
  };
  const paid: OrderStep = {
    state: "done",
    title: m.shop_step_paid({ date: day }, options),
    icon: "check",
  };
  const pack = (state: OrderStep["state"]): OrderStep => ({
    state,
    title: m.shop_step_pack({}, options),
    ...(state === "done" ? {} : { detail: m.shop_step_pack_time({}, options) }),
    icon: state === "done" ? "check" : "package",
  });
  const ship: OrderStep = {
    state: "todo",
    title: m.shop_step_ship({}, options),
    detail: m.shop_step_ship_time({}, options),
    icon: "truck",
  };
  switch (status) {
    case "payment_processing":
      return [
        ordered,
        {
          state: "now",
          title: m.shop_step_debit({}, options),
          detail: m.shop_step_debit_time({}, options),
          icon: "clock",
        },
        pack("todo"),
        ship,
      ];
    case "paid":
      return [paid, pack("now"), ship];
    case "shipped":
      return [
        paid,
        pack("done"),
        {
          state: "now",
          title: m.shop_step_shipped({}, options),
          detail: m.shop_step_on_the_way({}, options),
          icon: "truck",
        },
      ];
    case "cancelled":
      return [
        ordered,
        { state: "stop", title: m.shop_step_cancelled({}, options), icon: "x" },
      ];
    case "payment_failed":
      return [
        ordered,
        {
          state: "stop",
          title: m.shop_step_failed({}, options),
          detail: m.shop_step_nothing_shipped({}, options),
          icon: "x",
        },
      ];
  }
}

export const statusLabel = (status: OrderLookupStatus, locale: Locale) =>
  ({
    payment_processing: m.order_status_payment_processing,
    paid: m.order_status_paid,
    shipped: m.order_status_shipped,
    cancelled: m.order_status_cancelled,
    payment_failed: m.order_status_payment_failed,
  })[status]({}, { locale });
