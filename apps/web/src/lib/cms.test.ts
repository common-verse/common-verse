import { plainTextToRichText } from "../../../../apps/cms/src/utilities/plainTextToRichText";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getArticles,
  getArticle,
  getActiveAuthors,
  getFixedPage,
  getRecentPoems,
  getUpcomingEvents,
  getEvents,
  getEventsPage,
  getCart,
  initiatePayment,
} from "./cms";

afterEach(() => vi.unstubAllGlobals());

it.each([null, { title: "Partial", content: plainTextToRichText(" ") }])(
  "falls back to English for a missing or incomplete fixed-page translation",
  async (missing) => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(Response.json(missing))
      .mockResolvedValueOnce(
        Response.json({
          title: "Privacy",
          content: plainTextToRichText("English privacy"),
          description: "English description",
        }),
      );
    vi.stubGlobal("fetch", fetch);
    expect(await getFixedPage("privacy", "fa")).toEqual({
      title: "Privacy",
      content: plainTextToRichText("English privacy"),
      description: "English description",
      contentLocale: "en",
    });
    expect(new URL(fetch.mock.calls[1][0]).searchParams.get("locale")).toBe(
      "en",
    );
  },
);

it("keeps complete translations and never replaces request failures with fallback content", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ title: "العنوان", content: plainTextToRichText("النص") }),
    );
  vi.stubGlobal("fetch", fetch);
  expect(await getFixedPage("about", "ar")).toMatchObject({
    contentLocale: "ar",
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  fetch.mockResolvedValueOnce(new Response(null, { status: 503 }));
  await expect(getFixedPage("about", "ar")).rejects.toThrow("503");
  fetch
    .mockResolvedValueOnce(new Response(null, { status: 404 }))
    .mockResolvedValueOnce(Response.json(null));
  expect(await getFixedPage("about", "fa")).toBeNull();
});

describe("automatic homepage queries", () => {
  it("queries latest published poems and nearest localized events at the database", async () => {
    const fetch = vi
      .fn()
      .mockImplementation(async () => Response.json({ docs: [] }));
    vi.stubGlobal("fetch", fetch);
    await getRecentPoems("ar");
    const poems = new URL(fetch.mock.calls[0][0]);
    expect(poems.searchParams.get("sort")).toBe("-createdAt");
    expect(poems.searchParams.get("where[_status][equals]")).toBe("published");
    expect(poems.searchParams.get("limit")).toBe("4");
    expect(poems.searchParams.get("fallback-locale")).toBe("none");
    await getUpcomingEvents("ar");
    const events = new URL(fetch.mock.calls[1][0]);
    expect(events.searchParams.get("sort")).toBe("startDate");
    expect(events.searchParams.get("where[title][exists]")).toBe("true");
    expect(
      events.searchParams.get("where[startDate][greater_than_equal]"),
    ).toBeTruthy();
  });
  it("skips inactive profiles and continues past the first page until four active authors", async () => {
    const pages: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: URL) => {
        const url = new URL(input);
        if (url.pathname === "/api/authors") {
          const page = url.searchParams.get("page")!;
          pages.push(page);
          const ids = page === "1" ? [1, 2, 3, 4] : [5, 6, 7, 8];
          return Response.json({
            docs: ids.map((id) => ({ id, name: `Poet ${id}` })),
            hasNextPage: page === "1",
          });
        }
        const id = Number(url.searchParams.get("where[author][equals]"));
        expect(url.searchParams.get("where[_status][equals]")).toBe(
          "published",
        );
        return Response.json({
          docs: id > 2 ? [{ id: 100 + id, author: { id } }] : [],
        });
      }),
    );
    const result = await getActiveAuthors("en");
    expect(pages).toEqual(["1", "2"]);
    expect(result.authors.map((author) => author.id)).toEqual([3, 4, 5, 6]);
    expect(result.poems).toHaveLength(4);
  });
  it("reports failed automatic requests instead of silently presenting empty content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    );
    await expect(getRecentPoems("en")).rejects.toThrow("503");
    await expect(getActiveAuthors("en")).rejects.toThrow("503");
  });
});

it("requests published article content without language fallback and omits incomplete translations", async () => {
  const complete = {
    id: 1,
    slug: "news",
    title: "News",
    content: plainTextToRichText("Article text"),
  };
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        docs: [
          complete,
          { ...complete, title: null },
          { ...complete, content: null },
        ],
      }),
    )
    .mockResolvedValueOnce(
      Response.json({ docs: [{ ...complete, content: null }] }),
    )
    .mockResolvedValueOnce(Response.json({ docs: [complete] }));
  vi.stubGlobal("fetch", fetch);
  expect(await getArticles("ar")).toEqual([complete]);
  const archiveURL = new URL(fetch.mock.calls[0][0]);
  expect(archiveURL.pathname).toBe("/api/articles");
  expect(archiveURL.searchParams.get("fallback-locale")).toBe("none");
  expect(archiveURL.searchParams.get("sort")).toBe("-publishedAt,-createdAt");
  expect(await getArticle("news", "ar")).toBeNull();
  expect(await getArticle("news", "en", "secret")).toEqual(complete);
  expect(new URL(fetch.mock.calls[2][0]).pathname).toBe(
    "/api/articles/preview",
  );
  expect(fetch.mock.calls[2][1]).toEqual({
    headers: { "x-preview-secret": "secret" },
  });
});

it("loads every event archive page and reports failures on later pages", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ docs: [{ id: 1 }], hasNextPage: true }),
    )
    .mockResolvedValueOnce(
      Response.json({ docs: [{ id: 2 }], hasNextPage: false }),
    );
  vi.stubGlobal("fetch", fetch);
  expect(await getEvents("ar")).toEqual([{ id: 1 }, { id: 2 }]);
  const urls = fetch.mock.calls.map(([url]) => new URL(String(url)));
  expect(urls.map((url) => url.searchParams.get("page"))).toEqual(["1", "2"]);
  expect(urls[1].searchParams.get("sort")).toBe("startDate");
  expect(urls[1].searchParams.get("fallback-locale")).toBe("none");
  fetch
    .mockResolvedValueOnce(Response.json({ docs: [], hasNextPage: true }))
    .mockResolvedValueOnce(new Response(null, { status: 503 }));
  await expect(getEvents("ar")).rejects.toThrow("503");
});

it("keeps events page request errors separate from missing editorial copy", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 404 }))
    .mockResolvedValueOnce(new Response(null, { status: 503 }))
    .mockResolvedValueOnce(Response.json({ heading: "Private programme" }));
  vi.stubGlobal("fetch", fetch);
  expect(await getEventsPage("en")).toBeNull();
  await expect(getEventsPage("ar")).rejects.toThrow(
    "Events page request failed with 503",
  );
  expect(await getEventsPage("ar", "runtime-secret")).toMatchObject({
    heading: "Private programme",
  });
  const [url, options] = fetch.mock.calls[2];
  expect(new URL(url).pathname).toBe("/api/globals/events-page/preview");
  expect(new URL(url).searchParams.get("locale")).toBe("ar");
  expect(options.headers).toEqual({ "x-preview-secret": "runtime-secret" });
});

describe("shop requests", () => {
  const access = { id: "7", secret: "a".repeat(40) };

  it("treats foreign or purchased carts as missing and keeps request failures visible", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(
        Response.json({ id: 7, purchasedAt: "2026-10-31" }),
      )
      .mockResolvedValueOnce(Response.json({ id: 7, items: [] }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetch);
    expect(await getCart(access, "de")).toBeNull();
    expect(await getCart(access, "de")).toBeNull();
    expect(await getCart(access, "de")).toEqual({ id: 7, items: [] });
    await expect(getCart(access, "de")).rejects.toThrow("503");
  });

  it("distinguishes stock problems from other payment start failures", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ cause: { code: "OutOfStock" } }, { status: 400 }),
      )
      .mockResolvedValueOnce(Response.json({ message: "x" }, { status: 500 }))
      .mockResolvedValueOnce(
        Response.json({ clientSecret: "pi_1_secret", paymentIntentID: "pi_1" }),
      );
    vi.stubGlobal("fetch", fetch);
    const address = { country: "DE" as const };
    expect(await initiatePayment(access, "a@b.de", address)).toEqual({
      error: "OutOfStock",
    });
    expect(await initiatePayment(access, "a@b.de", address)).toEqual({
      error: "failed",
    });
    expect(await initiatePayment(access, "a@b.de", address)).toEqual({
      clientSecret: "pi_1_secret",
      paymentIntentID: "pi_1",
    });
  });
});
