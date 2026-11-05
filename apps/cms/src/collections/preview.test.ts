import { afterEach, expect, it, vi } from "vitest";
import { Homepage } from "../globals/Homepage";
import { Poems } from "./Poems";
import { Events } from "./Events";

afterEach(() => vi.unstubAllEnvs());

it.each([Homepage, Poems, Events])(
  "$slug preview URLs keep the editor language separate from the content locale",
  async (config) => {
    vi.stubEnv("PREVIEW_SECRET", "secret");
    // Arabic uses the English slot of a German/English slug.
    const doc =
      config === Events
        ? { slugDe: "deutsch", slugEn: "test" }
        : { slug: "test" };
    const livePreview = config.admin!.livePreview!.url;
    if (typeof livePreview !== "function") throw new Error("Missing preview");
    const req = { i18n: { language: "en" } };
    const urls = [
      await config.admin!.preview!(doc, {
        locale: "ar",
        req,
      } as never),
      await livePreview({
        data: doc,
        locale: { code: "ar" },
        req,
      } as never),
    ];
    for (const value of urls) {
      const url = new URL(value!);
      expect(url.pathname).toBe(
        config.slug === "homepage" ? "/ar" : `/ar/${config.slug}/test`,
      );
      expect(url.searchParams.get("editorLanguage")).toBe("en");
      expect(url.searchParams.get("previewSecret")).toBe("secret");
    }
  },
);
