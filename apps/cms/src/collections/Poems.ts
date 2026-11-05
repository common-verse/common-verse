import { validPublicSlug } from "./slug";
import { label } from "@poetry/cms-ui";
import type { CollectionConfig } from "payload";
import { authenticated, publishedOrAuthenticated } from "./access";
import { languageOptions } from "./languageOptions";
import { collectionPreviewUrl, previewEndpoint } from "./preview";

export const Poems: CollectionConfig = {
  slug: "poems",
  labels: { singular: label("poem"), plural: label("poems") },

  admin: {
    hidden: true,
    useAsTitle: "title",
    group: label("content"),
    description: label(
      "keep_the_original_poem_intact_and_add_only_the_translations_that_actually_exist",
    ),
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
      type: "text",
      required: true,
      label: label("original_title"),
      custom: { languageField: "originalLanguage" },
    },
    {
      name: "slug",
      validate: validPublicSlug,
      label: label("slug"),
      type: "text",
      required: true,
      unique: true,
      index: true,
    },
    {
      name: "originalLanguage",
      label: label("original_language"),
      type: "select",
      required: true,
      options: languageOptions,
    },
    {
      name: "originalLanguageLabel",
      label: label("original_language_label"),
      type: "text",
      admin: {
        condition: (_, siblingData) => siblingData.originalLanguage === "other",
      },
    },
    {
      name: "originalText",
      label: label("original_text"),
      custom: { languageField: "originalLanguage" },
      type: "textarea",
      required: true,
    },
    {
      name: "author",
      label: label("author"),
      type: "relationship",
      relationTo: "authors",
      required: true,
      admin: { description: label("poem_author_help") },
    },
    {
      name: "media",
      label: label("media"),
      type: "upload",
      relationTo: "media",
      hasMany: true,
    },
    {
      name: "translations",
      label: label("translations"),
      type: "array",
      labels: {
        singular: label("translation"),
        plural: label("available_translations"),
      },
      fields: [
        {
          name: "language",
          label: label("language"),
          type: "select",
          required: true,
          options: languageOptions,
        },
        {
          name: "languageLabel",
          label: label("language_label"),
          type: "text",
          admin: {
            condition: (_, siblingData) => siblingData.language === "other",
          },
        },
        {
          name: "title",
          custom: { languageField: "language" },
          label: label("title"),
          type: "text",
          required: true,
        },
        {
          name: "text",
          custom: { languageField: "language" },
          label: label("text"),
          type: "textarea",
          required: true,
        },
        { name: "translator", label: label("translator"), type: "text" },
      ],
    },
  ],
};
