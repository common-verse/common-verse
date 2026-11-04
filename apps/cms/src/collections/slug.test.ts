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
  const fill = (args: Partial<FieldHookArgs>) =>
    field.hooks!.beforeValidate![0]({
      operation: "create",
      collection: { slug: "events", versions: { drafts: true } },
      req: { locale: "de", payload: { db: { findOne } } },
      ...args,
    } as never);
  const update = (previousValue: object, value = previousValue) =>
    fill({
      operation: "update",
      originalDoc: { id: 7, title: "Ü" },
      data: { title: "Über den Fluss" },
      previousValue,
      value,
    });
  const [de, en] = field.fields as TextField[];

  it("fills the German slug from the German source and the English slug from the German one", async () => {
    expect(await fill({ data: { title: "Über den Fluss" } })).toEqual({
      de: "ueber-den-fluss",
      en: "ueber-den-fluss",
    });
    expect(
      await fill({
        value: { de: "fluss", en: "" },
        data: { title: "Über den Fluss" },
      }),
    ).toEqual({ de: "fluss", en: "fluss" });
    expect(
      await fill({ value: { de: "fluss", en: "river" }, data: { title: "x" } }),
    ).toEqual({ de: "fluss", en: "river" });
    expect(await fill({ data: {} })).toEqual({ de: null, en: null });
  });

  it("generates nothing from other locales", async () => {
    expect(
      await fill({ data: { title: "River" }, req: { locale: "en" } as never }),
    ).toEqual({ de: null, en: null });
  });

  it("follows the German title until the first publish unless edited by hand", async () => {
    findOne.mockResolvedValue({ _status: "draft" });
    const following = { de: "ue", en: "ue" };
    expect(await update(following)).toEqual({
      de: "ueber-den-fluss",
      en: "ueber-den-fluss",
    });
    expect(findOne).toHaveBeenLastCalledWith(
      expect.objectContaining({
        collection: "events",
        where: { id: { equals: 7 } },
      }),
    );
    expect(await update({ de: "fluss", en: "fluss" })).toEqual({
      de: "fluss",
      en: "fluss",
    });
    expect(await update({ de: "ue", en: "river" })).toEqual({
      de: "ueber-den-fluss",
      en: "river",
    });
    expect(await update(following, { de: "strom", en: "ue" })).toEqual({
      de: "strom",
      en: "strom",
    });
    findOne.mockResolvedValue({ _status: "published" });
    expect(await update(following)).toEqual(following);
    findOne.mockResolvedValue({} as never);
    expect(
      await fill({
        operation: "update",
        collection: { slug: "authors", versions: false } as never,
        originalDoc: { id: 7, title: "Ü" },
        data: { title: "Über den Fluss" },
        previousValue: following,
      }),
    ).toEqual(following);
  });

  it("keeps stored slugs that an update leaves out", async () => {
    const previousValue = { de: "fluss", en: "river" };
    expect(
      await fill({
        operation: "update",
        previousValue,
        value: { de: "strom" },
        data: {},
      }),
    ).toEqual({ de: "strom", en: "river" });
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
      expect(await validate(de, { de: slug })).toBe(
        message("slug_ascii_format", "uk"),
      );
    const format = message("slug_ascii_format", "uk");
    expect(await validate(de, { de: "" }, { data: { title: "عنوان" } })).toBe(
      format,
    );
    expect(
      await validate(
        de,
        { de: null },
        { data: {}, previousValue: null, id: 7 },
      ),
    ).toBe(format);
    expect(
      await validate(
        de,
        { de: "" },
        { req: { i18n: { language: "uk" }, locale: "en" } },
      ),
    ).toBe(format);
    expect(
      await validate(
        de,
        { de: "Legacy_Slug" },
        {
          previousValue: "Legacy_Slug",
        },
      ),
    ).toBe(true);
  });

  it("validates the slug it will save, unique within its slot and collection", async () => {
    expect(await validate(en, { de: "", en: "" }, { id: 7 })).toBe(true);
    expect(count).toHaveBeenLastCalledWith(
      expect.objectContaining({
        collection: "events",
        where: {
          "slug.en": { equals: "ueber-den-fluss" },
          id: { not_equals: 7 },
        },
      }),
    );
    count.mockResolvedValueOnce({ totalDocs: 1 });
    expect(await validate(de, { de: "fluss" })).toBe(
      message("slug_taken", "uk"),
    );
  });
});
