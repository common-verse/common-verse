import { label, message } from "@poetry/cms-ui";
import { isLocale, localizedPath } from "@poetry/i18n";
import type { Block, Field, GlobalConfig, TextField } from "payload";
import { authenticated } from "../collections/access";

const text = (
  name: string,
  label: TextField["label"],
  type: "text" | "textarea" = "text",
): Field =>
  type === "textarea"
    ? { name, label, type: "textarea", localized: true }
    : { name, label, type: "text", localized: true };

export const validLink = (
  value: unknown,
  options?: { req?: { i18n?: { language?: string } } },
): true | string => {
  if (!value) return true;
  if (typeof value !== "string")
    return message(
      "enter_a_website_url_email_link_or_site_path",
      options?.req?.i18n?.language,
    );
  if (/^\/(?!\/)/.test(value) && !/[\\\s]/.test(value)) return true;
  try {
    const url = new URL(value);
    if (["https:", "http:", "mailto:"].includes(url.protocol)) return true;
  } catch {
    /* Invalid URL. */
  }
  return message(
    "use_https_mailto_or_a_path_beginning_with_one_slash",
    options?.req?.i18n?.language,
  );
};

/** Populated draft relationships must not escape through the anonymous homepage API. */
export function publishedContent(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(publishedContent).filter((entry) => entry !== null);
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  if (record._status === "draft") return null;
  return Object.fromEntries(
    Object.entries(record).map(([key, entry]) => [
      key,
      publishedContent(entry),
    ]),
  );
}

const linkFields: Field[] = [
  text("linkLabel", label("link_text")),
  {
    name: "linkUrl",
    type: "text",
    label: label("link_destination"),
    validate: validLink,
  },
];
const optionalFields: Field[] = [
  {
    name: "enabled",
    type: "checkbox",
    defaultValue: true,
    label: label("show_this_section"),
  },
  text("heading", label("heading")),
  text("description", label("introduction"), "textarea"),
];

const selectionMode: Field = {
  name: "selectionMode",
  type: "select",
  label: label("choose_content"),
  required: true,
  hooks: {
    afterRead: [
      ({ value, siblingData }) =>
        value ??
        (siblingData.authors?.length ||
        siblingData.pinnedEvents?.length ||
        siblingData.poems?.length
          ? "manual"
          : "auto"),
    ],
    beforeValidate: [
      ({ value, siblingData }) =>
        value ??
        (siblingData.authors?.length ||
        siblingData.pinnedEvents?.length ||
        siblingData.poems?.length
          ? "manual"
          : "auto"),
    ],
  },
  options: [
    { label: label("automatic"), value: "auto" },
    { label: label("select_manually"), value: "manual" },
  ],
};

const blocks: Block[] = [
  {
    slug: "featured",
    labels: { singular: label("featured"), plural: label("featured_sections") },
    admin: { disableBlockName: true },
    fields: [
      ...optionalFields,
      {
        name: "item",
        type: "relationship",
        label: label("item_to_feature"),
        relationTo: ["poems", "authors", "events"],
        required: true,
        admin: {
          description: label(
            "choose_a_poem_author_or_event_workshop_its_content_and_link_come_from_the_original_record",
          ),
        },
      },
    ],
  },
  {
    slug: "introduction",
    labels: { singular: label("mission"), plural: label("mission") },
    admin: { disableBlockName: true },
    fields: [
      text("heading", label("heading")),
      text("description", label("project_introduction"), "textarea"),
      {
        name: "image",
        label: label("image"),
        type: "upload",
        relationTo: "media",
      },
      ...linkFields,
    ],
  },
  {
    slug: "events",
    labels: { singular: label("events"), plural: label("events_sections") },
    admin: { disableBlockName: true },
    fields: [
      ...optionalFields,
      {
        ...selectionMode,
        admin: {
          description: label(
            "automatic_shows_the_four_nearest_upcoming_events_and_workshops_manual_shows_only_your_selection_in_order",
          ),
        },
      },
      {
        name: "pinnedEvents",
        label: label("events"),
        type: "relationship",
        relationTo: "events",
        hasMany: true,
        maxRows: 4,
        admin: {
          condition: (_, data) => data.selectionMode === "manual",
          description: label(
            "choose_up_to_four_past_draft_and_untranslated_events_are_omitted_on_the_public_site",
          ),
        },
      },
      // Existing homepages retain their stored limit until editors choose a mode.
      {
        name: "limit",
        type: "number",
        min: 1,
        max: 6,
        admin: { hidden: true },
      },
    ],
  },
  {
    slug: "poems",
    labels: { singular: label("poems"), plural: label("poem_sections") },
    admin: { disableBlockName: true },
    fields: [
      ...optionalFields,
      {
        ...selectionMode,
        admin: {
          description: label(
            "automatic_shows_the_four_most_recently_created_published_poems",
          ),
        },
      },
      {
        name: "poems",
        label: label("poems"),
        type: "relationship",
        relationTo: "poems",
        hasMany: true,
        maxRows: 4,
        admin: {
          condition: (_, data) => data.selectionMode === "manual",
          description: label("choose_up_to_four_poems_in_display_order"),
        },
      },
    ],
  },
  {
    slug: "authors",
    labels: { singular: label("authors"), plural: label("author_sections") },
    admin: { disableBlockName: true },
    fields: [
      ...optionalFields,
      {
        ...selectionMode,
        admin: {
          description: label(
            "automatic_shows_the_four_newest_profiles_with_published_poetry",
          ),
        },
      },
      {
        name: "authors",
        label: label("authors"),
        type: "relationship",
        relationTo: "authors",
        hasMany: true,
        maxRows: 4,
        admin: {
          condition: (_, data) => data.selectionMode === "manual",
          description: label("choose_up_to_four_authors_in_display_order"),
        },
      },
    ],
  },
  {
    slug: "participation",
    labels: {
      singular: label("take_part"),
      plural: label("participation_sections"),
    },
    fields: [
      ...optionalFields,
      {
        name: "links",
        label: label("links"),
        type: "array",
        maxRows: 3,
        labels: {
          singular: label("way_to_take_part"),
          plural: label("ways_to_take_part"),
        },
        fields: [
          text("title", label("title")),
          text("description", label("description"), "textarea"),
          {
            name: "url",
            label: label("url"),
            type: "text",
            required: true,
            validate: validLink,
          },
        ],
      },
    ],
  },
  {
    slug: "newsletter",
    labels: {
      singular: label("newsletter"),
      plural: label("newsletter_sections"),
    },
    fields: [...optionalFields, ...linkFields],
  },
];

export function homepagePreviewUrl(
  locale: string = "de",
  editorLanguage = "en",
) {
  const secret = process.env.PREVIEW_SECRET;
  if (!secret || !isLocale(locale)) return null;
  const url = new URL(
    localizedPath(locale),
    process.env.PUBLIC_SITE_URL ?? "http://localhost:4321",
  );
  url.searchParams.set("previewSecret", secret);
  url.searchParams.set("editorLanguage", editorLanguage);
  return url.href;
}

export const Homepage: GlobalConfig = {
  slug: "homepage",
  label: label("homepage"),
  admin: {
    group: label("pages"),
    description: label(
      "choose_the_hero_arrange_the_sections_and_preview_each_language_before_publishing",
    ),
    preview: (_, { locale, req }) =>
      homepagePreviewUrl(locale, req.i18n.language),
    livePreview: {
      url: ({ locale, req }) =>
        homepagePreviewUrl(locale?.code, req.i18n.language),
      // Payload accepts only plain strings here; dimensions work in every UI language.
      breakpoints: [
        { name: "mobile", label: "390 × 844", width: 390, height: 844 },
        { name: "tablet", label: "768 × 1024", width: 768, height: 1024 },
        { name: "desktop", label: "1440 × 900", width: 1440, height: 900 },
      ],
    },
  },
  access: {
    read: authenticated,
    update: authenticated,
    readVersions: authenticated,
  },
  versions: { drafts: { autosave: { interval: 500 } }, max: 30 },
  endpoints: [
    {
      path: "/public",
      method: "get",
      handler: async (req) => {
        const locale =
          new URL(req.url ?? "", "http://localhost").searchParams.get(
            "locale",
          ) ?? "de";
        if (!isLocale(locale))
          return Response.json({ error: "Invalid locale" }, { status: 400 });
        const doc = await req.payload.findGlobal({
          slug: "homepage",
          locale,
          fallbackLocale: false,
          depth: 2,
          draft: false,
          overrideAccess: true,
        });
        return Response.json(
          doc._status === "published" ? publishedContent(doc) : null,
        );
      },
    },
    {
      path: "/preview",
      method: "get",
      handler: async (req) => {
        if (
          !process.env.PREVIEW_SECRET ||
          req.headers.get("x-preview-secret") !== process.env.PREVIEW_SECRET
        )
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        const locale =
          new URL(req.url ?? "", "http://localhost").searchParams.get(
            "locale",
          ) ?? "de";
        if (!isLocale(locale))
          return Response.json({ error: "Invalid locale" }, { status: 400 });
        const doc = await req.payload.findGlobal({
          slug: "homepage",
          locale,
          fallbackLocale: false,
          depth: 2,
          draft: true,
          overrideAccess: true,
        });
        return Response.json(doc, { headers: { "Cache-Control": "no-store" } });
      },
    },
  ],
  fields: [
    {
      name: "feature",
      type: "group",
      label: label("hero"),
      fields: [
        {
          name: "kind",
          label: label("kind"),
          type: "select",
          defaultValue: "poem",
          required: true,
          options: [
            { label: label("poem"), value: "poem" },
            { label: label("event_or_workshop"), value: "event" },
            { label: label("project_announcement"), value: "announcement" },
          ],
        },
        text("heading", label("homepage_headline")),
        text("description", label("short_introduction"), "textarea"),
        {
          name: "poem",
          label: label("poem"),
          type: "relationship",
          relationTo: "poems",
          admin: { condition: (_, data) => data.kind === "poem" },
        },
        {
          name: "event",
          label: label("event"),
          type: "relationship",
          relationTo: "events",
          admin: { condition: (_, data) => data.kind === "event" },
        },
        {
          name: "announcement",
          label: label("announcement"),
          type: "group",
          admin: { condition: (_, data) => data.kind === "announcement" },
          fields: [
            text("title", label("announcement_title")),
            text("text", label("announcement"), "textarea"),
            {
              name: "image",
              label: label("image"),
              type: "upload",
              relationTo: "media",
            },
            ...linkFields,
          ],
        },
      ],
    },
    {
      name: "sections",
      labels: { singular: label("section"), plural: label("sections") },
      label: label("sections"),
      type: "blocks",
      blocks,
      maxRows: 10,
      admin: {
        initCollapsed: true,
        description: label("sections_appear_on_the_page_in_this_order"),
      },
      defaultValue: [
        { blockType: "introduction" },
        { blockType: "authors", enabled: true, selectionMode: "auto" },
        { blockType: "poems", enabled: true, selectionMode: "auto" },
        { blockType: "events", enabled: true, selectionMode: "auto" },
        { blockType: "participation", enabled: true },
        { blockType: "newsletter", enabled: true },
      ],
    },
    {
      name: "seo",
      type: "group",
      label: label("search_and_social_sharing"),
      fields: [
        text("title", label("page_title")),
        {
          name: "description",
          label: label("meta_description"),
          type: "textarea",
          localized: true,
          admin: { description: label("meta_description_help") },
        },
        {
          name: "image",
          type: "upload",
          relationTo: "media",
          label: label("social_image"),
        },
      ],
    },
  ],
};
