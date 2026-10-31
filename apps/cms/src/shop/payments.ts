import type { PaymentAdapter } from "@payloadcms/plugin-ecommerce/types";
import { randomBytes } from "node:crypto";
import type { PayloadRequest } from "payload";
import type { Stripe } from "stripe";

/** Adds the editor-set Germany rate before the adapter creates the PaymentIntent. */
export const withFlatShipping = (adapter: PaymentAdapter): PaymentAdapter => ({
  ...adapter,
  initiatePayment: async (args) => {
    if (args.data.shippingAddress?.country !== "DE")
      throw new Error("Shipping is limited to Germany.");
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
