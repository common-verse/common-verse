import { label } from "@poetry/cms-ui";
import { proseEditor } from "../utilities/proseEditor";
import type { CollectionConfig } from "payload";
import { authenticated, publishedOrAuthenticated } from "./access";
import { collectionPreviewUrl, previewEndpoint } from "./preview";
import { validPublicSlug } from "./slug";

export const Articles: CollectionConfig = {
  slug: "articles",
  labels: { singular: label("article"), plural: label("articles") },
  admin: {
    useAsTitle: "title",
    group: label("content"),
    defaultColumns: ["title", "publishedAt", "_status", "updatedAt"],
    preview: (doc, { locale, req }) =>
      collectionPreviewUrl("articles", doc, locale, req.i18n.language),
    livePreview: {
      url: ({ data, locale, req }) =>
        collectionPreviewUrl("articles", data, locale?.code, req.i18n.language),
    },
  },
  access: {
    read: publishedOrAuthenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
    readVersions: authenticated,
  },
  endpoints: [previewEndpoint("articles")],
  versions: { drafts: { autosave: { interval: 500 } } },
  fields: [
    {
      name: "title",
      label: label("title"),
      type: "text",
      localized: true,
      required: true,
    },
    {
      name: "slug",
      label: label("slug"),
      type: "text",
      required: true,
      unique: true,
      index: true,
      validate: validPublicSlug,
    },
    {
      name: "description",
      label: label("description"),
      type: "textarea",
      localized: true,
    },
    {
      name: "content",
      label: label("content"),
      type: "richText",
      localized: true,
      required: true,
      editor: proseEditor,
    },
    {
      name: "image",
      label: label("image"),
      type: "upload",
      relationTo: "media",
    },
    {
      name: "publishedAt",
      label: label("publication_date"),
      type: "date",
      admin: { date: { pickerAppearance: "dayOnly" } },
    },
    {
      name: "seo",
      label: label("search_and_social_sharing"),
      type: "group",
      fields: [
        {
          name: "title",
          label: label("seo_title"),
          type: "text",
          localized: true,
        },
        {
          name: "description",
          label: label("meta_description"),
          type: "textarea",
          localized: true,
          admin: { description: label("meta_description_help") },
        },
        {
          name: "noIndex",
          label: label("hide_from_search_engines"),
          type: "checkbox",
          defaultValue: false,
        },
      ],
    },
  ],
};
