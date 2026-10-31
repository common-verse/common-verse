import { afterEach, expect, it, vi } from "vitest";
import { EventsPage, eventsPagePreviewUrl } from "./EventsPage";

afterEach(() => vi.unstubAllEnvs());

it("protects unpublished page copy and populated event drafts", async () => {
  vi.stubEnv("PREVIEW_SECRET", "secret");
  const endpoints = Array.isArray(EventsPage.endpoints)
    ? EventsPage.endpoints
    : [];
  const publicEndpoint = endpoints.find(
    (endpoint) => endpoint.path === "/public",
  )!;
  const preview = endpoints.find((endpoint) => endpoint.path === "/preview")!;
  const findGlobal = vi
    .fn()
    .mockResolvedValue({ _status: "draft", introduction: "Private" });
  const req = {
    url: "http://cms/page?locale=ar",
    headers: new Headers(),
    payload: { findGlobal },
  };
  expect((await preview.handler!(req as never)).status).toBe(401);
  expect(findGlobal).not.toHaveBeenCalled();
  expect(await (await publicEndpoint.handler!(req as never)).json()).toBeNull();
  findGlobal.mockResolvedValue({
    _status: "published",
    introduction: "Public",
    featuredEvent: { _status: "draft", title: "Private event" },
  });
  expect(
    await (await publicEndpoint.handler!(req as never)).json(),
  ).toMatchObject({ introduction: "Public", featuredEvent: null });
  expect(findGlobal).toHaveBeenLastCalledWith(
    expect.objectContaining({
      locale: "ar",
      fallbackLocale: false,
      draft: false,
    }),
  );
  req.headers.set("x-preview-secret", "secret");
  expect((await preview.handler!(req as never)).status).toBe(200);
  expect(findGlobal).toHaveBeenLastCalledWith(
    expect.objectContaining({ draft: true }),
  );
  req.url = "http://cms/page?locale=invalid";
  expect((await publicEndpoint.handler!(req as never)).status).toBe(400);
});

it("previews the localized listing and keeps the editor language independent", () => {
  vi.stubEnv("PREVIEW_SECRET", "secret");
  const url = new URL(eventsPagePreviewUrl("de", "uk")!);
  expect(url.pathname).toBe("/veranstaltungen");
  expect(url.searchParams.get("editorLanguage")).toBe("uk");
  expect(eventsPagePreviewUrl("unknown")).toBeNull();
});

it("bounds the hero selection and introductory copy without replacing the primary event field", () => {
  const named = EventsPage.fields.filter((field) => "name" in field);
  expect(named.find((field) => field.name === "featuredEvent")).toMatchObject({
    type: "relationship",
    relationTo: "events",
  });
  expect(
    named.find((field) => field.name === "additionalFeaturedEvents"),
  ).toMatchObject({ type: "relationship", hasMany: true, maxRows: 4 });
  expect(named.find((field) => field.name === "introduction")).toMatchObject({
    maxLength: 180,
  });
});
