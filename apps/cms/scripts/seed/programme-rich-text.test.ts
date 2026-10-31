import { expect, it } from "vitest";
import { locales } from "@poetry/i18n";
import { convertLexicalToHTML } from "@payloadcms/richtext-lexical/html";
import content from "./programme-content.json";
import { programmeRichText } from "./programme-rich-text";
import { programmeArtwork } from "./programme-artwork";

it("renders twenty distinct six-language event bodies with valid lists and safe contact links", () => {
  expect(content).toHaveLength(20);
  for (const locale of locales) {
    expect(new Set(content.map((event) => event.text[locale].title)).size).toBe(
      20,
    );
    for (const [index, event] of content.entries()) {
      const data = programmeRichText(event, locale, index, 1);
      const html = convertLexicalToHTML({ data });
      expect(html).toContain("<li");
      expect(html).toContain("<h2");
      expect(html).toContain("href=");
      expect(html).not.toMatch(/demo|placeholder|lorem ipsum/i);
      expect(data.root.direction).toBe(
        ["ar", "fa"].includes(locale) ? "rtl" : "ltr",
      );
      expect(programmeArtwork(index).toString()).toContain(
        'viewBox="0 0 1200 800"',
      );
    }
  }
});
