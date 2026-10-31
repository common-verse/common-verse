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
import { confirmPaidOrder, withFlatShipping } from "./payments";

const nobody: Access = () => false;

const inShop = (
  collection: CollectionConfig,
  admin: CollectionConfig["admin"] = {},
): CollectionConfig => ({
  ...collection,
  admin: { ...collection.admin, group: label("shop"), ...admin },
});

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
        defaultColumns: ["createdAt", "customerEmail", "amount", "status"],
      }),
      access: {
        ...defaultCollection.access,
        read: authenticated,
        update: authenticated,
      },
    }),
  },
  transactions: {
    transactionsCollectionOverride: ({ defaultCollection }) =>
      inShop(defaultCollection, administratorsOnly),
  },
  payments: {
    paymentMethods: [
      withFlatShipping(
        stripeAdapter({
          // Without a key the CMS still boots; initiating a payment fails.
          secretKey: process.env.STRIPE_SECRET_KEY ?? "",
          // Required by the adapter's type but only used by browser clients.
          publishableKey: "",
          webhookSecret: process.env.STRIPE_WEBHOOKS_SIGNING_SECRET,
          // The adapter's defaults differ between initiate and confirm; pin the installed SDK's version.
          apiVersion: "2025-08-27.basil",
          webhooks: { "payment_intent.succeeded": confirmPaidOrder },
        }),
      ),
    ],
  },
});
