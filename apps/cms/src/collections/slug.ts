import { label, message } from "@poetry/cms-ui";
import type {
  CollectionSlug,
  FieldHook,
  NamedGroupField,
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

type Slugs = { de?: string | null; en?: string | null };

const filled = (slug: Slugs | undefined, title: unknown) => {
  const de = slug?.de || (typeof title === "string" && slugify(title)) || null;
  return { de, en: slug?.en || de };
};

// The source may be localized: only its German value names the German slug.
const germanTitle = (
  data: Record<string, unknown> | undefined,
  source: string,
  locale: string | undefined,
) => (locale === "de" ? data?.[source] : undefined);

const slot = (name: "de" | "en", source: string): TextField => ({
  name,
  type: "text",
  label: label(`slug_${name}`),
  admin: { description: label(`slug_${name}_help`) },
  unique: true,
  index: true,
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
        [`slug.${name}`]: { equals: value },
        ...(id === undefined ? {} : { id: { not_equals: id } }),
      },
      req,
    });
    return totalDocs ? message("slug_taken", language) : true;
  }) satisfies TextFieldSingleValidation,
});

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

/**
 * German slug for the `de` locale, English slug for all others.
 * Empty slots are filled on save: German from the German `source`, English from German.
 * Until the first publish, slots not edited by hand follow the German title.
 */
export const localeSlugField = (source: string): NamedGroupField => ({
  name: "slug",
  type: "group",
  label: label("slug"),
  hooks: {
    beforeValidate: [
      async (args) => {
        const { value, previousValue, data, originalDoc, req } = args;
        const slug: Slugs = { ...previousValue, ...value };
        const title = germanTitle(data, source, req.locale);
        if (typeof title === "string" && (await neverPublished(args))) {
          const previousTitle = germanTitle(originalDoc, source, req.locale);
          if (slug.en === previousValue?.de) slug.en = null;
          if (
            typeof previousTitle === "string" &&
            slug.de === slugify(previousTitle)
          )
            slug.de = null;
        }
        return filled(slug, title);
      },
    ],
  },
  fields: [slot("de", source), slot("en", source)],
});
