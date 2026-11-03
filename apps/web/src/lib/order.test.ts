import type { OrderLookup } from "@poetry/types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rateLimiter } from "./address";
import {
  decodeReceipt,
  limitedLookup,
  orderSteps,
  parseLookup,
  returnOutcome,
} from "./order";

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

describe("status form", () => {
  it("accepts a typed code and an email", () => {
    expect(
      parseLookup(form({ code: "k7qd 93fa", email: " reader@example.org " })),
    ).toEqual({ ok: true, code: "K7QD93FA", email: "reader@example.org" });
  });

  it("tells a missing field from an invalid one and keeps what was typed", () => {
    expect(parseLookup(form({ code: "K7QD", email: "" }))).toEqual({
      ok: false,
      values: { code: "K7QD", email: "" },
      errors: { code: "invalid", email: "required" },
    });
    expect(parseLookup(form({ code: "", email: "reader@" }))).toMatchObject({
      errors: { code: "required", email: "invalid" },
    });
  });
});

describe("limited lookup", () => {
  const order = { code: "K7QD93FA" } as OrderLookup;
  vi.spyOn(console, "error").mockImplementation(() => {});

  it("blocks a client after five failed lookups, but not after found orders", async () => {
    const attempts = rateLimiter(5, 1000);
    for (let index = 0; index < 10; index++)
      expect(await limitedLookup(attempts, "a", async () => order)).toEqual({
        order,
      });
    for (let index = 0; index < 5; index++)
      expect(await limitedLookup(attempts, "a", async () => null)).toEqual({
        problem: "not_found",
      });
    const find = vi.fn(async () => order);
    expect(await limitedLookup(attempts, "a", find)).toEqual({
      problem: "too_many",
    });
    expect(find).not.toHaveBeenCalled();
    expect(await limitedLookup(attempts, "b", find)).toEqual({ order });
  });

  it("does not count a failing CMS against the buyer", async () => {
    const attempts = rateLimiter(1, 1000);
    const failing = async () => {
      throw new Error("CMS down");
    };
    expect(await limitedLookup(attempts, "a", failing)).toEqual({
      problem: "unavailable",
    });
    expect(await limitedLookup(attempts, "a", async () => null)).toEqual({
      problem: "not_found",
    });
  });
});

describe("return from Stripe", () => {
  it.each([
    [true, null, null, "paid"],
    [false, "processing", "succeeded", "payment_processing"],
    [false, null, "processing", "payment_processing"],
    [false, "requires_payment_method", "succeeded", "failed"],
    [false, "canceled", null, "failed"],
    [false, null, "failed", "failed"],
    // Paid at Stripe but not yet confirmed by the CMS: the webhook settles it.
    [false, "succeeded", "failed", "pending"],
    [false, null, null, "pending"],
  ] as const)(
    "confirmed %o, PaymentIntent %o, redirect %o → %o",
    (confirmed, payment, redirect, expected) => {
      expect(returnOutcome(confirmed, payment, redirect)).toBe(expected);
    },
  );

  const receipt = {
    code: "K7QD93FA",
    status: "payment_processing",
    paymentIntentID: "pi_test1",
    at: "2026-10-30T10:00:00.000Z",
    cart: "1x1@2000+400",
    payment: { method: "sepa_debit", last4: "3000" },
  };

  it("restores the confirmation from the order cookie", () => {
    expect(decodeReceipt(JSON.stringify(receipt))).toEqual(receipt);
  });

  it.each([
    ["an order ID from before codes", "1001"],
    ["a broken code", JSON.stringify({ ...receipt, code: "K7QD93FU" })],
    ["another status", JSON.stringify({ ...receipt, status: "shipped" })],
    [
      "a full card number",
      JSON.stringify({
        ...receipt,
        payment: { method: "card", brand: "visa", last4: "4242424242424242" },
      }),
    ],
    [
      "a receipt holding personal data",
      JSON.stringify({ ...receipt, email: "reader@example.org" }),
    ],
    ["no cookie", undefined],
  ])("ignores %s", (_case, value) => {
    expect(decodeReceipt(value)).toBeNull();
  });
});

describe("timeline", () => {
  afterEach(() => vi.unstubAllEnvs());

  const states = (status: Parameters<typeof orderSteps>[0]) =>
    orderSteps(status, "2026-10-30T23:30:00.000Z", "de").map(
      ({ state, title }) => `${state}: ${title}`,
    );

  it("dates the first step in Berlin time and marks where the order is", () => {
    vi.stubEnv("TZ", "UTC");
    expect(states("paid")).toEqual([
      "done: Bezahlt am 31. Oktober 2026",
      "now: Wir packen deine Bücher",
      "todo: Versand mit der Post",
    ]);
    expect(states("payment_processing")).toEqual([
      "done: Bestellung eingegangen am 31. Oktober 2026",
      "now: Lastschrift läuft",
      "todo: Wir packen deine Bücher",
      "todo: Versand mit der Post",
    ]);
    expect(states("shipped")).toEqual([
      "done: Bezahlt am 31. Oktober 2026",
      "done: Wir packen deine Bücher",
      "now: Versendet",
    ]);
    expect(states("cancelled").at(-1)).toBe("stop: Storniert");
    expect(states("payment_failed").at(-1)).toBe(
      "stop: Zahlung fehlgeschlagen",
    );
  });
});
