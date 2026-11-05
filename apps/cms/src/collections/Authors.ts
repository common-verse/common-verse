import { label, message } from "@poetry/cms-ui";
import type {
  CollectionConfig,
  FilterOptions,
  TextFieldSingleValidation,
} from "payload";
import { authenticated, isEditor, publishedOrAuthenticated } from "./access";
import { countryField } from "./countries";
import { collectionPreviewUrl, previewEndpoint } from "./preview";
import { requiredInLocale } from "./requiredInLocale";
import { localeSlugField } from "./slug";

const germanNameRequired = requiredInLocale(
  "name",
  () => "de",
  "author_name_required",
);

export const validAuthorName: TextFieldSingleValidation = (value, options) =>
  options.req.locale === "de" &&
  value &&
  /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(value)
    ? message("author_name_latin", options.req.i18n.language)
    : germanNameRequired(value, options);

export const cityInCountry: Extract<FilterOptions, Function> = ({ data }) =>
  data?.country ? { country: { equals: data.country } } : false;

export const Authors: CollectionConfig = {
  slug: "authors",
  labels: { singular: label("author"), plural: label("authors") },
  admin: {
    useAsTitle: "name",
    group: label("content"),
    defaultColumns: ["name", "country", "_status", "updatedAt"],
    description: label("authors_help"),
    preview: (doc, { locale, req }) =>
      collectionPreviewUrl("authors", doc, locale, req.i18n.language),
    livePreview: {
      url: ({ data, locale, req }) =>
        collectionPreviewUrl("authors", data, locale?.code, req.i18n.language),
    },
  },
  access: {
    read: publishedOrAuthenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
    readVersions: authenticated,
  },
  endpoints: [previewEndpoint("authors")],
  versions: { drafts: { autosave: { interval: 375 } } },
  fields: [
    {
      name: "name",
      type: "text",
      localized: true,
      label: label("name"),
      admin: { description: label("author_name_help") },
      validate: validAuthorName,
    },
    localeSlugField("name"),
    {
      name: "portrait",
      label: label("portrait"),
      type: "upload",
      relationTo: "media",
    },
    countryField,
    {
      name: "city",
      label: label("city"),
      type: "relationship",
      relationTo: "cities",
      filterOptions: cityInCountry,
      admin: { components: { Field: "./components/CityField#CityField" } },
    },
    {
      name: "biography",
      label: label("biography"),
      type: "textarea",
      localized: true,
    },
    {
      name: "awards",
      label: label("awards"),
      type: "array",
      labels: { singular: label("award"), plural: label("awards") },
      fields: [
        {
          name: "name",
          label: label("award_name"),
          type: "text",
          required: true,
        },
        {
          name: "year",
          label: label("year"),
          type: "number",
          required: true,
          min: 1000,
          max: 9999,
        },
      ],
    },
    {
      name: "poems",
      label: label("poems_by_author"),
      type: "join",
      collection: "poems",
      on: "author",
      access: { read: ({ req }) => isEditor(req) },
      admin: { defaultColumns: ["title", "originalLanguage", "_status"] },
    },
  ],
};
