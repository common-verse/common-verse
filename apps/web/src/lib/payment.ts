import type { Locale } from "@poetry/i18n";
import * as m from "../paraglide/messages.js";

/** What the confirmation shows about how the buyer paid; never more than the last four digits. */
export interface PaymentFacts {
  method: "card" | "apple_pay" | "google_pay" | "sepa_debit" | "wero";
  brand?: string;
  last4?: string;
}

export interface PaymentState {
  status: string;
  facts: PaymentFacts | null;
}

const last4 = (value: unknown) =>
  typeof value === "string" && /^\d{4}$/.test(value) ? value : undefined;

/** Reads the expanded payment method of a PaymentIntent; other methods show nothing. */
export function paymentFacts(method: unknown): PaymentFacts | null {
  if (!method || typeof method !== "object") return null;
  const { type, card, sepa_debit } = method as {
    type?: string;
    card?: { brand?: string; last4?: string; wallet?: { type?: string } };
    sepa_debit?: { last4?: string };
  };
  if (type === "card") {
    const wallet = card?.wallet?.type;
    if (wallet === "apple_pay" || wallet === "google_pay")
      return { method: wallet };
    const digits = last4(card?.last4);
    return digits && card?.brand
      ? { method: "card", brand: card.brand, last4: digits }
      : null;
  }
  if (type === "sepa_debit") {
    const digits = last4(sepa_debit?.last4);
    return digits ? { method: "sepa_debit", last4: digits } : { method: type };
  }
  return type === "wero" ? { method: type } : null;
}

const brands: Record<string, string> = {
  amex: "American Express",
  cartes_bancaires: "Cartes Bancaires",
  diners: "Diners Club",
  discover: "Discover",
  jcb: "JCB",
  mastercard: "Mastercard",
  unionpay: "UnionPay",
  visa: "Visa",
};

/** Apple-like: "Visa •••• 4242", or "SEPA-Lastschrift" with "IBAN •••• 3000" as its detail line. */
export function paymentLabel(
  facts: PaymentFacts,
  locale: Locale,
): { label: string; detail?: string } {
  const options = { locale };
  if (facts.method === "card")
    return {
      label: m.shop_payment_card(
        { brand: brands[facts.brand!] ?? facts.brand!, last4: facts.last4! },
        options,
      ),
    };
  if (facts.method === "sepa_debit")
    return {
      label: m.shop_payment_sepa({}, options),
      ...(facts.last4
        ? { detail: m.shop_payment_iban({ last4: facts.last4 }, options) }
        : {}),
    };
  return {
    label: { apple_pay: "Apple Pay", google_pay: "Google Pay", wero: "Wero" }[
      facts.method
    ],
  };
}

const stripeApi = "https://api.stripe.com/";

/**
 * `STRIPE_API_URL` exists for browser tests against the mock CMS, so it is honoured only on
 * this machine; any other host could read client secrets.
 */
export function stripeApiUrl(configured: string | undefined) {
  if (!configured) return stripeApi;
  try {
    if (
      ["127.0.0.1", "localhost", "[::1]"].includes(new URL(configured).hostname)
    )
      return configured;
  } catch {}
  console.warn(
    "STRIPE_API_URL is ignored: only a loopback address is allowed.",
  );
  return stripeApi;
}

/**
 * Asks Stripe for the PaymentIntent with the publishable key and its client secret, as
 * Stripe.js would in the browser. Null when Stripe cannot be reached; the caller then
 * falls back to Stripe's `redirect_status`.
 */
export async function retrievePayment(
  apiUrl: string,
  publishableKey: string,
  paymentIntentID: string,
  clientSecret: string,
): Promise<PaymentState | null> {
  const url = new URL(`v1/payment_intents/${paymentIntentID}`, apiUrl);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.append("expand[]", "payment_method");
  try {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${publishableKey}` },
      signal: AbortSignal.timeout(4000),
    });
    const data = await response.json();
    return typeof data?.status === "string"
      ? { status: data.status, facts: paymentFacts(data.payment_method) }
      : null;
  } catch {
    return null;
  }
}
