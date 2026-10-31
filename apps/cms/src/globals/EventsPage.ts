import { label } from "@poetry/cms-ui";
import { isLocale, localizedPath } from "@poetry/i18n";
import type { GlobalConfig } from "payload";
import { authenticated } from "../collections/access";
import { publishedContent } from "./Homepage";

export function eventsPagePreviewUrl(locale = "de", editorLanguage = "en") {
  const secret = process.env.PREVIEW_SECRET;
  if (!secret || !isLocale(locale)) return null;
  const url = new URL(
    localizedPath(locale, "events"),
    process.env.PUBLIC_SITE_URL ?? "http://localhost:4321",
  );
  url.searchParams.set("previewSecret", secret);
  url.searchParams.set("editorLanguage", editorLanguage);
  return url.href;
}

export const EventsPage: GlobalConfig = {
  slug: "events-page",
  label: label("events_page"),
  admin: {
    group: label("pages"),
    preview: (_, { locale, req }) =>
      eventsPagePreviewUrl(locale, req.i18n.language),
    livePreview: {
      url: ({ locale, req }) =>
        eventsPagePreviewUrl(locale?.code, req.i18n.language),
    },
  },
  access: {
    read: authenticated,
    update: authenticated,
    readVersions: authenticated,
  },
  versions: { drafts: { autosave: { interval: 500 } }, max: 30 },
  endpoints: ["public", "preview"].map((mode) => ({
    path: `/${mode}`,
    method: "get",
    handler: async (req) => {
      const preview = mode === "preview";
      if (
        preview &&
        (!process.env.PREVIEW_SECRET ||
          req.headers.get("x-preview-secret") !== process.env.PREVIEW_SECRET)
      ) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }
      const locale =
        new URL(req.url ?? "", "http://localhost").searchParams.get("locale") ??
        "de";
      if (!isLocale(locale))
        return Response.json({ error: "Invalid locale" }, { status: 400 });
      const doc = await req.payload.findGlobal({
        slug: "events-page",
        locale,
        fallbackLocale: false,
        depth: 1,
        draft: preview,
        overrideAccess: true,
      });
      return Response.json(
        preview
          ? doc
          : doc._status === "published"
            ? publishedContent(doc)
            : null,
        { headers: { "Cache-Control": "no-store" } },
      );
    },
  })),
  fields: [
    {
      name: "heading",
      label: label("heading"),
      type: "text",
      localized: true,
      maxLength: 80,
    },
    {
      name: "introduction",
      maxLength: 180,
      admin: { description: label("events_introduction_limit") },
      label: label("introduction"),
      type: "textarea",
      localized: true,
    },
    {
      name: "featuredEvent",
      label: label("featured_event"),
      type: "relationship",
      relationTo: "events",
      admin: { description: label("events_feature_help") },
    },
    {
      name: "additionalFeaturedEvents",
      label: label("additional_featured_events"),
      type: "relationship",
      relationTo: "events",
      hasMany: true,
      maxRows: 4,
      admin: { description: label("additional_featured_events_help") },
    },
  ],
};
