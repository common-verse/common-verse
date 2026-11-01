/**
 * Buys one book through the running CMS with Stripe test mode, checks the order
 * and stock, then removes everything it created. See docs/testing.md.
 */
import "../src/env";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getPayload } from "payload";
import { Stripe } from "stripe";
import config from "../src/payload.config";

const secretKey = process.env.STRIPE_SECRET_KEY ?? "";
if (!/^(sk|rk)_test_/.test(secretKey))
  throw new Error("Refusing to run: STRIPE_SECRET_KEY must be a test key.");
const cmsURL = process.env.PAYLOAD_PUBLIC_SERVER_URL ?? "http://localhost:3001";
const database = new URL(process.env.DATABASE_URL ?? "");
if (
  ![cmsURL, database.href].every((url) =>
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname),
  )
)
  throw new Error("Refusing to run: the CMS and database must be local.");
const lookupSecret = process.env.ORDER_LOOKUP_SECRET;
if (!lookupSecret)
  throw new Error("Set ORDER_LOOKUP_SECRET for the CMS and this script.");

const stripe = new Stripe(secretKey);
const payload = await getPayload({ config });
const post = async (path: string, body: unknown) => {
  const response = await fetch(new URL(path, cmsURL), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  assert.ok(
    response.ok,
    `${path} failed with ${response.status}: ${JSON.stringify(data)}`,
  );
  return data;
};
const lookup = async (code: string, email: string) => {
  const response = await fetch(new URL("/api/orders/lookup", cmsURL), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-order-lookup-secret": lookupSecret,
    },
    body: JSON.stringify({ code, email }),
  });
  return { status: response.status, data: await response.json() };
};

const {
  docs: [book],
} = await payload.find({
  collection: "products",
  where: { inventory: { greater_than: 0 }, priceInEUR: { greater_than: 0 } },
  depth: 0,
  limit: 1,
});
assert.ok(
  book,
  "Seed a product with stock first (pnpm --filter @poetry/cms seed:shop).",
);
const { inventory } = book;
const { shippingRate } = await payload.findGlobal({ slug: "shop-settings" });
assert.equal(
  typeof shippingRate,
  "number",
  "Set the shipping rate in Shop settings.",
);

const email = `shop-purchase-${randomUUID()}@example.com`;
let cartID: number | undefined;
try {
  const { doc: cart } = await post("/api/carts", {
    items: [{ product: book.id, quantity: 1 }],
    currency: "EUR",
  });
  cartID = cart.id;
  const access = { cartID: cart.id, secret: cart.secret, customerEmail: email };
  const start = {
    ...access,
    shippingAddress: {
      firstName: "Test",
      lastName: "Käufer",
      addressLine1: "Teststraße 1",
      postalCode: "10115",
      city: "Berlin",
      country: "DE",
    },
  };
  // A buyer who changes the address starts a second payment for the same cart.
  await post("/api/payments/stripe/initiate", start);
  const { paymentIntentID, orderCode } = await post(
    "/api/payments/stripe/initiate",
    start,
  );
  await stripe.paymentIntents.confirm(paymentIntentID, {
    payment_method: "pm_card_visa",
    return_url: "http://localhost:4321/de/shop/checkout/complete",
  });
  const confirmed = await post("/api/payments/stripe/confirm-order", {
    ...access,
    paymentIntentID,
  });
  const { orderID } = confirmed;
  assert.match(confirmed.orderCode, /^[0-9A-HJKMNP-TV-Z]{8}$/, "order code");
  assert.equal(confirmed.orderCode, orderCode, "code from payment start");

  // Buyers type the displayed form, e.g. "k7qd-93fa".
  const typed = `${orderCode.slice(0, 4)}-${orderCode.slice(4)}`.toLowerCase();
  const found = await lookup(typed, email.toUpperCase());
  assert.equal(found.status, 200, "lookup by code and email");
  assert.equal(found.data.status, "paid", "lookup status");
  assert.equal(found.data.code, orderCode, "lookup code");
  assert.equal(
    (await lookup(orderCode, `other-${email}`)).status,
    404,
    "lookup with a wrong email",
  );

  const order = await payload.findByID({
    collection: "orders",
    id: orderID,
    depth: 0,
  });
  assert.equal(order.amount, book.priceInEUR + shippingRate!, "order amount");
  const after = await payload.findByID({
    collection: "products",
    id: book.id,
    depth: 0,
  });
  assert.equal(after.inventory, inventory! - 1, "stock after purchase");
  console.log(
    `OK: order ${orderID} (${orderCode}) charged ${order.amount} cents; stock ${inventory} → ${after.inventory}.`,
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (cartID !== undefined) {
    const where = { cart: { equals: cartID } };
    const { docs: transactions } = await payload.find({
      collection: "transactions",
      where,
      depth: 0,
      pagination: false,
    });
    const orders = transactions.flatMap(({ order }) =>
      order ? [order as number] : [],
    );
    if (orders.length)
      await payload.delete({
        collection: "orders",
        where: { id: { in: orders } },
      });
    await payload.delete({ collection: "transactions", where });
    await payload.delete({ collection: "carts", id: cartID });
    for (const { stripe: ids } of transactions) {
      const intent =
        ids?.paymentIntentID &&
        (await stripe.paymentIntents.retrieve(ids.paymentIntentID));
      if (
        intent &&
        intent.status !== "succeeded" &&
        intent.status !== "canceled"
      )
        await stripe.paymentIntents.cancel(intent.id);
    }
  }
  await payload.update({
    collection: "products",
    id: book.id,
    data: { inventory },
  });
  const { data: customers } = await stripe.customers.list({ email, limit: 10 });
  for (const customer of customers) await stripe.customers.del(customer.id);
  await payload.destroy();
}
// PostgreSQL handles can outlive destroy(), as in the seed scripts.
process.exit();
