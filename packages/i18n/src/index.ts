export const locales = ["de", "en", "ar", "fa", "uk", "ku"] as const;

export type Locale = (typeof locales)[number];
export type Direction = "ltr" | "rtl";

export interface LocaleMetadata {
  code: Locale;
  direction: Direction;
  label: string;
  englishLabel: string;
}

export const localeMetadata: Record<Locale, LocaleMetadata> = {
  de: {
    code: "de",
    direction: "ltr",
    label: "Deutsch",
    englishLabel: "German",
  },
  en: {
    code: "en",
    direction: "ltr",
    label: "English",
    englishLabel: "English",
  },
  ar: {
    code: "ar",
    direction: "rtl",
    label: "العربية",
    englishLabel: "Arabic",
  },
  fa: { code: "fa", direction: "rtl", label: "فارسی", englishLabel: "Persian" },
  uk: {
    code: "uk",
    direction: "ltr",
    label: "Українська",
    englishLabel: "Ukrainian",
  },
  ku: {
    code: "ku",
    direction: "ltr",
    label: "Kurdî",
    englishLabel: "Kurdish (Kurmanji)",
  },
};

export const defaultLocale: Locale = "de";

export const fixedPageKeys = [
  "about",
  "contact",
  "privacy",
  "legal",
  "terms",
] as const;
export type FixedPageKey = (typeof fixedPageKeys)[number];

export function isLocale(value: string | undefined): value is Locale {
  return locales.includes(value as Locale);
}

export function getLocaleMetadata(locale: Locale): LocaleMetadata {
  return localeMetadata[locale];
}

/** Stable page identities; editorial record slugs are left untouched. */
export const routeSegments = {
  articles: { de: "artikel", international: "articles" },
  poems: { de: "gedichte", international: "poems" },
  authors: { de: "autoren", international: "authors" },
  events: { de: "veranstaltungen", international: "events" },
  about: { de: "ueber-uns", international: "about" },
  contact: { de: "kontakt", international: "contact" },
  privacy: { de: "datenschutz", international: "privacy" },
  legal: { de: "impressum", international: "legal" },
  terms: { de: "agb", international: "terms" },
  shop: { de: "shop", international: "shop" },
} as const;

/** Resolves a public pathname back to its stable page identity. */
export function unlocalizedPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (isLocale(segments[0])) segments.shift();
  const route = Object.entries(routeSegments).find(
    ([key, value]) =>
      segments[0] === key ||
      segments[0] === value.de ||
      segments[0] === value.international,
  );
  if (route) segments[0] = route[0];
  return segments.length ? `/${segments.join("/")}` : "/";
}

export function localizedPath(locale: Locale, path = ""): string {
  const suffixIndex = path.search(/[?#]/);
  const pathname = suffixIndex === -1 ? path : path.slice(0, suffixIndex);
  const queryAndHash = suffixIndex === -1 ? "" : path.slice(suffixIndex);
  const segments = unlocalizedPath(pathname).split("/").filter(Boolean);
  const route = Object.hasOwn(routeSegments, segments[0])
    ? routeSegments[segments[0] as keyof typeof routeSegments]
    : undefined;
  if (route) segments[0] = locale === "de" ? route.de : route.international;
  const suffix = segments.length ? `/${segments.join("/")}` : "";
  return (
    (locale === defaultLocale ? suffix || "/" : `/${locale}${suffix}`) +
    queryAndHash
  );
}
