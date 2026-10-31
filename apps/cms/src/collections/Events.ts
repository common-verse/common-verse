import { eventLocationField } from "./locationField";
import { label } from "@poetry/cms-ui";
import { slugField, type CollectionConfig } from "payload";
import { eventEditor } from "../utilities/proseEditor";
import { authenticated, publishedOrAuthenticated } from "./access";
import { collectionPreviewUrl, previewEndpoint } from "./preview";

export const Events: CollectionConfig = {
  slug: "events",
  labels: { singular: label("event"), plural: label("events") },
  admin: {
    useAsTitle: "title",
    group: label("content"),
    defaultColumns: ["title", "startDate", "_status", "updatedAt"],
    description: label("events_help"),
    preview: (doc, { locale, req }) =>
      collectionPreviewUrl("events", doc.slug, locale, req.i18n.language),
    livePreview: {
      url: ({ data, locale, req }) =>
        collectionPreviewUrl(
          "events",
          data.slug,
          locale?.code,
          req.i18n.language,
        ),
    },
  },
  access: {
    read: publishedOrAuthenticated,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
    readVersions: authenticated,
  },
  endpoints: [previewEndpoint("events")],
  versions: { drafts: { autosave: { interval: 375 } } },
  fields: [
    {
      name: "title",
      maxLength: 80,
      admin: { description: label("event_title_limit") },
      label: label("title"),
      type: "text",
      localized: true,
      required: true,
    },
    slugField(),
    {
      name: "description",
      maxLength: 160,
      admin: { description: label("event_description_limit") },
      label: label("description"),
      type: "text",
      localized: true,
      required: true,
    },
    {
      name: "registrationUrl",
      type: "text",
      label: label("registration_url"),
      required: true,
    },
    {
      name: "image",
      label: label("event_cover_image"),
      type: "upload",
      relationTo: "media",
      required: true,
    },
    {
      name: "startDate",
      label: label("date_and_time"),
      type: "date",
      required: true,
      admin: { date: { pickerAppearance: "dayAndTime" } },
    },
    eventLocationField(),
    {
      name: "content",
      label: label("content"),
      type: "richText",
      localized: true,
      required: true,
      editor: eventEditor,
      admin: {
        className: "event-editor-content",
        components: {
          beforeInput: ["./components/EventFields#EditorAccessibility"],
        },
      },
    },
  ],
};
