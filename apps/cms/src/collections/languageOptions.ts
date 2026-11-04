import { label, type MessageKey } from "@poetry/cms-ui";
import { locales, type Locale } from "@poetry/i18n";

const languageLabels: Record<Locale, MessageKey> = {
  de: "german",
  en: "english",
  ar: "arabic",
  fa: "persian",
  uk: "ukrainian",
  ku: "kurdish_kurmanji",
};

export const languageOptions = [
  ...locales.map((value) => ({ label: label(languageLabels[value]), value })),
  { label: label("other_language"), value: "other" },
];
