import { label } from "@poetry/cms-ui";
import type { CollectionConfig, FieldHook } from "payload";
import { authenticated, publishedOrAuthenticated } from "./access";
import { languageOptions } from "./languageOptions";
import { collectionPreviewUrl, previewEndpoint } from "./preview";
import { requiredInLocale } from "./requiredInLocale";
import { localeSlugField } from "./slug";

const requiredInOriginal = (field: string) =>
  requiredInLocale(
    field,
    (data) => data.originalLanguage,
    "poem_required_in_original",
  );

/** Translators credit translations; the original has none. */
export const translatorOutsideOriginal: FieldHook = ({
  value,
  siblingData,
  req,
}) => (siblingData?.originalLanguage === req.locale ? null : value);

export const Poems: CollectionConfig = {
  slug: "poems",
  labels: { singular: label("poem"), plural: label("poems") },
  admin: {
    useAsTitle: "title",
    group: label("content"),
    defaultColumns: ["title", "author", "originalLanguage", "_status"],
    preview: (doc, { locale, req }) =>
      collectionPreviewUrl("poems", doc, locale, req.i18n.language),
    livePreview: {
      url: ({ data, locale, req }) =>
        collectionPreviewUrl("poems", data, locale?.code, req.i18n.language),
    },
  },
  access: {
    read: publishedOrAuthenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
    readVersions: authenticated,
  },
  endpoints: [previewEndpoint("poems")],
  versions: { drafts: { autosave: { interval: 375 } } },
  fields: [
    {
      name: "title",
      label: label("title"),
      type: "text",
      localized: true,
      validate: requiredInOriginal("title"),
    },
    localeSlugField("title"),
    {
      name: "originalLanguage",
      label: label("original_language"),
      type: "select",
      required: true,
      options: languageOptions,
    },
    {
      name: "author",
      label: label("author"),
      type: "relationship",
      relationTo: "authors",
      required: true,
    },
    {
      name: "year",
      label: label("year_written"),
      type: "number",
      min: 1000,
      max: 9999,
    },
    {
      name: "content",
      label: label("text"),
      type: "textarea",
      localized: true,
      validate: requiredInOriginal("content"),
    },
    {
      name: "translator",
      label: label("translator"),
      type: "text",
      localized: true,
      hooks: { afterRead: [translatorOutsideOriginal] },
      admin: {
        components: { Field: "./components/ContentField#TranslatorText" },
      },
    },
    {
      name: "description",
      label: label("description"),
      type: "textarea",
      localized: true,
    },
    {
      name: "snippet",
      label: label("snippet"),
      type: "textarea",
      localized: true,
      admin: { description: label("snippet_help") },
    },
  ],
};
