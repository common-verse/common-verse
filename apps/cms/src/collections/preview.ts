import type { Endpoint } from "payload";
import { isLocale, localizedPath, slugField } from "@poetry/i18n";

type PreviewCollection = "events" | "poems" | "articles";
// Collections with `slugDe`/`slugEn` from `localeSlugField`.
const localeSlugCollections: PreviewCollection[] = ["events"];

export function collectionPreviewUrl(
  collection: PreviewCollection,
  doc: Record<string, unknown> | null | undefined,
  locale = "de",
  editorLanguage = "en",
) {
  const secret = process.env.PREVIEW_SECRET;
  if (!secret || !isLocale(locale)) return null;
  const value =
    doc?.[
      localeSlugCollections.includes(collection) ? slugField(locale) : "slug"
    ];
  if (typeof value !== "string" || !value) return null;
  const url = new URL(
    localizedPath(locale, `${collection}/${value}`),
    process.env.PUBLIC_SITE_URL ?? "http://localhost:4321",
  );
  url.searchParams.set("previewSecret", secret);
  url.searchParams.set("editorLanguage", editorLanguage);
  return url.href;
}

export function previewEndpoint(collection: PreviewCollection): Endpoint {
  return {
    path: "/preview",
    method: "get",
    handler: async (req) => {
      if (
        !process.env.PREVIEW_SECRET ||
        req.headers.get("x-preview-secret") !== process.env.PREVIEW_SECRET
      ) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      const url = new URL(req.url ?? "", "http://localhost");
      const slug = url.searchParams.get("slug");
      // By ID, a record found by one locale's slug loads in the other locales.
      const id = url.searchParams.get("id");
      const locale = url.searchParams.get("locale") ?? "de";
      if (!isLocale(locale))
        return Response.json({ error: "Invalid locale" }, { status: 400 });
      if (!slug && !id)
        return Response.json({ error: "Missing slug" }, { status: 400 });

      const result = await req.payload.find({
        collection,
        where: id
          ? { id: { equals: id } }
          : {
              [localeSlugCollections.includes(collection)
                ? slugField(locale)
                : "slug"]: { equals: slug },
            },
        locale,
        fallbackLocale: false,
        draft: true,
        overrideAccess: true,
        depth: 2,
        limit: 1,
      });

      return Response.json(result, {
        headers: { "Cache-Control": "no-store" },
      });
    },
  };
}
