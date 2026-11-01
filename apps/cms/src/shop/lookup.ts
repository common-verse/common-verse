import type { OrderLookup, OrderLookupStatus } from "@poetry/types";
import { createHash, timingSafeEqual } from "node:crypto";
import type { Endpoint, PayloadRequest } from "payload";
import { normalizeCode } from "./orderCode";

const sha256 = (value: string) => createHash("sha256").update(value).digest();
const same = (a: string, b: string) => timingSafeEqual(sha256(a), sha256(b));
const normalizeEmail = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const headers = { "Cache-Control": "no-store" };
const orderStatuses: Record<string, OrderLookupStatus> = {
  processing: "paid",
  shipped: "shipped",
  cancelled: "cancelled",
  refunded: "cancelled",
};
// Before Stripe confirms a payment there is only a transaction.
const transactionStatuses: Record<string, OrderLookupStatus> = {
  processing: "payment_processing",
  failed: "payment_failed",
};

async function findByCode(req: PayloadRequest, code: string) {
  const query = {
    depth: 0,
    limit: 1,
    pagination: false,
    select: {
      code: true,
      status: true,
      createdAt: true,
      items: true,
      amount: true,
      currency: true,
      customerEmail: true,
    },
    req,
  } as const;
  // Both queries run every time so a wrong email and a wrong code take the same path.
  const [
    {
      docs: [order],
    },
    {
      docs: [transaction],
    },
  ] = await Promise.all([
    req.payload.find({
      collection: "orders",
      where: { code: { equals: code } },
      ...query,
    }),
    req.payload.find({
      collection: "transactions",
      where: { code: { equals: code } },
      ...query,
    }),
  ]);
  if (order) return { ...order, status: orderStatuses[order.status ?? ""] };
  if (transaction)
    return { ...transaction, status: transactionStatuses[transaction.status] };
}

/** Order status for buyers by code and email. Astro calls it server-side and rate-limits it. */
export const orderLookup: Endpoint = {
  path: "/lookup",
  method: "post",
  handler: async (req) => {
    const secret = process.env.ORDER_LOOKUP_SECRET;
    if (
      !secret ||
      !same(req.headers.get("x-order-lookup-secret") ?? "", secret)
    )
      return Response.json({ error: "Unauthorized" }, { status: 401, headers });
    const body = await req.json?.().catch(() => null);
    const code = normalizeCode(body?.code);
    const email = normalizeEmail(body?.email);
    const doc = code && email ? await findByCode(req, code) : undefined;
    const matches = same(normalizeEmail(doc?.customerEmail), email);
    if (!doc?.code || !doc.status || !matches)
      return Response.json({ error: "Not found" }, { status: 404, headers });
    const items = doc.items ?? [];
    // Titles load only after the email matched, so timing does not reveal valid codes.
    const { docs: products } = await req.payload.find({
      collection: "products",
      where: { id: { in: items.map(({ product }) => product) } },
      select: { title: true },
      depth: 0,
      pagination: false,
      req,
    });
    const response: OrderLookup = {
      code: doc.code,
      status: doc.status,
      createdAt: doc.createdAt,
      items: items.map(({ product, quantity }) => ({
        title: products.find(({ id }) => id === product)?.title ?? null,
        quantity,
      })),
      amount: doc.amount ?? null,
      currency: doc.currency ?? null,
    };
    return Response.json(response, { headers });
  },
};
