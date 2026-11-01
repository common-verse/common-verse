import { ecommercePlugin } from "@payloadcms/plugin-ecommerce";
import { stripeAdapter } from "@payloadcms/plugin-ecommerce/payments/stripe";
import { label } from "@poetry/cms-ui";
import type { Access, CollectionConfig } from "payload";
import {
  administrator,
  authenticated,
  isAdministrator,
} from "../collections/access";
import { currencies, products } from "../collections/Products";
import { orderLookup } from "./lookup";
import { codeField } from "./orderCode";
import {
  confirmPaidOrder,
  syncPaymentStatus,
  withFlatShipping,
  withOrderCode,
} from "./payments";

const nobody: Access = () => false;

const inShop = (
  collection: CollectionConfig,
  admin: CollectionConfig["admin"] = {},
): CollectionConfig => ({
  ...collection,
  admin: { ...collection.admin, group: label("shop"), ...admin },
});

const orderStatuses: Record<
  string,
  { label: Record<string, string>; value: string }
> = {
  processing: { label: label("paid"), value: "processing" },
  completed: { label: label("shipped"), value: "shipped" },
};

const administratorsOnly: CollectionConfig["admin"] = {
  hidden: ({ user }) => user?.role !== "admin",
};

export const shop = ecommercePlugin({
  // Guest checkout only: users are a relationship target, never customers.
  customers: { slug: "users" },
  access: {
    isAdmin: administrator,
    isAuthenticated: administrator,
    isDocumentOwner: nobody,
    isCustomer: () => false,
    adminOnlyFieldAccess: ({ req }) => isAdministrator(req),
    // Only products use this, and they have no drafts.
    adminOrPublishedStatus: () => true,
  },
  currencies,
  products: { variants: false, productsCollectionOverride: products },
  carts: {
    allowGuestCarts: true,
    cartsCollectionOverride: ({ defaultCollection }) => ({
      ...inShop(defaultCollection, administratorsOnly),
      // shortcut: Stripe metadata values hold about 7 cart lines (GH #19017); lift when the plugin stores snapshots elsewhere.
      fields: defaultCollection.fields.map((field) =>
        "name" in field && field.name === "items" && field.type === "array"
          ? { ...field, maxRows: 7 }
          : field,
      ),
    }),
  },
  orders: {
    ordersCollectionOverride: ({ defaultCollection }) => ({
      ...inShop(defaultCollection, {
        useAsTitle: "code",
        defaultColumns: [
          "code",
          "createdAt",
          "customerEmail",
          "amount",
          "status",
        ],
      }),
      access: {
        ...defaultCollection.access,
        read: authenticated,
        update: authenticated,
      },
      // Orders exist only once paid, so the plugin's processing means paid; editors move them to shipped.
      fields: [
        ...defaultCollection.fields.map((field) =>
          "name" in field && field.name === "status" && field.type === "select"
            ? {
                ...field,
                options: field.options.map(
                  (option) =>
                    (typeof option === "object" &&
                      orderStatuses[option.value]) ||
                    option,
                ),
              }
            : field,
        ),
        codeField("orders"),
      ],
      endpoints: [...(defaultCollection.endpoints || []), orderLookup],
    }),
  },
  transactions: {
    transactionsCollectionOverride: ({ defaultCollection }) => ({
      ...inShop(defaultCollection, administratorsOnly),
      fields: [...defaultCollection.fields, codeField("transactions")],
    }),
  },
  payments: {
    paymentMethods: [
      withOrderCode(
        withFlatShipping(
          stripeAdapter({
            // Without a key the CMS still boots; initiating a payment fails.
            secretKey: process.env.STRIPE_SECRET_KEY ?? "",
            // Required by the adapter's type but only used by browser clients.
            publishableKey: "",
            webhookSecret: process.env.STRIPE_WEBHOOKS_SIGNING_SECRET,
            // The adapter's defaults differ between initiate and confirm; pin the installed SDK's version.
            apiVersion: "2025-08-27.basil",
            webhooks: {
              "payment_intent.processing": syncPaymentStatus,
              "payment_intent.payment_failed": syncPaymentStatus,
              "payment_intent.succeeded": confirmPaidOrder,
            },
          }),
        ),
      ),
    ],
  },
});
