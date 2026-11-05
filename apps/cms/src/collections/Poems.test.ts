import { message } from "@poetry/cms-ui";
import type { Validate } from "payload";
import { expect, it, vi } from "vitest";
import { Poems, translatorOutsideOriginal } from "./Poems";

const required = message("poem_required_in_original", "en");
const validate = (name: string) =>
  (
    Poems.fields.find((field) => "name" in field && field.name === name) as {
      validate: Validate;
    }
  ).validate;

function options(locale: string, stored: Record<string, unknown> | null) {
  const findByID = vi.fn().mockResolvedValue(stored);
  return {
    findByID,
    args: {
      collectionSlug: "poems",
      data: { originalLanguage: "fa" },
      event: "submit",
      id: 3,
      req: { locale, i18n: { language: "en" }, payload: { findByID } },
    } as never,
  };
}

it("requires title and text in the original language on publish", async () => {
  for (const name of ["title", "content"]) {
    expect(await validate(name)("", options("fa", null).args)).toBe(required);
    expect(await validate(name)("شب", options("fa", null).args)).toBe(true);
    const german = options("de", { [name]: "شب" });
    expect(await validate(name)("", german.args)).toBe(true);
    expect(german.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ locale: "fa", select: { [name]: true } }),
    );
    expect(await validate(name)("Nacht", options("de", {}).args)).toBe(
      required,
    );
  }
});

it("hides the translator in the original language", () => {
  const read = (locale: string) =>
    translatorOutsideOriginal({
      value: "Sara",
      siblingData: { originalLanguage: "fa" },
      req: { locale },
    } as never);
  expect(read("fa")).toBeNull();
  expect(read("de")).toBe("Sara");
});
