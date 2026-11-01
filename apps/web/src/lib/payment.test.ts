import { afterEach, describe, expect, it, vi } from "vitest";
import {
  paymentFacts,
  paymentLabel,
  retrievePayment,
  stripeApiUrl,
} from "./payment";

describe("payment facts", () => {
  it.each([
    [
      { type: "card", card: { brand: "visa", last4: "4242" } },
      "Visa\u00a0••••\u00a04242",
    ],
    [
      { type: "card", card: { brand: "newbrand", last4: "1111" } },
      "newbrand\u00a0••••\u00a01111",
    ],
    [
      {
        type: "card",
        card: { brand: "visa", last4: "4242", wallet: { type: "apple_pay" } },
      },
      "Apple Pay",
    ],
    [
      { type: "sepa_debit", sepa_debit: { last4: "3000" } },
      "SEPA-Lastschrift / IBAN\u00a0••••\u00a03000",
    ],
    [{ type: "sepa_debit", sepa_debit: {} }, "SEPA-Lastschrift"],
    [{ type: "wero" }, "Wero"],
  ])("shows %o as %o", (method, label) => {
    const { label: line, detail } = paymentLabel(paymentFacts(method)!, "de");
    expect([line, detail].filter(Boolean).join(" / ")).toBe(label);
  });

  it.each([
    ["an unexpanded ID", "pm_123"],
    ["no method", null],
    ["another method", { type: "klarna" }],
    [
      "a card without its last digits",
      { type: "card", card: { brand: "visa" } },
    ],
  ])("shows nothing for %s", (_case, method) => {
    expect(paymentFacts(method)).toBeNull();
  });
});

describe("PaymentIntent retrieval", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks Stripe with the publishable key and client secret, expanding the method", async () => {
    const fetch = vi.fn(async () =>
      Response.json({
        status: "processing",
        payment_method: { type: "sepa_debit", sepa_debit: { last4: "3000" } },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    expect(
      await retrievePayment(
        "https://api.stripe.test/",
        "pk_test_1",
        "pi_1",
        "pi_1_secret_2",
      ),
    ).toEqual({
      status: "processing",
      facts: { method: "sepa_debit", last4: "3000" },
    });
    const [url, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.href).toBe(
      "https://api.stripe.test/v1/payment_intents/pi_1?client_secret=pi_1_secret_2&expand%5B%5D=payment_method",
    );
    expect(init.headers).toEqual({ authorization: "Bearer pk_test_1" });
  });

  it("answers null when Stripe refuses or cannot be reached", async () => {
    vi.stubGlobal("fetch", async () =>
      Response.json({ error: {} }, { status: 404 }),
    );
    expect(
      await retrievePayment("https://api.stripe.test/", "pk", "pi_1", "s"),
    ).toBeNull();
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("offline");
    });
    expect(
      await retrievePayment("https://api.stripe.test/", "pk", "pi_1", "s"),
    ).toBeNull();
  });
});

describe("Stripe API address", () => {
  it.each([
    [undefined, "https://api.stripe.com/"],
    ["http://127.0.0.1:3101/stripe/", "http://127.0.0.1:3101/stripe/"],
    ["http://localhost:3101/stripe/", "http://localhost:3101/stripe/"],
    ["http://[::1]:3101/stripe/", "http://[::1]:3101/stripe/"],
    ["https://evil.example/", "https://api.stripe.com/"],
    ["http://127.0.0.1.evil.example/", "https://api.stripe.com/"],
    ["not a url", "https://api.stripe.com/"],
  ])("uses %o as %o", (configured, expected) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(stripeApiUrl(configured)).toBe(expected);
  });
});
