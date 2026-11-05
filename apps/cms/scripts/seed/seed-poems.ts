import { locales, type Locale } from "@poetry/i18n";
import type { Payload } from "payload";
import type { Author } from "../../src/payload-types";
import { bulkFixtures } from "./seed-bulk-fixtures";

// Fictional people and places for local testing; no real authors or photos.
const cities = [
  {
    country: "SY",
    names: {
      de: "Damaskus",
      en: "Damascus",
      ar: "دمشق",
      fa: "دمشق",
      uk: "Дамаск",
      ku: "Şam",
    },
  },
  {
    country: "IR",
    names: {
      de: "Teheran",
      en: "Tehran",
      ar: "طهران",
      fa: "تهران",
      uk: "Тегеран",
      ku: "Tehran",
    },
  },
  {
    country: "UA",
    names: {
      de: "Kyjiw",
      en: "Kyiv",
      ar: "كييف",
      fa: "کی‌یف",
      uk: "Київ",
      ku: "Kîev",
    },
  },
  {
    country: "DE",
    names: {
      de: "Berlin",
      en: "Berlin",
      ar: "برلين",
      fa: "برلین",
      uk: "Берлін",
      ku: "Berlîn",
    },
  },
] as const;

type DemoAuthor = {
  name: string;
  /** Spellings for locales that differ from the German name. */
  names?: Partial<Record<Locale, string>>;
  country: Author["country"];
  city?: string;
  portrait?: boolean;
  awards?: { name: string; year: number }[];
  draft?: boolean;
};

export const demoAuthors: DemoAuthor[] = [
  {
    name: "Leyla Amiri",
    names: { fa: "لیلا امیری", ar: "ليلى أميري" },
    country: "IR",
    city: "Teheran",
    portrait: true,
    awards: [
      { name: "Demo-Lyrikpreis der Stadtbibliothek", year: 2023 },
      { name: "Junge Stimmen Stipendium (Demo)", year: 2025 },
    ],
  },
  {
    name: "Samir Haddad",
    names: { ar: "سمير حداد", fa: "سمیر حداد", uk: "Самір Хаддад" },
    country: "SY",
    city: "Damaskus",
    awards: [{ name: "Preis für Mehrsprachigkeit (Demo)", year: 2024 }],
  },
  {
    name: "Olena Koval",
    names: { uk: "Олена Коваль" },
    country: "UA",
    city: "Kyjiw",
    portrait: true,
  },
  // A pseudonym without portrait or city, as young authors may choose.
  { name: "Nachtfalke", names: { en: "Night Moth" }, country: "AF" },
  { name: "Rojda Kaya", country: "SY", portrait: true },
  { name: "Jonas Weber", country: "DE", city: "Berlin" },
  { name: "Amira Saleh", country: "IQ", draft: true },
];

const poemCount = 26;
const translators = "Demo-Übersetzungswerkstatt";

/** Every fourth poem in all six languages; others with partial or no translations. */
const translatedLocales = (index: number, original: Locale) =>
  locales.filter(
    (locale) =>
      locale !== original &&
      [locales, ["de", "en"], [], ["en"]][index % 4].includes(locale),
  );

const poemText = (locale: Locale, index: number) =>
  Array.from({ length: 1 + (index % 3) }, (_, stanza) =>
    bulkFixtures[locale].lines
      .slice((index + stanza) % 3, ((index + stanza) % 3) + 4)
      .join("\n"),
  ).join("\n\n");

const poemTitle = (locale: Locale, index: number) =>
  `${bulkFixtures[locale].poemTitles[index % 3]} ${index + 1}`;

const portraitSvg = (index: number) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600"><rect width="600" height="600" fill="hsl(${index * 70},70%,85%)"/><circle cx="300" cy="240" r="120" fill="hsl(${index * 70 + 180},60%,45%)"/><rect x="140" y="390" width="320" height="210" rx="160" fill="hsl(${index * 70 + 180},60%,45%)"/></svg>`,
  );

/**
 * Cities, authors and poems for every page state. Existing records, matched by
 * German name or slug, are left untouched, so repeat runs add only what is missing.
 */
export async function seedPoems(
  payload: Payload,
  req: { transactionID: string | number },
  uploadPrefix: string,
) {
  const common = { req, overrideAccess: true, depth: 0 } as const;
  const cityIDs: Record<string, number> = {};
  for (const city of cities) {
    const existing = await payload.find({
      ...common,
      collection: "cities",
      where: { "names.de": { equals: city.names.de } },
      limit: 1,
    });
    cityIDs[city.names.de] =
      existing.docs[0]?.id ??
      (await payload.create({ ...common, collection: "cities", data: city }))
        .id;
  }

  const authorIDs: number[] = [];
  for (const [index, author] of demoAuthors.entries()) {
    const existing = await payload.find({
      ...common,
      collection: "authors",
      locale: "de",
      draft: true,
      where: { name: { equals: author.name } },
      limit: 1,
    });
    if (existing.docs[0]) {
      if (!author.draft) authorIDs.push(existing.docs[0].id);
      continue;
    }
    let portrait: number | undefined;
    if (author.portrait) {
      const data = portraitSvg(index);
      portrait = (
        await payload.create({
          ...common,
          collection: "media",
          locale: "de",
          data: { alt: bulkFixtures.de.alt, credit: "Demo-Porträt" },
          file: {
            data,
            mimetype: "image/svg+xml",
            name: `${uploadPrefix}-portrait-${index + 1}.svg`,
            size: data.byteLength,
          },
        })
      ).id;
      for (const locale of locales.filter((locale) => locale !== "de"))
        await payload.update({
          ...common,
          collection: "media",
          id: portrait,
          locale,
          data: { alt: bulkFixtures[locale].alt },
        });
    }
    const status = author.draft ? "draft" : "published";
    const created = await payload.create({
      ...common,
      collection: "authors",
      locale: "de",
      draft: author.draft,
      data: {
        name: author.name,
        country: author.country,
        city: author.city ? cityIDs[author.city] : undefined,
        portrait,
        awards: author.awards,
        biography: bulkFixtures.de.biography,
        _status: status,
      },
    });
    for (const locale of locales.filter((locale) => locale !== "de"))
      await payload.update({
        ...common,
        collection: "authors",
        id: created.id,
        locale,
        draft: author.draft,
        data: {
          name: author.names?.[locale],
          biography: index % 2 ? undefined : bulkFixtures[locale].biography,
          _status: status,
        },
      });
    if (!author.draft) authorIDs.push(created.id);
  }

  for (let index = 0; index <= poemCount; index++) {
    const draft = index === poemCount;
    const slugs = {
      slugDe: `demo-gedicht-${index + 1}`,
      slugEn: `demo-poem-${index + 1}`,
    };
    const existing = await payload.find({
      ...common,
      collection: "poems",
      draft: true,
      where: { slugDe: { equals: slugs.slugDe } },
      limit: 1,
    });
    if (existing.docs[0]) continue;
    const original = locales[index % locales.length];
    const status = draft ? "draft" : "published";
    const poem = await payload.create({
      ...common,
      collection: "poems",
      locale: original,
      draft,
      data: {
        title: poemTitle(original, index),
        content: poemText(original, index),
        snippet: index % 5 === 0 ? bulkFixtures[original].lines[5] : undefined,
        originalLanguage: original,
        author: authorIDs[index % authorIDs.length],
        year: index % 3 === 0 ? undefined : 2015 + (index % 10),
        ...slugs,
        _status: status,
      },
    });
    for (const locale of translatedLocales(index, original))
      await payload.update({
        ...common,
        collection: "poems",
        id: poem.id,
        locale,
        draft,
        data: {
          title: poemTitle(locale, index),
          content: poemText(locale, index),
          translator: translators,
          _status: status,
        },
      });
  }
}
