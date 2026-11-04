import type { Endpoint } from "payload";
import { isLocale, localizedPath, slugLocale } from "@poetry/i18n";

type PreviewCollection = "events" | "poems" | "articles";
// Collections whose slug is a `{ de, en }` group from `localeSlugField`.
const localeSlugCollections: PreviewCollection[] = ["events"];

export function collectionPreviewUrl(
  collection: PreviewCollection,
  slug: unknown,
  locale = "de",
  editorLanguage = "en",
) {
  const secret = process.env.PREVIEW_SECRET;
  if (!secret || !isLocale(locale)) return null;
  const value = localeSlugCollections.includes(collection)
    ? (slug as Record<string, unknown> | null | undefined)?.[slugLocale(locale)]
    : slug;
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
      const locale = url.searchParams.get("locale") ?? "de";
      if (!isLocale(locale))
        return Response.json({ error: "Invalid locale" }, { status: 400 });
      if (!slug)
        return Response.json({ error: "Missing slug" }, { status: 400 });

      const result = await req.payload.find({
        collection,
        where: {
          [localeSlugCollections.includes(collection)
            ? `slug.${slugLocale(locale)}`
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
