import { label, message } from "@poetry/cms-ui";
import type {
  CollectionSlug,
  FieldHook,
  RowField,
  TextField,
  TextFieldSingleValidation,
} from "payload";
import { text } from "payload/shared";

export const validPublicSlug: TextFieldSingleValidation = async (
  value,
  options,
) => {
  const validation = await text(value, options);
  if (validation !== true) return validation;
  // Preserve existing URLs, including legacy non-ASCII slugs, unless explicitly changed.
  if (value === options.previousValue || /^[A-Za-z0-9_-]+$/.test(value ?? ""))
    return true;
  return message("slug_format", options.req.i18n.language);
};

const umlauts: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };

/** "Über den Fluss" → "ueber-den-fluss"; scripts without Latin letters yield "". */
export const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[äöüß]/g, (letter) => umlauts[letter])
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

type Slot = "slugDe" | "slugEn";
type Slugs = Partial<Record<Slot, string | null>>;

const filled = (slugs: Slugs | undefined, title: unknown) => {
  const slugDe =
    slugs?.slugDe || (typeof title === "string" && slugify(title)) || null;
  return { slugDe, slugEn: slugs?.slugEn || slugDe };
};

// The source may be localized: only its German value names the German slug.
const germanTitle = (
  data: Record<string, unknown> | undefined,
  source: string,
  locale: string | undefined,
) => (locale === "de" ? data?.[source] : undefined);

// Draft saves only write versions; the main row changes on publish, so its status tells.
const neverPublished: FieldHook = async ({ collection, originalDoc, req }) => {
  if (!collection?.versions?.drafts || !originalDoc?.id) return false;
  const stored = await req.payload.db.findOne<{ id: number; _status?: string }>(
    {
      collection: collection.slug,
      where: { id: { equals: originalDoc.id } },
      select: { _status: true },
      req,
    },
  );
  return stored?._status !== "published";
};

// Each slot's hook resolves both slots and keeps its own; the result is the same in either order.
const resolve =
  (name: Slot, source: string): FieldHook =>
  async (args) => {
    const { siblingData, data, originalDoc, req } = args;
    const stored: Slugs = originalDoc ?? {};
    const sent = (slot: Slot) =>
      siblingData?.[slot] === undefined ? stored[slot] : siblingData[slot];
    const slugs: Slugs = { slugDe: sent("slugDe"), slugEn: sent("slugEn") };
    const title = germanTitle(data, source, req.locale);
    if (typeof title === "string" && (await neverPublished(args))) {
      const previousTitle = germanTitle(originalDoc, source, req.locale);
      if (slugs.slugEn === stored.slugDe) slugs.slugEn = null;
      if (
        typeof previousTitle === "string" &&
        slugs.slugDe === slugify(previousTitle)
      )
        slugs.slugDe = null;
    }
    return filled(slugs, title)[name];
  };

const slot = (name: Slot, source: string): TextField => {
  const key = name === "slugDe" ? "slug_de" : "slug_en";
  return {
    name,
    type: "text",
    label: label(key),
    admin: { description: label(`${key}_help`) },
    unique: true,
    index: true,
    hooks: { beforeValidate: [resolve(name, source)] },
    // Validates the value publishing will save, because the admin form validates before hooks run.
    validate: (async (
      _value,
      { collectionSlug, data, event, id, previousValue, req, siblingData },
    ) => {
      const value = filled(
        siblingData as Slugs,
        germanTitle(data as Record<string, unknown>, source, req.locale),
      )[name];
      const language = req.i18n.language;
      if (value && value === previousValue) return true;
      if (!value || !/^[a-z0-9-]+$/.test(value))
        return message("slug_ascii_format", language);
      if (event === "onChange") return true;
      const { totalDocs } = await req.payload.count({
        collection: collectionSlug as CollectionSlug,
        where: {
          [name]: { equals: value },
          ...(id === undefined ? {} : { id: { not_equals: id } }),
        },
        req,
      });
      return totalDocs ? message("slug_taken", language) : true;
    }) satisfies TextFieldSingleValidation,
  };
};

/**
 * Top-level `slugDe` for the German site and `slugEn` for every other locale.
 * Not a `slug: { de, en }` group: Payload reads `slug.de` in a query as a locale suffix.
 * Empty slots are filled on save: German from the German `source`, English from German.
 * Until the first publish, slots not edited by hand follow the German title.
 */
export const localeSlugField = (source: string): RowField => ({
  type: "row",
  fields: [slot("slugDe", source), slot("slugEn", source)],
});
