import { describe, expect, it, vi } from "vitest";
import type { FieldHookArgs, TextField } from "payload";
import { localeSlugField, slugify, validPublicSlug } from "./slug";
import { message } from "@poetry/cms-ui";

const options = {
  required: true,
  req: {
    payload: { config: {} },
    t: () => "Required",
    i18n: { language: "ar" },
  },
} as unknown as Parameters<typeof validPublicSlug>[1];
describe("public record slugs", () => {
  it("requires ASCII URL segments while preserving original titles and unchanged legacy URLs", async () => {
    expect(await validPublicSlug("original-title_42", options)).toBe(true);
    expect(await validPublicSlug("عنوان", options)).toBe(
      message("slug_format", "ar"),
    );
    expect(await validPublicSlug("%D8%B9", options)).not.toBe(true);
    expect(await validPublicSlug("../contact", options)).not.toBe(true);
    expect(
      await validPublicSlug("عنوان", { ...options, previousValue: "عنوان" }),
    ).toBe(true);
    expect(await validPublicSlug("", options)).toBe("Required");
  });
});

describe("German slugs", () => {
  it("transliterates German letters and strips other diacritics", () => {
    expect(slugify("Über den Fluss")).toBe("ueber-den-fluss");
    expect(slugify("  Straße, Öl & Ärger!  ")).toBe("strasse-oel-aerger");
    expect(slugify("Café Noël 2024")).toBe("cafe-noel-2024");
    expect(slugify("عنوان")).toBe("");
  });
});

describe("German/English slug field", () => {
  const field = localeSlugField("title");
  const findOne = vi.fn(async () => ({ _status: "published" }));
  const [de, en] = field.fields as TextField[];
  type Slots = { slugDe?: string | null; slugEn?: string | null };
  // Runs both slot hooks on the same input, as Payload does for one save.
  const fill = async (args: Partial<FieldHookArgs>) => {
    const run = (slot: TextField) =>
      slot.hooks!.beforeValidate![0]({
        operation: "create",
        collection: { slug: "events", versions: { drafts: true } },
        req: { locale: "de", payload: { db: { findOne } } },
        siblingData: args.data,
        ...args,
      } as never);
    return { slugDe: await run(de), slugEn: await run(en) };
  };
  const update = (stored: Slots, sent: Slots = stored) =>
    fill({
      operation: "update",
      originalDoc: { id: 7, title: "Ü", ...stored },
      data: { title: "Über den Fluss", ...sent },
    });

  it("is two top-level fields, so queries never read a locale suffix", () => {
    expect(field.type).toBe("row");
    expect([de.name, en.name]).toEqual(["slugDe", "slugEn"]);
  });

  it("fills the German slug from the German source and the English slug from the German one", async () => {
    expect(await fill({ data: { title: "Über den Fluss" } })).toEqual({
      slugDe: "ueber-den-fluss",
      slugEn: "ueber-den-fluss",
    });
    expect(
      await fill({
        data: { title: "Über den Fluss", slugDe: "fluss", slugEn: "" },
      }),
    ).toEqual({ slugDe: "fluss", slugEn: "fluss" });
    expect(
      await fill({ data: { title: "x", slugDe: "fluss", slugEn: "river" } }),
    ).toEqual({ slugDe: "fluss", slugEn: "river" });
    expect(await fill({ data: {} })).toEqual({ slugDe: null, slugEn: null });
  });

  it("generates nothing from other locales", async () => {
    expect(
      await fill({ data: { title: "River" }, req: { locale: "en" } as never }),
    ).toEqual({ slugDe: null, slugEn: null });
  });

  it("follows the German title until the first publish unless edited by hand", async () => {
    findOne.mockResolvedValue({ _status: "draft" });
    const following = { slugDe: "ue", slugEn: "ue" };
    expect(await update(following)).toEqual({
      slugDe: "ueber-den-fluss",
      slugEn: "ueber-den-fluss",
    });
    expect(findOne).toHaveBeenLastCalledWith(
      expect.objectContaining({
        collection: "events",
        where: { id: { equals: 7 } },
      }),
    );
    expect(await update({ slugDe: "fluss", slugEn: "fluss" })).toEqual({
      slugDe: "fluss",
      slugEn: "fluss",
    });
    expect(await update({ slugDe: "ue", slugEn: "river" })).toEqual({
      slugDe: "ueber-den-fluss",
      slugEn: "river",
    });
    expect(await update(following, { slugDe: "strom", slugEn: "ue" })).toEqual({
      slugDe: "strom",
      slugEn: "strom",
    });
    // The other slot's hook may already have written its result.
    expect(
      await update(following, { slugDe: "ueber-den-fluss", slugEn: "ue" }),
    ).toEqual({ slugDe: "ueber-den-fluss", slugEn: "ueber-den-fluss" });
    findOne.mockResolvedValue({ _status: "published" });
    expect(await update(following)).toEqual(following);
    findOne.mockResolvedValue({} as never);
    expect(
      await fill({
        operation: "update",
        collection: { slug: "authors", versions: false } as never,
        originalDoc: { id: 7, title: "Ü", ...following },
        data: { title: "Über den Fluss" },
      }),
    ).toEqual(following);
  });

  it("keeps stored slugs that an update leaves out", async () => {
    expect(
      await fill({
        operation: "update",
        originalDoc: { slugDe: "fluss", slugEn: "river" },
        data: { slugDe: "strom" },
      }),
    ).toEqual({ slugDe: "strom", slugEn: "river" });
  });

  const count = vi.fn(async () => ({ totalDocs: 0 }));
  const validate = (slot: TextField, siblingData: object, rest: object = {}) =>
    (slot.validate as NonNullable<typeof validPublicSlug>)(undefined, {
      collectionSlug: "events",
      data: { title: "Über den Fluss" },
      event: "submit",
      siblingData,
      req: { i18n: { language: "uk" }, locale: "de", payload: { count } },
      ...rest,
    } as never);

  it("rejects anything but lowercase ASCII letters, digits and hyphens", async () => {
    for (const slug of ["mit leer", "Gross", "über", "عنوان", "лист"])
      expect(await validate(de, { slugDe: slug })).toBe(
        message("slug_ascii_format", "uk"),
      );
    const format = message("slug_ascii_format", "uk");
    expect(
      await validate(de, { slugDe: "" }, { data: { title: "عنوان" } }),
    ).toBe(format);
    expect(
      await validate(
        de,
        { slugDe: null },
        { data: {}, previousValue: null, id: 7 },
      ),
    ).toBe(format);
    expect(
      await validate(
        de,
        { slugDe: "" },
        { req: { i18n: { language: "uk" }, locale: "en" } },
      ),
    ).toBe(format);
    expect(
      await validate(
        de,
        { slugDe: "Legacy_Slug" },
        { previousValue: "Legacy_Slug" },
      ),
    ).toBe(true);
  });

  it("validates the slug it will save, unique within its slot and collection", async () => {
    expect(await validate(en, { slugDe: "", slugEn: "" }, { id: 7 })).toBe(
      true,
    );
    expect(count).toHaveBeenLastCalledWith(
      expect.objectContaining({
        collection: "events",
        where: {
          slugEn: { equals: "ueber-den-fluss" },
          id: { not_equals: 7 },
        },
      }),
    );
    count.mockResolvedValueOnce({ totalDocs: 1 });
    expect(await validate(de, { slugDe: "fluss" })).toBe(
      message("slug_taken", "uk"),
    );
  });
});
