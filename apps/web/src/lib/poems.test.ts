import { afterEach, describe, expect, it, vi } from "vitest";
import type { Author, Poem } from "@poetry/types";
import { authorNames, getPoem, poemVersions } from "./cms";
import {
  byYear,
  displayName,
  excerptLines,
  selectVersion,
  versionOrder,
} from "./poems";

afterEach(() => vi.unstubAllGlobals());

const poem = (id: number, extra: Partial<Poem> = {}): Poem => ({
  id,
  slug: { de: `p${id}`, en: `p${id}` },
  originalLanguage: "de",
  author: 1,
  ...extra,
});

describe("poem excerpts", () => {
  it("uses the first four non-empty lines without cutting a line", () => {
    expect(excerptLines(null, "eins\n\nzwei\r\ndrei\nvier\nfünf")).toEqual([
      "eins",
      "zwei",
      "drei",
      "vier",
    ]);
  });

  it("prefers the editor's snippet", () => {
    expect(excerptLines(" Auszug\nzweite Zeile ", "Text")).toEqual([
      "Auszug",
      "zweite Zeile",
    ]);
    expect(excerptLines("  ", "Text")).toEqual(["Text"]);
  });
});

it("sorts the newest year first and poems without a year last", () => {
  const poems = [
    poem(1, { year: null }),
    poem(2, { year: 2020 }),
    poem(3, { year: 2024 }),
  ];
  expect(poems.sort(byYear).map(({ id }) => id)).toEqual([3, 2, 1]);
});

describe("poem versions", () => {
  it("lists the original first, then the site locales in order", () => {
    expect(versionOrder("fa", ["en", "de", "fa"])).toEqual(["fa", "de", "en"]);
  });

  it("selects the requested version, else the page language, else the original", () => {
    const versions = versionOrder("ar", ["ar", "de"]);
    expect(selectVersion(versions, "ar", "de", "ar")).toBe("ar");
    expect(selectVersion(versions, "en", "de", "ar")).toBe("de");
    expect(selectVersion(versions, null, "fa", "ar")).toBe("ar");
  });

  it("never defaults to a third language", () => {
    // The original is missing: only an explicit request shows English.
    expect(selectVersion(["en"], null, "de", "ar")).toBeUndefined();
    expect(selectVersion(["en"], "en", "de", "ar")).toBe("en");
  });
});

it("shows the German name when the page language has none", () => {
  expect(displayName(" ", "Nachtfalter", "en")).toEqual({
    name: "Nachtfalter",
    lang: "de",
  });
  expect(displayName("Moth", "Nachtfalter", "en")).toEqual({
    name: "Moth",
    lang: "en",
  });
});

it("shows the page language, else the original, never another language", async () => {
  const fetch = vi.fn(async (url: URL) => {
    const locale = url.searchParams.get("locale");
    expect(url.searchParams.get("where[id][in]")).toBe("2");
    return Response.json({
      docs: locale === "ar" ? [poem(2, { title: "عنوان", content: "نص" })] : [],
    });
  });
  vi.stubGlobal("fetch", fetch);
  const result = await poemVersions(
    [
      poem(1, { title: "Titel", content: "Text" }),
      poem(2, { originalLanguage: "ar", author: 7 }),
      // The original is the page language but empty: nothing to show.
      poem(3),
    ],
    "de",
  );
  expect(
    result.map(({ poem, language }) => [poem.id, language, poem.author]),
  ).toEqual([
    [1, "de", 1],
    [2, "ar", 7],
  ]);
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("requests German names only for authors without a local name", async () => {
  const fetch = vi.fn(async (url: URL) => {
    expect(url.searchParams.get("locale")).toBe("de");
    expect(url.searchParams.get("where[id][in]")).toBe("2");
    return Response.json({ docs: [{ id: 2, name: "Nachtfalter" }] });
  });
  vi.stubGlobal("fetch", fetch);
  const authors = [
    { id: 1, name: "نور" },
    { id: 2, name: null },
  ] as Author[];
  expect([...(await authorNames(authors, "ar"))]).toEqual([
    [1, { name: "نور", lang: "ar" }],
    [2, { name: "Nachtfalter", lang: "de" }],
  ]);
});

it("finds public poems among published records only, previews among drafts", async () => {
  const fetch = vi.fn(async (_url: URL) => Response.json({ docs: [] }));
  vi.stubGlobal("fetch", fetch);
  await getPoem("lesung", "de");
  await getPoem("lesung", "de", "secret");
  const status = (call: number) =>
    fetch.mock.calls[call][0].searchParams.get("where[_status][equals]");
  expect(status(0)).toBe("published");
  expect(status(6)).toBeNull();
});
