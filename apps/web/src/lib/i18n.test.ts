import { describe, expect, it } from "vitest";
import {
  getLocaleMetadata,
  isLocale,
  localizedPath,
  recordPath,
  unlocalizedPath,
} from "@poetry/i18n";

describe("locale metadata", () => {
  it("marks Arabic and Persian as RTL", () => {
    expect(getLocaleMetadata("ar").direction).toBe("rtl");
    expect(getLocaleMetadata("fa").direction).toBe("rtl");
  });

  it("keeps Kurmanji LTR", () => {
    expect(getLocaleMetadata("ku").direction).toBe("ltr");
  });

  it("only accepts configured locales", () => {
    expect(isLocale("uk")).toBe(true);
    expect(isLocale("ckb")).toBe(false);
  });

  it("uses unprefixed German paths and prefixes the other languages", () => {
    expect(localizedPath("en", "/events/test/")).toBe("/en/events/test");
    expect(localizedPath("de")).toBe("/");
    expect(localizedPath("de", "/events/test/")).toBe("/veranstaltungen/test");
    expect(localizedPath("en")).toBe("/en");
    expect(unlocalizedPath("/ar/events/test")).toBe("/events/test");
    expect(unlocalizedPath("/events/test")).toBe("/events/test");
    expect(unlocalizedPath("/en")).toBe("/");
  });
  it("uses the German record slug for German and the English one elsewhere", () => {
    const slug = { slugDe: "lesung", slugEn: "reading" };
    expect(localizedPath("de", recordPath("events", slug, "de"))).toBe(
      "/veranstaltungen/lesung",
    );
    for (const locale of ["en", "ar", "fa", "uk", "ku"] as const)
      expect(localizedPath(locale, recordPath("events", slug, locale))).toBe(
        `/${locale}/events/reading`,
      );
    expect(recordPath("events", slug, "fa", ["de", "en"])).toBe("events");
    expect(recordPath("events", slug, "en", ["de", "en"])).toBe(
      "events/reading",
    );
  });
  it("maps page identities without changing record slugs", () => {
    expect(localizedPath("de", "articles/project-news")).toBe(
      "/artikel/project-news",
    );
    expect(localizedPath("ar", "/en/articles/project-news")).toBe(
      "/ar/articles/project-news",
    );
    expect(unlocalizedPath("/ar/articles/project-news")).toBe(
      "/articles/project-news",
    );
    expect(localizedPath("de", "contact")).toBe("/kontakt");
    expect(localizedPath("ar", "constructor")).toBe("/ar/constructor");
    expect(localizedPath("ar", "/kontakt?ref=invite#main")).toBe(
      "/ar/contact?ref=invite#main",
    );
    expect(localizedPath("ar", unlocalizedPath("/kontakt"))).toBe(
      "/ar/contact",
    );
    expect(localizedPath("de", "/uk/contact")).toBe("/kontakt");
    expect(localizedPath("de", "poems/original-slug")).toBe(
      "/gedichte/original-slug",
    );
    expect(localizedPath("uk", "/gedichte/original-slug")).toBe(
      "/uk/poems/original-slug",
    );
    expect(unlocalizedPath("/autoren/42")).toBe("/authors/42");
  });
});
