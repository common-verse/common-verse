import { amountField, EUR } from "@payloadcms/plugin-ecommerce";
import type {
  CollectionOverride,
  CurrenciesConfig,
} from "@payloadcms/plugin-ecommerce/types";
import { label, message } from "@poetry/cms-ui";
import { slugField, type Field, type TextFieldSingleValidation } from "payload";
import { contentFields } from "../components/contentFields";
import { proseEditor } from "../utilities/proseEditor";
import { authenticated } from "./access";
import { languageOptions } from "./languageOptions";
import { validPublicSlug } from "./slug";

export const currencies: CurrenciesConfig = {
  defaultCurrency: "EUR",
  supportedCurrencies: [EUR],
};

/** A euro amount stored in cents with the plugin's native price input. */
export const euroField = (
  name: string,
  labelKey: "price" | "shipping_rate",
  descriptionKey: "price_help" | "shipping_rate_help",
) =>
  amountField({
    currenciesConfig: currencies,
    currency: EUR,
    overrides: {
      name,
      label: label(labelKey),
      required: true,
      admin: { description: label(descriptionKey) },
    },
  });

// These segments are shop routes beside product pages.
const reservedSlugs = ["cart", "checkout"];

export const validProductSlug: TextFieldSingleValidation = (value, options) =>
  reservedSlugs.includes(value ?? "")
    ? message("slug_reserved", options.req.i18n.language)
    : validPublicSlug(value, options);

export const products: CollectionOverride = ({ defaultCollection }) => {
  const inventory = defaultCollection.fields.find(
    (field) => "name" in field && field.name === "inventory",
  ) as Extract<Field, { type: "number" }>;
  return {
    ...defaultCollection,
    admin: {
      ...defaultCollection.admin,
      useAsTitle: "title",
      group: label("shop"),
      defaultColumns: ["title", "priceInEUR", "inventory", "updatedAt"],
    },
    access: {
      ...defaultCollection.access,
      create: authenticated,
      update: authenticated,
      delete: authenticated,
    },
    // Inventory decrements skip version tables, so drafts would show and restore stale stock.
    versions: false,
    fields: contentFields([
      {
        name: "title",
        label: label("title"),
        type: "text",
        required: true,
        custom: { languageField: "titleLanguage" },
      },
      {
        name: "titleLanguage",
        label: label("title_language"),
        type: "select",
        options: languageOptions,
      },
      slugField({
        overrides: (row) => {
          for (const field of row.fields)
            if (field.type === "text") field.validate = validProductSlug;
          return row;
        },
      }),
      {
        name: "image",
        label: label("book_cover"),
        type: "upload",
        relationTo: "media",
        required: true,
      },
      {
        name: "description",
        label: label("description"),
        type: "richText",
        localized: true,
        editor: proseEditor,
      },
      {
        type: "row",
        fields: [
          euroField("priceInEUR", "price", "price_help"),
          {
            ...inventory,
            admin: { ...inventory.admin, description: label("inventory_help") },
          },
        ],
      },
      {
        type: "row",
        fields: [
          { name: "isbn", label: label("isbn"), type: "text" },
          { name: "pages", label: label("page_count"), type: "number", min: 1 },
        ],
      },
      {
        type: "row",
        fields: [
          { name: "publisher", label: label("publisher"), type: "text" },
          { name: "year", label: label("publication_year"), type: "number" },
        ],
      },
    ]),
  };
};
