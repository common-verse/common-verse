import "../../src/env";
import assert from "node:assert/strict";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { locales, type Locale } from "@poetry/i18n";
import { getPayload } from "payload";
import config from "../../src/payload.config";
import { assertBulkSeedEnvironment } from "./seed-bulk";
import { programmeArtwork } from "./programme-artwork";
import { programmeRichText } from "./programme-rich-text";
import {
  prepareProgrammePhotos,
  programmePhotoDirectory,
} from "./prepare-programme-photos";
import programme from "./programme-content.json";

assertBulkSeedEnvironment();
assert.equal(programme.length, 20);
assert.equal(new Set(programme.map((event) => event.slug)).size, 20);
for (const locale of locales) {
  assert.equal(
    new Set(programme.map((event) => event.text[locale].title)).size,
    20,
  );
  assert.ok(
    programme.every((event) => event.text[locale].description.length > 30),
  );
}
const places = [
  { address: "Projektraum, Berlin-Mitte", coordinates: [13.405, 52.53] },
  {
    address: "Nachbarschaftsraum am Kanal, Neukölln, Berlin",
    coordinates: [13.439, 52.487],
  },
  {
    address: "Offene Schreibwerkstatt, Kreuzberg, Berlin",
    coordinates: [13.412, 52.493],
  },
  {
    address: "Lesesalon im Hof, Wedding, Berlin",
    coordinates: [13.366, 52.55],
  },
  {
    address: "Raum am Küchentisch, Moabit, Berlin",
    coordinates: [13.339, 52.529],
  },
  {
    address: "Kleine Bühne im Hof, Friedrichshain, Berlin",
    coordinates: [13.454, 52.511],
  },
  {
    address: "Bücherraum im Kiez, Schöneberg, Berlin",
    coordinates: [13.355, 52.482],
  },
  {
    address: "Treffpunkt am Ufer, Treptow, Berlin",
    coordinates: [13.469, 52.489],
  },
];
const photoAssignments = new Map([
  [6, 0],
  [8, 8],
  [12, 3],
  [14, 9],
  [15, 2],
  [17, 5],
  [18, 11],
  [19, 1],
]);
const photos = await prepareProgrammePhotos();
const intros: Record<Locale, { heading: string; introduction: string }> = {
  de: {
    heading: "Bühnen für unsere Stimmen",
    introduction:
      "Lesungen, Schreibwerkstätten und offene Bühnen. Entdecke neue Stimmen und Geschichten in vielen Sprachen.",
  },
  en: {
    heading: "Where words bring us together",
    introduction:
      "Readings, writing workshops, and open stages. Discover new voices and stories in many languages.",
  },
  ar: {
    heading: "كلمات تجمعنا",
    introduction:
      "قراءات وورش كتابة ومنصات مفتوحة. اكتشفوا أصواتًا جديدة وحكايات بلغات متعددة.",
  },
  fa: {
    heading: "واژه‌هایی که ما را به هم می‌رسانند",
    introduction:
      "شعرخوانی، کارگاه نوشتن و صحنهٔ آزاد. صداها و داستان‌های تازه را به زبان‌های گوناگون کشف کنید.",
  },
  uk: {
    heading: "Слова, що єднають",
    introduction:
      "Читання, письменницькі майстерні та відкриті сцени. Відкрийте нові голоси й історії різними мовами.",
  },
  ku: {
    heading: "Peyv me digihînin hev",
    introduction:
      "Xwendin, atolyeyên nivîsînê û sekeyên vekirî. Deng û çîrokên nû bi gelek zimanan nas bikin.",
  },
};
const imageAlt: Record<Locale, [string, string]> = {
  de: ["Grafik zu", "Fotografie einer literarischen Lesung; Cover zu"],
  en: ["Artwork for", "Photograph of a literary reading; cover for"],
  ar: ["رسم لفعالية", "صورة من قراءة أدبية؛ غلاف لفعالية"],
  fa: ["طرح رویداد", "عکسی از یک نشست ادبی؛ جلد رویداد"],
  uk: [
    "Ілюстрація до події",
    "Фотографія літературного читання; обкладинка події",
  ],
  ku: ["Wêne ji bo", "Wêneya xwendineke edebî; berg ji bo"],
};
const payload = await getPayload({ config });
const attempt = `programme-${randomUUID()}`;
const upload = payload.collections.media.config.upload;
assert.ok(upload && typeof upload !== "boolean");
const directory = path.resolve(upload.staticDir ?? "media");
const transactionID = await payload.db.beginTransaction();
assert.notEqual(transactionID, null);
const common = {
  req: { transactionID: transactionID! },
  overrideAccess: true,
  depth: 0,
} as const;
const ids: number[] = [];
let created = 0;
try {
  for (const [index, event] of programme.entries()) {
    const existing = await payload.find({
      ...common,
      collection: "events",
      draft: true,
      locale: "de",
      where: { slugDe: { equals: event.slug } },
      limit: 1,
    });
    if (existing.docs[0]) {
      ids.push(existing.docs[0].id);
      continue;
    }
    const photoIndex = photoAssignments.get(index);
    const photo = photoIndex === undefined ? null : photos[photoIndex];
    const data = photo
      ? await readFile(`${programmePhotoDirectory}/${photoIndex}.jpg`)
      : programmeArtwork(index);
    const filename = `${attempt}-${index}.${photo ? "jpg" : "svg"}`;
    const credit = photo
      ? `${photo.title} — ${photo.artist} — ${photo.license} — resized/cropped\n${photo.sourceUrl}\n${photo.licenseUrl}`
      : "The Poetry Project · Gestaltung";
    const media = await payload.create({
      ...common,
      collection: "media",
      locale: "de",
      data: {
        alt: `${imageAlt.de[photo ? 1 : 0]} „${event.text.de.title}“`,
        credit,
      },
      file: {
        data,
        name: filename,
        mimetype: photo ? "image/jpeg" : "image/svg+xml",
        size: data.byteLength,
      },
    });
    for (const locale of locales.filter((locale) => locale !== "de"))
      await payload.update({
        ...common,
        collection: "media",
        id: media.id,
        locale,
        data: {
          alt: `${imageAlt[locale][photo ? 1 : 0]}: ${event.text[locale].title}`,
        },
      });
    // Berlin uses summer time until 25 October 2026; later programme dates use CET.
    const offset = event.date < "2026-10-25" ? "+02:00" : "+01:00";
    const startDate = new Date(
      `${event.date}T${event.time}:00${offset}`,
    ).toISOString();
    assert.ok(Number.isFinite(Date.parse(startDate)));
    const location = places[event.place];
    const record = await payload.create({
      ...common,
      collection: "events",
      locale: "de",
      draft: false,
      data: {
        title: event.text.de.title,
        description: event.text.de.description,
        content: programmeRichText(event, "de", index, media.id),
        slugDe: event.slug,
        slugEn: event.slug,
        image: media.id,
        registrationUrl: "/contact",
        startDate,
        location: {
          ...location,
          coordinates: [location.coordinates[0], location.coordinates[1]],
        },
        _status: "published",
      },
    });
    for (const locale of locales.filter((locale) => locale !== "de"))
      await payload.update({
        ...common,
        collection: "events",
        id: record.id,
        locale,
        draft: false,
        data: {
          title: event.text[locale].title,
          description: event.text[locale].description,
          content: programmeRichText(event, locale, index, media.id),
          _status: "published",
        },
      });
    ids.push(record.id);
    created++;
  }
  const current = await payload.findGlobal({
    ...common,
    slug: "events-page",
    locale: "all",
    draft: true,
    fallbackLocale: false,
  });
  if (!current.heading || !Object.values(current.heading).some(Boolean)) {
    for (const locale of locales)
      await payload.updateGlobal({
        ...common,
        slug: "events-page",
        locale,
        draft: false,
        data: {
          ...intros[locale],
          featuredEvent: ids[0],
          additionalFeaturedEvents: ids.slice(1, 5),
          _status: "published",
        },
      });
  }
  for (const locale of locales) {
    const saved = await payload.find({
      ...common,
      collection: "events",
      locale,
      fallbackLocale: false,
      where: { id: { in: ids } },
      limit: 100,
    });
    assert.equal(saved.totalDocs, 20);
    assert.ok(
      saved.docs.every(
        (event) =>
          event._status === "published" &&
          event.title &&
          event.content &&
          event.image,
      ),
    );
  }
  await payload.db.commitTransaction(transactionID!);
  console.log(
    JSON.stringify({
      created,
      programmeEvents: ids.length,
      publishedLocales: locales,
      preservedExistingRecords: true,
    }),
  );
  process.exit(0);
} catch (error) {
  await payload.db.rollbackTransaction(transactionID!);
  for (const filename of await readdir(directory))
    if (filename.startsWith(attempt))
      await rm(path.join(directory, filename), { force: true });
  console.error(error);
  process.exit(1);
}
