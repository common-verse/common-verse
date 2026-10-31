import { afterEach, expect, it, vi } from "vitest";
import { fixedPageKeys } from "@poetry/i18n";
import { authenticated } from "../collections/access";
import configPromise from "../payload.config";
import { FixedPages, fixedPagePreviewUrl } from "./FixedPages";

afterEach(() => vi.unstubAllEnvs());

it("provides five fixed editors and hides the legacy page builder", async () => {
  const config = await configPromise;
  expect(FixedPages.map((page) => page.slug)).toEqual([...fixedPageKeys]);
  expect(
    config.collections.find((collection) => collection.slug === "pages")?.admin
      .hidden,
  ).toBe(true);
  for (const slug of fixedPageKeys) {
    const page = config.globals.find((global) => global.slug === slug)!;
    expect(page.access.read).toBe(authenticated);
    expect(page.access.update).toBe(authenticated);
    expect(page.access.readVersions).toBe(authenticated);
    expect(page.versions).toMatchObject({
      drafts: { autosave: { interval: 500 } },
    });
    expect(page.admin.group).toMatchObject({ en: "Pages", ar: "الصفحات" });
    const content = page.fields.find(
      (field) => "name" in field && field.name === "content",
    );
    expect(content).toMatchObject({
      localized: true,
      required: true,
      type: "richText",
    });
  }
});

it.each(FixedPages)(
  "protects $slug drafts and publishes only the saved published version",
  async (page) => {
    vi.stubEnv("PREVIEW_SECRET", "secret");
    const endpoints = Array.isArray(page.endpoints) ? page.endpoints : [];
    const preview = endpoints.find((endpoint) => endpoint.path === "/preview")!;
    const publicEndpoint = endpoints.find(
      (endpoint) => endpoint.path === "/public",
    )!;
    const findGlobal = vi
      .fn()
      .mockResolvedValue({ _status: "draft", content: "Private" });
    const req = {
      url: "http://cms/page?locale=ar",
      headers: new Headers(),
      payload: { findGlobal },
    };
    expect((await preview.handler!(req as never)).status).toBe(401);
    expect(findGlobal).not.toHaveBeenCalled();
    expect(
      await (await publicEndpoint.handler!(req as never)).json(),
    ).toBeNull();
    expect(findGlobal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        slug: page.slug,
        locale: "ar",
        fallbackLocale: false,
        draft: false,
      }),
    );
    findGlobal.mockResolvedValue({ _status: "published", content: "Public" });
    expect(
      await (await publicEndpoint.handler!(req as never)).json(),
    ).toMatchObject({ content: "Public" });
    req.headers.set("x-preview-secret", "secret");
    const response = await preview.handler!(req as never);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(findGlobal).toHaveBeenLastCalledWith(
      expect.objectContaining({ draft: true }),
    );
    findGlobal.mockClear();
    req.url = "http://cms/page?locale=unknown";
    expect((await publicEndpoint.handler!(req as never)).status).toBe(400);
    expect((await preview.handler!(req as never)).status).toBe(400);
    expect(findGlobal).not.toHaveBeenCalled();
  },
);

it("uses canonical localized preview paths", () => {
  vi.stubEnv("PREVIEW_SECRET", "");
  expect(fixedPagePreviewUrl("contact", "de")).toBeNull();
  vi.stubEnv("PREVIEW_SECRET", "secret");
  expect(new URL(fixedPagePreviewUrl("about", "de")!).pathname).toBe(
    "/ueber-uns",
  );
  expect(new URL(fixedPagePreviewUrl("contact", "ar", "uk")!).pathname).toBe(
    "/ar/contact",
  );
  expect(
    new URL(fixedPagePreviewUrl("legal", "ar", "uk")!).searchParams.get(
      "editorLanguage",
    ),
  ).toBe("uk");
  expect(fixedPagePreviewUrl("legal", "unknown")).toBeNull();
});
