import type { PaymentAdapter } from "@payloadcms/plugin-ecommerce/types";
import { randomBytes } from "node:crypto";
import type { PayloadHandler, PayloadRequest } from "payload";
import type { Stripe } from "stripe";

/** Adds the editor-set Germany rate before the adapter creates the PaymentIntent. */
export const withFlatShipping = (adapter: PaymentAdapter): PaymentAdapter => ({
  ...adapter,
  initiatePayment: async (args) => {
    if (args.data.shippingAddress?.country !== "DE")
      throw new Error("Shipping is limited to Germany.");
    // A single name (common in wallets) goes in lastName; firstName may stay empty.
    if (!args.data.shippingAddress.lastName?.trim())
      throw new Error("Payment refused: the recipient's name is missing.");
    const { shippingRate } = await args.req.payload.findGlobal({
      slug: "shop-settings",
      depth: 0,
      req: args.req,
    });
    if (typeof shippingRate !== "number")
      throw new Error(
        "Payment refused: set the shipping rate in Shop settings first.",
      );
    const items = args.data.cart.items ?? [];
    const productID = ({ product }: (typeof items)[number]) =>
      typeof product === "object" ? product?.id : product;
    // The cart's stored subtotal reflects prices at its last change, so charge current prices.
    const { docs } = await args.req.payload.find({
      collection: "products",
      where: { id: { in: items.map(productID).filter((id) => id != null) } },
      select: { priceInEUR: true, inventory: true },
      depth: 0,
      pagination: false,
      req: args.req,
    });
    // The plugin checks stock per line, so repeated lines for one book could oversell.
    const ordered = new Map<number | string, number>();
    const subtotal = items.reduce((sum, item) => {
      const product = docs.find(({ id }) => id === productID(item));
      const { quantity } = item;
      if (!product?.priceInEUR)
        throw new Error("Payment refused: a book is unavailable.");
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10)
        throw new Error("Payment refused: order 1 to 10 copies per book.");
      const total = (ordered.get(product.id) ?? 0) + quantity;
      if (typeof product.inventory === "number" && total > product.inventory)
        throw new Error("Payment refused: not enough copies in stock.");
      ordered.set(product.id, total);
      return sum + product.priceInEUR * quantity;
    }, 0);
    // Settlement compares the PaymentIntent with its transaction, not the cart, so the order total includes shipping.
    return adapter.initiatePayment({
      ...args,
      data: {
        ...args.data,
        cart: {
          ...args.data.cart,
          subtotal: subtotal + shippingRate,
          // The plugin copies line IDs into each transaction, so a second attempt for one cart would collide.
          items: items.map((item) => ({
            ...item,
            id: randomBytes(12).toString("hex"),
          })),
        },
      },
    });
  },
});

const cancellable: Stripe.PaymentIntent.Status[] = [
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
];
const closedTransactions = ["cancelled", "expired", "refunded"];
// A crashed payment start must not block its cart for long.
const lockMilliseconds = 60_000;
// A buyer may still be in 3-D Secure or a Wero redirect for this long.
const actionSeconds = 600;

type Refusal = "payment_in_progress" | "cart_completed";
const refuse = (req: PayloadRequest, refusal: Refusal) => {
  req.context.paymentRefusal = refusal;
  return new Error(`Payment refused: ${refusal}.`);
};

/** The plugin answers every refused start with 500, so these get their own answer for the site. */
export const answerRefusedStart =
  (handler: PayloadHandler): PayloadHandler =>
  async (req) => {
    const response = await handler(req);
    const refusal = req.context.paymentRefusal;
    return refusal
      ? Response.json({ error: refusal }, { status: 409 })
      : response;
  };

/** Cancels a PaymentIntent unless the buyer paid it meanwhile. */
async function cancelIntent(
  stripe: Stripe,
  intentID: string,
  reason: "abandoned" | "duplicate",
) {
  const intent = await stripe.paymentIntents
    .cancel(intentID, { cancellation_reason: reason })
    .catch(async (error) => {
      const current = await stripe.paymentIntents.retrieve(intentID);
      if (cancellable.includes(current.status)) throw error;
      return current;
    });
  return intent.status === "canceled";
}

const closeTransaction = (req: PayloadRequest, intentID: string) =>
  req.payload.db.updateOne({
    collection: "transactions",
    where: {
      and: [
        { "stripe.paymentIntentID": { equals: intentID } },
        { status: { not_in: closedTransactions } },
        { order: { exists: false } },
      ],
    },
    data: { status: "cancelled" },
    options: { atomic: true },
    req,
  });

async function cancelEarlierPayments(
  req: PayloadRequest,
  stripe: Stripe,
  cartID: number | string,
) {
  const { docs } = await req.payload.find({
    collection: "transactions",
    where: {
      and: [
        { cart: { equals: cartID } },
        { status: { not_in: closedTransactions } },
      ],
    },
    select: { stripe: true, order: true },
    depth: 0,
    pagination: false,
    req,
  });
  if (docs.some(({ order }) => order != null))
    throw refuse(req, "cart_completed");
  for (const { stripe: ids } of docs) {
    const intentID = ids?.paymentIntentID;
    if (!intentID) continue;
    const intent = await stripe.paymentIntents.retrieve(intentID);
    const recentAction =
      intent.status === "requires_action" &&
      Date.now() / 1000 - intent.created < actionSeconds;
    const cancelled =
      intent.status === "canceled" ||
      (cancellable.includes(intent.status) &&
        !recentAction &&
        (await cancelIntent(stripe, intentID, "abandoned")));
    if (!cancelled) throw refuse(req, "payment_in_progress");
    await closeTransaction(req, intentID);
  }
}

/**
 * Keeps one payable PaymentIntent per cart. A changed address, or a wallet and the
 * form at once, would otherwise leave an earlier one open to be paid as well.
 */
export const withOnePaymentPerCart = (
  adapter: PaymentAdapter,
  stripe: () => Stripe,
): PaymentAdapter => ({
  ...adapter,
  initiatePayment: async (args) => {
    const { req } = args;
    const cartID = args.data.cart.id;
    const startedAt = new Date().toISOString();
    // The atomic claim on the cart lets only one payment start run at a time.
    const claimed = await req.payload.db.updateOne({
      collection: "carts",
      where: {
        and: [
          { id: { equals: cartID } },
          {
            or: [
              { paymentStartedAt: { exists: false } },
              {
                paymentStartedAt: {
                  less_than: new Date(
                    Date.now() - lockMilliseconds,
                  ).toISOString(),
                },
              },
            ],
          },
        ],
      },
      data: { paymentStartedAt: startedAt },
      options: { atomic: true },
      req,
    });
    if (!claimed) throw refuse(req, "payment_in_progress");
    const client = stripe();
    let result: Awaited<ReturnType<PaymentAdapter["initiatePayment"]>>;
    let owned;
    try {
      await cancelEarlierPayments(req, client, cartID);
      result = await adapter.initiatePayment(args);
    } finally {
      owned = await req.payload.db.updateOne({
        collection: "carts",
        where: {
          and: [
            { id: { equals: cartID } },
            { paymentStartedAt: { equals: startedAt } },
          ],
        },
        data: { paymentStartedAt: null },
        options: { atomic: true },
        req,
      });
    }
    // A slow start lost its expired claim to a newer one, which may not have seen this payment.
    if (!owned) {
      await cancelIntent(client, result.paymentIntentID, "duplicate");
      await closeTransaction(req, result.paymentIntentID);
      throw refuse(req, "payment_in_progress");
    }
    return result;
  },
});
/** Returns the public order code when payment starts and when the order is confirmed. */
export const withOrderCode = (adapter: PaymentAdapter): PaymentAdapter => ({
  ...adapter,
  initiatePayment: async (args) => {
    const result = await adapter.initiatePayment(args);
    const {
      docs: [transaction],
    } = await args.req.payload.find({
      collection: "transactions",
      where: { "stripe.paymentIntentID": { equals: result.paymentIntentID } },
      select: { code: true },
      depth: 0,
      limit: 1,
      req: args.req,
    });
    return { ...result, orderCode: transaction?.code };
  },
  confirmOrder: async (args) => {
    let order: Record<string, unknown> | undefined;
    const result = await adapter.confirmOrder({
      ...args,
      finalizeOrder: async (input) => {
        // Stripe just confirmed the payment, so a webhook's processing or failed mark (SEPA, a declined first card) must not block the plugin's claim on pending.
        await args.req.payload.db.updateOne({
          collection: "transactions",
          where: {
            and: [
              { id: { equals: input.transactionID } },
              { status: { in: ["processing", "failed"] } },
              { order: { exists: false } },
            ],
          },
          data: { status: "pending" },
          options: { atomic: true },
          req: args.req,
        });
        order = await args.finalizeOrder(input);
        return order;
      },
    });
    return { ...result, orderCode: order?.code };
  },
});

const unsettledStatuses: Partial<
  Record<Stripe.PaymentIntent.Status, "processing" | "failed">
> = {
  processing: "processing",
  requires_payment_method: "failed",
  canceled: "failed",
};

/**
 * Mirrors a payment that is processing (SEPA takes days) or failed on its transaction
 * until an order exists. Stripe may deliver events late or twice, so the current
 * PaymentIntent decides, not the event; success is left to `confirmPaidOrder`.
 */
export async function syncPaymentStatus({
  event,
  req,
  stripe,
}: {
  event: Stripe.Event;
  req: PayloadRequest;
  stripe: Stripe;
}) {
  const intent = await stripe.paymentIntents.retrieve(
    (event.data.object as Stripe.PaymentIntent).id,
  );
  const status = unsettledStatuses[intent.status];
  if (!status) return;
  await req.payload.db.updateOne({
    collection: "transactions",
    where: {
      and: [
        { "stripe.paymentIntentID": { equals: intent.id } },
        { status: { in: ["pending", "processing", "failed"] } },
        { order: { exists: false } },
      ],
    },
    data: { status },
    options: { atomic: true },
    req,
  });
}

/** Creates the order when the buyer paid but never reached the return page. */
export async function confirmPaidOrder({
  event,
  req,
}: {
  event: Stripe.Event;
  req: PayloadRequest;
}) {
  if (event.type !== "payment_intent.succeeded") return;
  const paymentIntentID = event.data.object.id;
  const {
    docs: [transaction],
  } = await req.payload.find({
    collection: "transactions",
    where: { "stripe.paymentIntentID": { equals: paymentIntentID } },
    depth: 0,
    limit: 1,
    req,
  });
  if (!transaction || transaction.order || !transaction.cart) return;
  const cartID =
    typeof transaction.cart === "object"
      ? transaction.cart.id
      : transaction.cart;
  const { secret } = await req.payload.findByID({
    collection: "carts",
    id: cartID,
    depth: 0,
    select: { secret: true },
    overrideAccess: true,
    req,
  });
  // The plugin's confirm handler is not exported; its endpoint is idempotent, so the return page may confirm concurrently.
  const { serverURL, routes } = req.payload.config;
  const response = await fetch(
    `${serverURL}${routes.api}/payments/stripe/confirm-order`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cartID,
        secret,
        customerEmail: transaction.customerEmail,
        paymentIntentID,
      }),
    },
  );
  // Failing the webhook makes Stripe retry it later.
  if (!response.ok)
    throw new Error(`Order confirmation failed (${response.status}).`);
}
