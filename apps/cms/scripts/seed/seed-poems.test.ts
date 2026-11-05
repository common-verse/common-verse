import { locales } from "@poetry/i18n";
import type { Payload } from "payload";
import { expect, it, vi } from "vitest";
import { seedPoems } from "./seed-poems";

type Doc = { id: number; locale?: string; [key: string]: unknown };

function fixture() {
  const records: Record<string, Doc[]> = {};
  const updates: {
    collection: string;
    id: number;
    locale: string;
    data: Record<string, unknown>;
  }[] = [];
  const value = (doc: Doc, path: string) =>
    path
      .split(".")
      .reduce<unknown>(
        (current, key) => (current as Record<string, unknown>)?.[key],
        doc,
      );
  const payload = {
    find: vi.fn(async ({ collection, where }) => {
      const [path, condition] = Object.entries(where)[0] as [
        string,
        { equals: unknown },
      ];
      return {
        docs: (records[collection] ?? []).filter(
          (doc) => value(doc, path) === condition.equals,
        ),
      };
    }),
    create: vi.fn(async ({ collection, data, locale }) => {
      const docs = (records[collection] ??= []);
      const doc = { ...data, locale, id: docs.length + 1 };
      docs.push(doc);
      return doc;
    }),
    update: vi.fn(async (args) => {
      updates.push(args);
      return {};
    }),
  };
  const run = () =>
    seedPoems(
      payload as unknown as Payload,
      { transactionID: 1 },
      "test-upload",
    );
  return { payload, records, updates, run };
}

it("seeds every poem and author state the website must show", async () => {
  const f = fixture();
  await f.run();
  const poems = f.records.poems;
  const published = poems.filter((poem) => poem._status === "published");
  const translations = (poem: Doc) =>
    f.updates
      .filter(
        (update) => update.collection === "poems" && update.id === poem.id,
      )
      .map((update) => update.locale);

  expect(published.length).toBeGreaterThan(24);
  expect(poems.filter((poem) => poem._status === "draft")).toHaveLength(1);
  expect(new Set(poems.map((poem) => poem.originalLanguage))).toEqual(
    new Set(locales),
  );
  for (const poem of poems) expect(poem.locale).toBe(poem.originalLanguage);
  for (const language of ["ar", "fa"])
    expect(
      published.some(
        (poem) =>
          poem.originalLanguage === language &&
          !translations(poem).includes("de"),
      ),
    ).toBe(true);
  expect(published.some((poem) => translations(poem).length === 5)).toBe(true);
  expect(published.some((poem) => poem.year)).toBe(true);
  expect(published.some((poem) => !poem.year)).toBe(true);

  const authors = f.records.authors;
  expect(authors.some((author) => author.portrait)).toBe(true);
  expect(authors.some((author) => !author.portrait && !author.city)).toBe(true);
  expect(authors.some((author) => author.city)).toBe(true);
  expect(
    authors.some((author) => (author.awards as unknown[] | undefined)?.length),
  ).toBe(true);
  expect(authors.filter((author) => author._status === "draft")).toHaveLength(
    1,
  );
  for (const author of authors)
    expect(author.name).toMatch(/^[\p{Script=Latin} ]+$/u);
  const draftAuthor = authors.find((author) => author._status === "draft")!;
  expect(poems.some((poem) => poem.author === draftAuthor.id)).toBe(false);
});

it("adds nothing on a repeat run", async () => {
  const f = fixture();
  await f.run();
  const calls =
    f.payload.create.mock.calls.length + f.payload.update.mock.calls.length;
  await f.run();
  expect(
    f.payload.create.mock.calls.length + f.payload.update.mock.calls.length,
  ).toBe(calls);
});
