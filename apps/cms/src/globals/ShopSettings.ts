import { label } from "@poetry/cms-ui";
import type { GlobalConfig } from "payload";
import { authenticated } from "../collections/access";
import { euroField } from "../collections/Products";

export const ShopSettings: GlobalConfig = {
  slug: "shop-settings",
  label: label("shop_settings"),
  admin: { group: label("shop") },
  access: { read: () => true, update: authenticated },
  fields: [
    euroField("shippingRate", "shipping_rate", "shipping_rate_help"),
    {
      name: "priceNote",
      label: label("price_note"),
      type: "text",
      localized: true,
      admin: { description: label("price_note_help") },
    },
  ],
};
