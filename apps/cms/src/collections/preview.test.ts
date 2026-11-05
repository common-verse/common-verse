import { afterEach, expect, it, vi } from "vitest";
import { Homepage } from "../globals/Homepage";
import { Authors } from "./Authors";
import { Poems } from "./Poems";
import { Events } from "./Events";
import { previewEndpoint } from "./preview";

afterEach(() => vi.unstubAllEnvs());

it.each([Homepage, Poems, Authors, Events])(
  "$slug preview URLs keep the editor language separate from the content locale",
  async (config) => {
    vi.stubEnv("PREVIEW_SECRET", "secret");
    // Arabic uses the English slot of a German/English slug.
    const doc =
      config === Homepage ? {} : { slugDe: "deutsch", slugEn: "test" };
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

it("finds a draft by ID, so other locales load the record their slug found", async () => {
  vi.stubEnv("PREVIEW_SECRET", "secret");
  const find = vi.fn().mockResolvedValue({ docs: [] });
  await previewEndpoint("events").handler!({
    headers: new Headers({ "x-preview-secret": "secret" }),
    url: "http://localhost/api/events/preview?id=7&locale=de",
    payload: { find },
  } as never);
  expect(find).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: { equals: "7" } },
      locale: "de",
      draft: true,
    }),
  );
});

it("rejects a non-numeric preview ID before querying", async () => {
  vi.stubEnv("PREVIEW_SECRET", "secret");
  const find = vi.fn();
  const response = await previewEndpoint("events").handler!({
    headers: new Headers({ "x-preview-secret": "secret" }),
    url: "http://localhost/api/events/preview?id=7x&locale=de",
    payload: { find },
  } as never);
  expect(response.status).toBe(400);
  expect(find).not.toHaveBeenCalled();
});

it.each(["poems", "authors"] as const)(
  "finds %s drafts by the slug of the previewed locale",
  async (collection) => {
    vi.stubEnv("PREVIEW_SECRET", "secret");
    const find = vi.fn().mockResolvedValue({ docs: [] });
    const handler = previewEndpoint(collection).handler!;
    for (const locale of ["de", "fa"])
      await handler({
        headers: new Headers({ "x-preview-secret": "secret" }),
        url: `http://localhost/api/${collection}/preview?slug=s&locale=${locale}`,
        payload: { find },
      } as never);
    expect(find.mock.calls.map(([args]) => args.where)).toEqual([
      { slugDe: { equals: "s" } },
      { slugEn: { equals: "s" } },
    ]);
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ collection, draft: true }),
    );
  },
);
