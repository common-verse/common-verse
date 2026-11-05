import { locales, localizedPath, recordPath, type Locale } from "@poetry/i18n";
import type { Author, Poem } from "@poetry/types";
import * as m from "../paraglide/messages.js";

export const poemsPerPage = 24;

/** A poem exists in a language when that locale has its title and text. */
export const hasVersion = (poem?: Pick<Poem, "title" | "content"> | null) =>
  Boolean(poem?.title?.trim() && poem.content?.trim());

/** Available versions, the original first, then the site locales in order. */
export const versionOrder = (original: Locale, available: readonly Locale[]) =>
  [original, ...locales.filter((language) => language !== original)].filter(
    (language) => available.includes(language),
  );

/**
 * The requested version, else the page language, else the original; never
 * another language by default. Undefined when neither exists.
 */
export const selectVersion = (
  versions: readonly Locale[],
  requested: string | null,
  locale: Locale,
  original: Locale,
): Locale | undefined =>
  versions.find((language) => language === requested) ??
  [locale, original].find((language) => versions.includes(language));

/** The editor's snippet, else the first four lines; a line is never cut. */
export function excerptLines(snippet?: string | null, content?: string | null) {
  const lines = (text: string) =>
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  return snippet?.trim() ? lines(snippet) : lines(content ?? "").slice(0, 4);
}

/** Newest year first; poems without a year last. */
export const byYear = (a: Pick<Poem, "year">, b: Pick<Poem, "year">): number =>
  (b.year ?? 0) - (a.year ?? 0);

export interface AuthorName {
  name: string;
  /** The page language, or `de` for the German fallback. */
  lang: Locale;
}

/** A name missing in the page language shows the German name (PO decision). */
export const displayName = (
  name: string | null | undefined,
  germanName: string | null | undefined,
  locale: Locale,
): AuthorName =>
  name?.trim()
    ? { name: name.trim(), lang: locale }
    : { name: germanName?.trim() ?? "", lang: "de" };

/** Years and counts keep Latin digits in every locale, like the CMS data. */
export const formatNumber = (value: number, locale: Locale) =>
  new Intl.NumberFormat(locale, { numberingSystem: "latn" }).format(value);

export const regionName = (country: string, locale: Locale) =>
  new Intl.DisplayNames([locale], { type: "region" }).of(country) ?? country;

export const languageName = (language: Locale, locale: Locale) =>
  new Intl.DisplayNames([locale], { type: "language" }).of(language) ??
  language;

/** "City, Country" in the page language; only the country without a city. */
export function authorPlace(author: Author, locale: Locale) {
  const country = regionName(author.country, locale);
  const city =
    typeof author.city === "object" ? author.city?.names[locale] : null;
  return city ? m.place({ city, country }, { locale }) : country;
}

export interface PoemTeaser {
  id: number;
  href: string;
  /** The displayed version: the page language, else the original. */
  language: Locale;
  title: string;
  lines: string[];
  author?: AuthorName;
  year?: number | null;
}

export const poemTeaser = (
  poem: Poem,
  language: Locale,
  locale: Locale,
  author?: AuthorName,
): PoemTeaser => ({
  id: poem.id,
  href: localizedPath(locale, recordPath("poems", poem.slug, locale)),
  language,
  title: poem.title ?? "",
  lines: excerptLines(poem.snippet, poem.content),
  author,
  year: poem.year,
});
