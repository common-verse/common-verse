import { describe, expect, it } from "vitest";
import { editorLocale, label, message } from "@poetry/cms-ui";
import { Homepage, validLink } from "../globals/Homepage";
import configPromise from "../payload.config";
import { Events } from "./Events";

describe("independent editor UI translations", () => {
  it("uses English for unsupported editor languages and translates our labels", () => {
    expect(editorLocale("ku")).toBe("en");
    expect(editorLocale("unknown")).toBe("en");
    expect(message("draft_preview", "ku")).toBe("Draft preview");
    expect(label("heading")).toMatchObject({
      en: "Heading",
      uk: "Заголовок",
      ar: "العنوان",
    });
    expect(
      validLink("javascript:alert(1)", { req: { i18n: { language: "uk" } } }),
    ).toBe(
      message("use_https_mailto_or_a_path_beginning_with_one_slash", "uk"),
    );
  });
  it("keeps content fallback disabled and stored selection values stable", async () => {
    const config = await configPromise;
    expect(config.i18n.fallbackLanguage).toBe("en");
    expect(Object.keys(config.i18n.supportedLanguages)).not.toContain("ku");
    expect(config.localization).toMatchObject({
      defaultLocale: "de",
      fallback: false,
    });
    const sections = Homepage.fields.find(
      (field) => "name" in field && field.name === "sections",
    );
    if (sections?.type !== "blocks") throw new Error("Missing sections");
    const poems = sections.blocks.find((block) => block.slug === "poems")!;
    const mode = poems.fields.find(
      (field) => "name" in field && field.name === "selectionMode",
    );
    if (mode?.type !== "select") throw new Error("Missing mode");
    expect(mode.options).toEqual([
      { label: label("automatic"), value: "auto" },
      { label: label("select_manually"), value: "manual" },
    ]);
    expect(
      sections.blocks.find((block) => block.slug === "introduction")?.labels
        ?.singular,
    ).toEqual(label("mission"));
  });
});

it("renders poem text in the edited locale and hides translators in the original", async () => {
  const config = await configPromise;
  const poems = config.collections.find(
    (collection) => collection.slug === "poems",
  )!;
  const component = (name: string) =>
    poems.fields.find((field) => "name" in field && field.name === name)?.admin
      ?.components?.Field;
  expect(component("content")).toEqual({
    path: "./components/ContentField#ContentTextarea",
    clientProps: { languageField: undefined },
  });
  expect(component("translator")).toBe(
    "./components/ContentField#TranslatorText",
  );
});

it("uses the same location field in events and Locations", async () => {
  const config = await configPromise;
  const events = config.collections.find(
    (collection) => collection.slug === "events",
  )!;
  const location = events.fields.find(
    (field) => "name" in field && field.name === "location",
  );
  if (location?.type !== "group") throw new Error("Missing location group");
  expect(
    location.fields.find(
      (field) => "name" in field && field.name === "coordinates",
    )?.admin?.components?.Field,
  ).toEqual({
    path: "./components/LocationField#LocationField",
    clientProps: { bookmarks: true },
  });
  expect(
    Events.fields.findIndex(
      (field) => "name" in field && field.name === "content",
    ),
  ).toBeGreaterThan(
    Events.fields.findIndex((field) => field.type === "collapsible"),
  );
});
