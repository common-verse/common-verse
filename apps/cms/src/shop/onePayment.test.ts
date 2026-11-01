import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  answerRefusedStart,
  withFlatShipping,
  withOnePaymentPerCart,
} from "./payments";

beforeEach(() => vi.useFakeTimers({ now: new Date("2026-11-01T12:00:00Z") }));
afterEach(() => vi.useRealTimers());

type Doc = Record<string, unknown>;
type Where = Record<string, unknown>;
const now = () => Math.floor(Date.now() / 1000);
const value = (doc: Doc, path: string) =>
  path.split(".").reduce<unknown>((v, key) => (v as Doc)?.[key], doc) ?? null;

/** Evaluates the Payload WHERE shapes the guard uses, so the store behaves like the database. */
function matches(doc: Doc, where: Where): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === "and")
      return (condition as Where[]).every((w) => matches(doc, w));
    if (key === "or")
      return (condition as Where[]).some((w) => matches(doc, w));
    const actual = value(doc, key);
    return Object.entries(condition as Where).every(([operator, operand]) => {
      switch (operator) {
        case "equals":
          return actual === operand;
        case "not_in":
          return !(operand as unknown[]).includes(actual);
        case "exists":
          return (actual !== null) === operand;
        case "less_than":
          return actual !== null && (actual as string) < (operand as string);
      }
      throw new Error(`Unsupported operator ${operator}`);
    });
  });
}

const cancelable = [
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
];

/** A cart with earlier attempts: intent ID → [status, age in seconds, order]. */
function cart(
  attempts: Record<string, [string, number?, number?]> = {},
  {
    lockedAgo = null as number | null,
    onCancel = (_id: string) => {},
    takeOver = false,
    failNew = false,
  } = {},
) {
  const intents: Record<string, { status: string; created: number }> = {};
  const transactions: Doc[] = [];
  const carts: Doc[] = [
    {
      id: 3,
      paymentStartedAt:
        lockedAgo === null
          ? null
          : new Date(Date.now() - lockedAgo * 1000).toISOString(),
    },
  ];
  const add = (id: string, status: string, age = 0, order?: number) => {
    intents[id] = { status, created: now() - age };
    transactions.push({
      id: transactions.length + 1,
      cart: 3,
      status: order ? "succeeded" : "pending",
      order: order ?? null,
      stripe: { paymentIntentID: id },
    });
  };
  for (const [id, [status, age, order]] of Object.entries(attempts))
    add(id, status, age, order);
  const store: Record<string, Doc[]> = { carts, transactions };
  const updateOne = vi.fn(async ({ collection, where, data }) => {
    const doc = store[collection].find((doc) => matches(doc, where));
    return doc ? Object.assign(doc, data) : null;
  });
  const find = vi.fn(async ({ collection, where }) => ({
    docs: store[collection].filter((doc) => matches(doc, where)),
  }));
  const cancelled: [string, string][] = [];
  const stripe = {
    paymentIntents: {
      retrieve: vi.fn(async (id: string) => ({ id, ...intents[id] })),
      cancel: vi.fn(
        async (id: string, { cancellation_reason }: Record<string, string>) => {
          onCancel(id);
          if (!cancelable.includes(intents[id].status))
            throw new Error(`Cannot cancel ${intents[id].status}`);
          intents[id].status = "canceled";
          cancelled.push([id, cancellation_reason]);
          return { id, ...intents[id] };
        },
      ),
    },
  };
  const initiatePayment = vi.fn(async () => {
    if (failNew) throw new Error("Stripe down");
    add("pi_new", "requires_payment_method");
    // Another start took over the expired claim while this one waited for Stripe.
    if (takeOver)
      carts[0].paymentStartedAt = new Date(Date.now() + 1000).toISOString();
    return { message: "ok", paymentIntentID: "pi_new" };
  });
  const req = {
    context: {} as Record<string, unknown>,
    payload: { find, db: { updateOne } },
  };
  const adapter = withOnePaymentPerCart(
    { initiatePayment } as never,
    () => stripe as never,
  );
  return {
    cancelled,
    initiatePayment,
    intents,
    req,
    stripe,
    updateOne,
    lock: () => carts[0].paymentStartedAt,
    status: (id: string) =>
      transactions.find((t) => value(t, "stripe.paymentIntentID") === id)
        ?.status,
    start: (data: Doc = {}) =>
      adapter.initiatePayment({
        data: { cart: { id: 3 }, ...data },
        req,
      } as never),
  };
}

it("cancels the cart's earlier unpaid payments, then starts a new one", async () => {
  const shop = cart({
    pi_1: ["requires_payment_method"],
    pi_2: ["requires_action", 11 * 60],
    pi_3: ["canceled"],
  });
  await expect(shop.start()).resolves.toMatchObject({
    paymentIntentID: "pi_new",
  });
  expect(shop.cancelled).toEqual([
    ["pi_1", "abandoned"],
    ["pi_2", "abandoned"],
  ]);
  for (const id of ["pi_1", "pi_2", "pi_3"])
    expect(shop.status(id)).toBe("cancelled");
  expect(shop.status("pi_new")).toBe("pending");
  expect(shop.lock()).toBeNull();
});

it.each([
  ["is processing", { pi_1: ["processing"] }],
  ["succeeded without an order yet", { pi_1: ["succeeded"] }],
  ["waits for 3-D Secure or a redirect", { pi_1: ["requires_action", 9 * 60] }],
] as const)(
  "refuses a new payment while an earlier one %s",
  async (_, attempts) => {
    const shop = cart(attempts as never);
    await expect(shop.start()).rejects.toThrow("payment_in_progress");
    expect(shop.req.context.paymentRefusal).toBe("payment_in_progress");
    expect(shop.stripe.paymentIntents.cancel).not.toHaveBeenCalled();
    expect(shop.initiatePayment).not.toHaveBeenCalled();
    expect(shop.status("pi_1")).toBe("pending");
    expect(shop.lock()).toBeNull();
  },
);

it("refuses when the buyer pays an earlier payment while it is being cancelled", async () => {
  const shop = cart(
    { pi_1: ["requires_payment_method"] },
    { onCancel: (id) => (shop.intents[id].status = "succeeded") },
  );
  await expect(shop.start()).rejects.toThrow("payment_in_progress");
  expect(shop.initiatePayment).not.toHaveBeenCalled();
  expect(shop.status("pi_1")).toBe("pending");
});

it("never closes a transaction that got its order meanwhile", async () => {
  const shop = cart({ pi_1: ["requires_payment_method"] });
  shop.stripe.paymentIntents.cancel.mockImplementationOnce(async (id) => {
    // The order lands between reading the transaction and closing it.
    await shop.updateOne({
      collection: "transactions",
      where: { "stripe.paymentIntentID": { equals: id } },
      data: { order: 9 },
    });
    shop.intents[id].status = "canceled";
    return { id, ...shop.intents[id] };
  });
  await shop.start();
  expect(shop.status("pi_1")).toBe("pending");
});

it("answers cart_completed for a cart that already has its order", async () => {
  const shop = cart({ pi_1: ["succeeded", 0, 9] });
  await expect(shop.start()).rejects.toThrow("cart_completed");
  expect(shop.req.context.paymentRefusal).toBe("cart_completed");
  expect(shop.stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
  expect(shop.initiatePayment).not.toHaveBeenCalled();
});

it("refuses a second payment start that runs at the same time", async () => {
  const shop = cart({ pi_1: ["requires_payment_method"] }, { lockedAgo: 5 });
  const lock = shop.lock();
  await expect(shop.start()).rejects.toThrow("payment_in_progress");
  expect(shop.stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
  expect(shop.lock()).toBe(lock);
});

it("takes over a claim older than a minute", async () => {
  const shop = cart({}, { lockedAgo: 61 });
  await expect(shop.start()).resolves.toMatchObject({
    paymentIntentID: "pi_new",
  });
  expect(shop.lock()).toBeNull();
});

it("cancels its own payment when a newer start took over its claim", async () => {
  const shop = cart({}, { takeOver: true });
  await expect(shop.start()).rejects.toThrow("payment_in_progress");
  expect(shop.cancelled).toEqual([["pi_new", "duplicate"]]);
  expect(shop.status("pi_new")).toBe("cancelled");
  expect(shop.lock()).not.toBeNull();
});

it("frees the cart when starting the payment fails", async () => {
  const shop = cart({}, { failNew: true });
  await expect(shop.start()).rejects.toThrow("Stripe down");
  expect(shop.req.context.paymentRefusal).toBeUndefined();
  expect(shop.lock()).toBeNull();
});

it("touches no earlier payment when the new start is invalid", async () => {
  const shop = cart({ pi_1: ["requires_payment_method"] });
  const guarded = withFlatShipping(
    withOnePaymentPerCart(
      { initiatePayment: shop.initiatePayment } as never,
      () => shop.stripe as never,
    ),
  );
  await expect(
    guarded.initiatePayment({
      data: {
        cart: { id: 3, items: [] },
        shippingAddress: { country: "AT", lastName: "A" },
      },
      req: shop.req,
    } as never),
  ).rejects.toThrow("Germany");
  expect(shop.stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
  expect(shop.stripe.paymentIntents.cancel).not.toHaveBeenCalled();
  expect(shop.updateOne).not.toHaveBeenCalled();
});

it.each(["payment_in_progress", "cart_completed"])(
  "answers a %s refusal with 409",
  async (refusal) => {
    const failed = Response.json({ message: "Error" }, { status: 500 });
    const handler = answerRefusedStart(async (req) => {
      req.context.paymentRefusal = refusal;
      return failed;
    });
    const response = await handler({ context: {} } as never);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: refusal });
    expect(
      await answerRefusedStart(async () => failed)({ context: {} } as never),
    ).toBe(failed);
  },
);
