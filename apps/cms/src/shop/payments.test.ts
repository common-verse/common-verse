import type { PaymentAdapter } from "@payloadcms/plugin-ecommerce/types";
import { afterEach, expect, it, vi } from "vitest";
import {
  confirmPaidOrder,
  syncPaymentStatus,
  withFlatShipping,
  withOrderCode,
} from "./payments";

afterEach(() => vi.unstubAllGlobals());

const items = [
  { product: 1, quantity: 2 },
  { product: { id: 2 }, quantity: 1 },
];
const products = [
  { id: 1, priceInEUR: 1250, inventory: 2 },
  { id: 2, priceInEUR: 900, inventory: null },
];

function initiate({
  country = "DE",
  lastName = "Ahmadi",
  shippingRate = 450 as number | null,
  cartItems = items as unknown[],
  docs = products as unknown[],
} = {}) {
  const initiatePayment = vi.fn().mockResolvedValue({ clientSecret: "cs" });
  const findGlobal = vi.fn().mockResolvedValue({ shippingRate });
  const find = vi.fn().mockResolvedValue({ docs });
  const adapter = withFlatShipping({ initiatePayment } as never);
  const args = {
    data: {
      cart: { id: 3, subtotal: 2400, items: cartItems },
      currency: "EUR",
      customerEmail: "reader@example.invalid",
      shippingAddress: { country, lastName },
    },
    req: { payload: { findGlobal, find } },
    transactionsSlug: "transactions",
  } as unknown as Parameters<PaymentAdapter["initiatePayment"]>[0];
  return { initiatePayment, run: () => adapter.initiatePayment(args) };
}

it("charges current product prices plus the flat shipping rate", async () => {
  const { initiatePayment, run } = initiate();
  await expect(run()).resolves.toEqual({ clientSecret: "cs" });
  expect(initiatePayment).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        cart: expect.objectContaining({
          id: 3,
          subtotal: 2 * 1250 + 900 + 450,
          items: items.map((item) => expect.objectContaining(item)),
        }),
      }),
    }),
  );
});

it("gives every payment attempt its own line IDs", async () => {
  const { initiatePayment, run } = initiate();
  await run();
  await run();
  const lineIDs = initiatePayment.mock.calls.flatMap(([{ data }]) =>
    data.cart.items.map(({ id }: { id: string }) => id),
  );
  expect(new Set(lineIDs).size).toBe(4);
});

const line = (quantity: number, product: unknown = 1) => [
  { product, quantity },
];

it.each([
  ["outside Germany", { country: "AT" }, "Germany"],
  ["without a last name", { lastName: " " }, "name"],
  ["without a shipping rate", { shippingRate: null }, "shipping rate"],
  [
    "without a price",
    { cartItems: line(1), docs: [{ ...products[0], priceInEUR: null }] },
    "unavailable",
  ],
  ["for a deleted book", { cartItems: line(1, null) }, "unavailable"],
  ["for part of a copy", { cartItems: line(1.5) }, "1 to 10"],
  ["for no copies", { cartItems: line(0) }, "1 to 10"],
  ["for more than ten copies", { cartItems: line(11, 2) }, "1 to 10"],
  [
    "when repeated lines exceed stock",
    { cartItems: [...line(2), ...line(1)] },
    "stock",
  ],
])("refuses payment %s", async (_, options, error) => {
  const { initiatePayment, run } = initiate(options);
  await expect(run()).rejects.toThrow(error);
  expect(initiatePayment).not.toHaveBeenCalled();
});

function webhook(order: number | null) {
  const fetch = vi.fn().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", fetch);
  const payload = {
    config: { serverURL: "http://cms", routes: { api: "/api" } },
    find: vi.fn().mockResolvedValue({
      docs: [{ order, cart: 3, customerEmail: "reader@example.invalid" }],
    }),
    findByID: vi.fn().mockResolvedValue({ id: 3, secret: "s" }),
  };
  const event = {
    type: "payment_intent.succeeded",
    data: { object: { id: "pi_1" } },
  };
  return {
    fetch,
    payload,
    run: () => confirmPaidOrder({ event, req: { payload } } as never),
  };
}

it("confirms a paid order the return page never confirmed", async () => {
  const { fetch, payload, run } = webhook(null);
  await run();
  expect(payload.find).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { "stripe.paymentIntentID": { equals: "pi_1" } },
    }),
  );
  expect(fetch).toHaveBeenCalledWith(
    "http://cms/api/payments/stripe/confirm-order",
    expect.objectContaining({
      body: JSON.stringify({
        cartID: 3,
        secret: "s",
        customerEmail: "reader@example.invalid",
        paymentIntentID: "pi_1",
      }),
    }),
  );
});

it("skips orders that already exist and lets Stripe retry failures", async () => {
  const existing = webhook(9);
  await existing.run();
  expect(existing.fetch).not.toHaveBeenCalled();
  const failing = webhook(null);
  failing.fetch.mockResolvedValue(new Response("{}", { status: 500 }));
  await expect(failing.run()).rejects.toThrow("500");
});

it("returns the transaction's code when payment starts", async () => {
  const find = vi.fn().mockResolvedValue({ docs: [{ code: "K7QD93FA" }] });
  const adapter = withOrderCode({
    initiatePayment: async () => ({ message: "ok", paymentIntentID: "pi_1" }),
  } as never);
  await expect(
    adapter.initiatePayment({ req: { payload: { find } } } as never),
  ).resolves.toEqual({
    message: "ok",
    paymentIntentID: "pi_1",
    orderCode: "K7QD93FA",
  });
  expect(find).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { "stripe.paymentIntentID": { equals: "pi_1" } },
    }),
  );
});

it("reopens a processing or failed transaction and returns the order's code", async () => {
  const calls: string[] = [];
  const updateOne = vi.fn(async () => calls.push("reopen"));
  const finalizeOrder = vi.fn(async () => {
    calls.push("finalize");
    return { id: 9, code: "K7QD93FA" };
  });
  const adapter = withOrderCode({
    confirmOrder: async ({ finalizeOrder }: never) => {
      await (finalizeOrder as (input: unknown) => Promise<unknown>)({
        transactionID: 4,
        orderData: {},
      });
      return { message: "ok", orderID: 9, transactionID: 4 };
    },
  } as never);
  await expect(
    adapter.confirmOrder({
      finalizeOrder,
      req: { payload: { db: { updateOne } } },
    } as never),
  ).resolves.toEqual({
    message: "ok",
    orderID: 9,
    transactionID: 4,
    orderCode: "K7QD93FA",
  });
  expect(calls).toEqual(["reopen", "finalize"]);
  expect(updateOne).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        and: [
          { id: { equals: 4 } },
          { status: { in: ["processing", "failed"] } },
          { order: { exists: false } },
        ],
      },
      data: { status: "pending" },
      options: { atomic: true },
    }),
  );
});

function sync(intentStatus: string) {
  const updateOne = vi.fn();
  const retrieve = vi
    .fn()
    .mockResolvedValue({ id: "pi_1", status: intentStatus });
  const run = (type: string) =>
    syncPaymentStatus({
      event: { type, data: { object: { id: "pi_1" } } },
      req: { payload: { db: { updateOne } } },
      stripe: { paymentIntents: { retrieve } },
    } as never);
  const written = () => updateOne.mock.calls.map(([{ data }]) => data.status);
  return { retrieve, run, written };
}

it.each([
  ["requires_payment_method", "failed"],
  ["canceled", "failed"],
])("marks the transaction of a %s payment as %s", async (intent, status) => {
  const { retrieve, run, written } = sync(intent);
  await run("payment_intent.processing");
  expect(retrieve).toHaveBeenCalledWith("pi_1");
  expect(written()).toEqual([status]);
});

it("trusts the current payment over a late failure event", async () => {
  // A declined card, then a SEPA retry: the old failure must not hide the running debit.
  const { run, written } = sync("processing");
  await run("payment_intent.payment_failed");
  expect(written()).toEqual(["processing"]);
});

it("leaves succeeded payments to order confirmation", async () => {
  const { run, written } = sync("succeeded");
  await run("payment_intent.processing");
  expect(written()).toEqual([]);
});
