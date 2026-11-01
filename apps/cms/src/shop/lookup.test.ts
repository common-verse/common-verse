import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { orderLookup } from "./lookup";

beforeEach(() => vi.stubEnv("ORDER_LOOKUP_SECRET", "secret"));
afterEach(() => vi.unstubAllEnvs());

const order = {
  id: 1,
  code: "K7QD93FA",
  status: "processing",
  createdAt: "2026-11-01T10:00:00.000Z",
  items: [{ id: "a", product: 2, quantity: 2 }],
  amount: 2950,
  currency: "EUR",
  customerEmail: "reader@example.invalid",
  // The mock returns more than the endpoint selects, so leaks would show.
  shippingAddress: { firstName: "Test", addressLine1: "Teststraße 1" },
};

function lookup(
  body: unknown,
  { orders = [order] as unknown[], transactions = [] as unknown[] } = {},
  secret: string | null = "secret",
) {
  const find = vi.fn(async ({ collection, where }) => ({
    docs:
      collection === "products"
        ? [{ id: 2, title: "Die Zeit" }]
        : (collection === "orders" ? orders : transactions).filter(
            (doc) => (doc as typeof order).code === where.code.equals,
          ),
  }));
  const request = new Request("http://cms/api/orders/lookup", {
    method: "POST",
    headers: secret ? { "x-order-lookup-secret": secret } : {},
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const req = Object.assign(request, { payload: { find } });
  return { find, response: orderLookup.handler(req as never) };
}

it("returns the order's public status for its code and email", async () => {
  const { response } = lookup({
    code: "k7qd-93fa",
    email: " Reader@Example.invalid ",
  });
  const result = await response;
  expect(result.status).toBe(200);
  expect(result.headers.get("cache-control")).toBe("no-store");
  expect(await result.json()).toEqual({
    code: "K7QD93FA",
    status: "paid",
    createdAt: order.createdAt,
    items: [{ title: "Die Zeit", quantity: 2 }],
    amount: 2950,
    currency: "EUR",
  });
});

it.each([
  ["shipped", "shipped"],
  ["refunded", "cancelled"],
])("shows %s orders as %s", async (status, shown) => {
  const { response } = lookup(
    { code: order.code, email: order.customerEmail },
    { orders: [{ ...order, status }] },
  );
  expect((await (await response).json()).status).toBe(shown);
});

it("prefers the order over its succeeded transaction with the same code", async () => {
  const { response } = lookup(
    { code: order.code, email: order.customerEmail },
    { transactions: [{ ...order, status: "succeeded" }] },
  );
  expect((await (await response).json()).status).toBe("paid");
});

it.each([
  ["processing", "payment_processing"],
  ["failed", "payment_failed"],
])("shows a %s payment before the order exists", async (status, shown) => {
  const { response } = lookup(
    { code: order.code, email: order.customerEmail },
    { orders: [], transactions: [{ ...order, status }] },
  );
  expect((await (await response).json()).status).toBe(shown);
});

it.each([
  ["a wrong email", { code: order.code, email: "other@example.invalid" }],
  ["a wrong code", { code: "K7QD93FB", email: order.customerEmail }],
  ["a malformed code", { code: "K7QD", email: order.customerEmail }],
  ["no email", { code: order.code }],
  ["an unpaid transaction", { code: "PENDING1", email: order.customerEmail }],
  ["invalid JSON", "{"],
])("answers %s with the same not-found", async (_, body) => {
  const { find, response } = lookup(body, {
    transactions: [{ ...order, code: "PENDING1", status: "pending" }],
  });
  const result = await response;
  const collections = find.mock.calls.map(([{ collection }]) => collection);
  expect(collections).not.toContain("products");
  expect(result.status).toBe(404);
  expect(result.headers.get("cache-control")).toBe("no-store");
  expect(await result.json()).toEqual({ error: "Not found" });
});

it.each([
  ["a missing", null],
  ["a wrong", "guess"],
])("refuses %s secret before reading orders", async (_, secret) => {
  const { find, response } = lookup(
    { code: order.code, email: order.customerEmail },
    {},
    secret,
  );
  expect((await response).status).toBe(401);
  expect(find).not.toHaveBeenCalled();
});

it("stays closed while the CMS has no lookup secret", async () => {
  vi.stubEnv("ORDER_LOOKUP_SECRET", "");
  const { response } = lookup(
    { code: order.code, email: order.customerEmail },
    {},
    "",
  );
  expect((await response).status).toBe(401);
});
