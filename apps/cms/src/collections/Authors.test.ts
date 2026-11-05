import { message } from "@poetry/cms-ui";
import { describe, expect, it, vi } from "vitest";
import { cityInCountry, validAuthorName } from "./Authors";

const required = message("author_name_required", "en");

function options(
  locale: string,
  stored?: Record<string, unknown> | null,
  extra = {},
) {
  const findByID = vi.fn().mockResolvedValue(stored ?? null);
  return {
    findByID,
    args: {
      collectionSlug: "authors",
      data: {},
      event: "submit",
      id: 7,
      req: { locale, i18n: { language: "en" }, payload: { findByID } },
      ...extra,
    } as never,
  };
}

describe("author name validation", () => {
  it("requires the German name when publishing in German", async () => {
    expect(await validAuthorName("", options("de").args)).toBe(required);
    expect(await validAuthorName("Mira", options("de").args)).toBe(true);
  });

  it("accepts pseudonyms and accents but only Latin script in German", async () => {
    expect(await validAuthorName("Nachtfalke 7", options("de").args)).toBe(
      true,
    );
    expect(await validAuthorName("Şirin Çelik", options("de").args)).toBe(true);
    expect(await validAuthorName("ميرا", options("de").args)).toBe(
      message("author_name_latin", "en"),
    );
    expect(
      await validAuthorName("ميرا", options("ar", { name: "Mira" }).args),
    ).toBe(true);
  });

  it("checks the stored German name when publishing another locale", async () => {
    const missing = options("en", { name: null });
    expect(await validAuthorName("Mira", missing.args)).toBe(required);
    expect(missing.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, locale: "de", draft: true }),
    );
    expect(
      await validAuthorName("", options("en", { name: "Mira" }).args),
    ).toBe(true);
    expect(
      await validAuthorName(
        "Mira",
        options("en", null, { id: undefined }).args,
      ),
    ).toBe(required);
  });

  it("skips the lookup while typing", async () => {
    const typing = options("en", null, { event: "onChange" });
    expect(await validAuthorName("", typing.args)).toBe(true);
    expect(typing.findByID).not.toHaveBeenCalled();
  });
});

it("offers only cities of the author's country", () => {
  expect(cityInCountry({ data: { country: "SY" } } as never)).toEqual({
    country: { equals: "SY" },
  });
  expect(cityInCountry({ data: {} } as never)).toBe(false);
});
