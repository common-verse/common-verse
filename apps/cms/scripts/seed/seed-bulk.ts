import { plainTextToRichText } from "../../src/utilities/plainTextToRichText";
import { randomUUID } from "node:crypto";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { Faker, ar, base, de, en, fa, ku_kmr_latin, uk } from "@faker-js/faker";
import { locales, type Locale } from "@poetry/i18n";
import type { Payload } from "payload";
import { bulkFixtures } from "./seed-bulk-fixtures";

export const bulkCounts = {
  authors: 60,
  poems: 300,
  events: 100,
  media: 12,
} as const;
const prefix = "bulk-demo-v1";
const randomSeed = 20261008;

export function assertBulkSeedEnvironment() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Bulk demo seeding is disabled in production.");
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.pathname !== "/poetry"
  )
    throw new Error("Bulk demo seeding requires the local poetry database.");
}

export function bulkGenerators() {
  const definitions = { de, en, ar, fa, uk, ku: ku_kmr_latin };
  return Object.fromEntries(
    locales.map((locale, index) => {
      // No English fallback for names: missing language data should fail visibly.
      const faker = new Faker({ locale: [definitions[locale], base] });
      faker.seed(randomSeed + index);
      faker.setDefaultRefDate("2026-10-08T12:00:00.000Z");
      return [locale, faker];
    }),
  ) as Record<Locale, Faker>;
}

// All six locales periodically; otherwise deliberate partial coverage.
export function editorialLocales(index: number): readonly Locale[] {
  return index % 3 === 0
    ? locales
    : index % 3 === 1
      ? ["de", "en"]
      : ["de", "ar", "fa"];
}

export async function seedBulk(payload: Payload) {
  assertBulkSeedEnvironment();
  const generators = bulkGenerators();
  const upload = payload.collections.media.config.upload;
  if (!upload || typeof upload === "boolean")
    throw new Error("Local media storage is required for bulk seeding.");
  const directory = path.resolve(upload.staticDir ?? "media");
  const uploadPrefix = `${prefix}-${randomUUID()}`;
  const transactionID = await payload.db.beginTransaction();
  if (transactionID === null)
    throw new Error("Bulk seeding requires PostgreSQL transactions.");
  const req = { transactionID };
  const common = { req, overrideAccess: true, depth: 0 } as const;
  const created = { authors: 0, poems: 0, events: 0, media: 0 };
  try {
    const mediaIDs: number[] = [];
    for (let i = 0; i < bulkCounts.media; i++) {
      const credit = `${prefix}-art-${i + 1}`;
      const existing = await payload.find({
        ...common,
        collection: "media",
        locale: "de",
        where: { credit: { equals: credit } },
        limit: 1,
      });
      if (existing.docs[0]) {
        mediaIDs.push(existing.docs[0].id);
        continue;
      }
      const hue = i * 30;
      const data = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><rect width="1200" height="800" fill="#faf6ed"/><circle cx="${300 + i * 20}" cy="350" r="220" fill="hsl(${hue},65%,65%)"/><circle cx="760" cy="420" r="160" fill="hsl(${(hue + 110) % 360},55%,55%)"/><path d="M100 650 Q600 100 1100 650" fill="none" stroke="#282828" stroke-width="12"/></svg>`,
      );
      const media = await payload.create({
        ...common,
        collection: "media",
        locale: "de",
        data: { alt: bulkFixtures.de.alt, credit },
        file: {
          data,
          mimetype: "image/svg+xml",
          name: `${uploadPrefix}-${i + 1}.svg`,
          size: data.byteLength,
        },
      });
      for (const locale of locales.filter((locale) => locale !== "de"))
        await payload.update({
          ...common,
          collection: "media",
          id: media.id,
          locale,
          data: { alt: bulkFixtures[locale].alt },
        });
      mediaIDs.push(media.id);
      created.media++;
    }
    const authorIDs: number[] = [];
    for (let i = 0; i < bulkCounts.authors; i++) {
      const locale = locales[i % locales.length];
      generators[locale].seed(randomSeed + i);
      const name = `${generators[locale].person.fullName()} [${prefix}-${i + 1}]`;
      const existing = await payload.find({
        ...common,
        collection: "authors",
        where: { name: { equals: name } },
        limit: 1,
      });
      if (existing.docs[0]) {
        authorIDs.push(existing.docs[0].id);
        continue;
      }
      const author = await payload.create({
        ...common,
        collection: "authors",
        locale,
        data: { name, biography: bulkFixtures[locale].biography },
      });
      for (const translatedLocale of editorialLocales(i).filter(
        (code) => code !== locale,
      ))
        await payload.update({
          ...common,
          collection: "authors",
          id: author.id,
          locale: translatedLocale,
          data: { biography: bulkFixtures[translatedLocale].biography },
        });
      authorIDs.push(author.id);
      created.authors++;
    }
    for (let i = 0; i < bulkCounts.poems; i++) {
      const slug = `${prefix}-poem-${i + 1}`;
      const existing = await payload.find({
        ...common,
        collection: "poems",
        draft: true,
        where: { slug: { equals: slug } },
        limit: 1,
      });
      if (existing.docs[0]) continue;
      const originalLanguage = locales[i % locales.length];
      const faker = generators.en;
      faker.seed(randomSeed + i);
      const lineIndices = faker.helpers.shuffle([0, 1, 2, 3, 4, 5]);
      const stanzaCount = i % 10 === 0 ? 8 : 1 + (i % 3);
      const text = (locale: Locale) =>
        Array.from({ length: stanzaCount }, (_, stanza) =>
          lineIndices
            .slice(stanza % 3, (stanza % 3) + 3)
            .map((line) => bulkFixtures[locale].lines[line])
            .join("\n"),
        ).join("\n\n");
      const title = (locale: Locale) =>
        `${bulkFixtures[locale].poemTitles[Math.floor(i / 6) % 3]} · ${i + 1}`;
      const translatedLocales = locales
        .filter((locale) => locale !== originalLanguage)
        .slice(0, Math.floor(i / 6) % 6);
      await payload.create({
        ...common,
        collection: "poems",
        data: {
          slug,
          title: title(originalLanguage),
          originalLanguage,
          originalText: text(originalLanguage),
          author: authorIDs[i % authorIDs.length],
          media: i % 4 === 0 ? [mediaIDs[i % mediaIDs.length]] : [],
          translations: translatedLocales.map((language) => ({
            language,
            title: title(language),
            text: text(language),
            translator: "Demo translation / Prototype Collective",
          })),
          _status: i % 5 === 0 ? "draft" : "published",
        },
      });
      created.poems++;
    }
    for (let i = 0; i < bulkCounts.events; i++) {
      const slug = `${prefix}-workshop-${i + 1}`;
      const existing = await payload.find({
        ...common,
        collection: "events",
        locale: "de",
        draft: true,
        where: { slugDe: { equals: slug } },
        limit: 1,
      });
      if (existing.docs[0]) continue;
      generators.en.seed(randomSeed + i);
      const start = generators.en.date.between({
        from: "2026-01-01T12:00:00Z",
        to: "2027-12-31T12:00:00Z",
      });
      const localized = (locale: Locale) => {
        const f = bulkFixtures[locale];
        return {
          title: `${f.eventTitles[i % 3]} · ${i + 1}`,
          description: f.description,
          content: plainTextToRichText(
            Array.from({ length: i % 10 === 0 ? 6 : 1 }, () => f.content).join(
              "\n\n",
            ),
          ),
          location: {
            coordinates: [13.405, 52.52] as [number, number],
            address: f.location,
          },
        };
      };
      const event = await payload.create({
        ...common,
        collection: "events",
        locale: "de",
        data: {
          ...localized("de"),
          slugDe: slug,
          slugEn: slug,
          startDate: start.toISOString(),
          image: mediaIDs[i % mediaIDs.length],
          registrationUrl: "https://example.org/register",
          _status: i % 5 === 0 ? "draft" : "published",
        },
      });
      for (const locale of editorialLocales(i).filter(
        (locale) => locale !== "de",
      ))
        await payload.update({
          ...common,
          collection: "events",
          id: event.id,
          locale,
          data: localized(locale),
        });
      created.events++;
    }
    await payload.db.commitTransaction(transactionID);
    payload.logger.info(
      { created },
      "Bulk demo seed complete; existing records preserved.",
    );
    return created;
  } catch (error) {
    try {
      await payload.db.rollbackTransaction(transactionID);
    } finally {
      const files = await readdir(directory).catch(
        (cause: NodeJS.ErrnoException) => {
          if (cause.code === "ENOENT") return [];
          throw cause;
        },
      );
      await Promise.all(
        files
          .filter((filename) => filename.startsWith(uploadPrefix))
          .map((filename) => rm(path.join(directory, filename))),
      );
    }
    throw error;
  }
}
