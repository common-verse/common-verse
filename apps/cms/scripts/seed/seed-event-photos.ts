import { randomUUID } from "node:crypto";
import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { locales, type Locale } from "@poetry/i18n";
import type { Payload } from "payload";
import {
  assertBulkSeedEnvironment,
  bulkCounts,
  bulkGenerators,
} from "./seed-bulk";

const prefix = "bulk-demo-v1-commons-photo";
const count = 12;
const userAgent =
  "PoetryProjectDemoSeed/1.0 (local development; Wikimedia Commons photo import)";
const photoAlt: Record<Locale, string> = {
  de: "Foto einer Poesieveranstaltung zur Illustration dieses Demo-Workshops",
  en: "Poetry event photograph illustrating this demo workshop",
  ar: "صورة من فعالية شعرية لتوضيح هذه الورشة التجريبية",
  fa: "عکسی از یک رویداد شعر برای نمایش این کارگاه آزمایشی",
  uk: "Фотографія поетичного заходу для ілюстрації цієї демонстраційної майстерні",
  ku: "Wêneya bûyereke helbestê ji bo nîşandana vê atolyeya ceribandinê",
};
interface CommonsPage {
  title: string;
  imageinfo?: {
    mime?: string;
    thumburl?: string;
    descriptionurl: string;
    extmetadata?: Record<string, { value: string }>;
  }[];
}
export interface EventPhoto {
  title: string;
  artist: string;
  license: string;
  licenseUrl: string;
  sourceUrl: string;
  imageUrl: string;
}
function plainText(value: string) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(
      /&(amp|quot|apos|lt|gt);/g,
      (_, entity: string) =>
        ({ amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" })[entity] ?? "",
    )
    .replace(/\s+/g, " ")
    .trim();
}
function allowedUrl(value: string, hosts: string[]) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && hosts.includes(url.hostname);
  } catch {
    return false;
  }
}
export function parseEventPhoto(page: CommonsPage): EventPhoto | null {
  const info = page.imageinfo?.[0];
  const meta = info?.extmetadata;
  const license = meta?.LicenseShortName?.value ?? "";
  const artist = plainText(meta?.Artist?.value ?? "");
  const licenseUrl = meta?.LicenseUrl?.value ?? "";
  const imageUrl = info?.thumburl ?? "";
  const sourceUrl = info?.descriptionurl ?? "";
  if (
    info?.mime !== "image/jpeg" ||
    !artist ||
    !/^CC BY(?:-SA)? \d\.\d$/.test(license) ||
    !allowedUrl(licenseUrl, ["creativecommons.org"]) ||
    !allowedUrl(sourceUrl, ["commons.wikimedia.org"]) ||
    !allowedUrl(imageUrl, ["upload.wikimedia.org", "thumb.wikimedia.org"])
  )
    return null;
  return {
    title: plainText(page.title.replace(/^File:/, "")),
    artist,
    license,
    licenseUrl,
    sourceUrl,
    imageUrl,
  };
}
async function request(url: string) {
  const response = await fetch(url, {
    headers: { "User-Agent": userAgent },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new Error(
      `Wikimedia photo request failed (${response.status}); retry seed:photos later.`,
    );
  return response;
}
// TODO: Replace Wikimedia Commons with Pexels when new API key issuance resumes;
// update photo metadata, attribution links, and importer tests for Pexels.
export async function searchEventPhotos(): Promise<EventPhoto[]> {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: '"poetry reading" filetype:bitmap',
    gsrnamespace: "6",
    gsrlimit: "40",
    prop: "imageinfo",
    iiprop: "url|extmetadata|mime",
    iiurlwidth: "1200",
    format: "json",
    formatversion: "2",
  }).toString();
  const result = (await (await request(url.href)).json()) as {
    error?: unknown;
    query?: { pages?: CommonsPage[] };
  };
  if (result.error) throw new Error("Wikimedia Commons search failed.");
  const photos = (result.query?.pages ?? [])
    .map(parseEventPhoto)
    .filter((photo): photo is EventPhoto => photo !== null)
    .sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl));
  const unique = [
    ...new Map(photos.map((photo) => [photo.sourceUrl, photo])).values(),
  ];
  if (unique.length < count)
    throw new Error(
      "Not enough licensed event photos were found; database unchanged.",
    );
  return bulkGenerators().en.helpers.shuffle(unique).slice(0, count);
}
async function downloadPhoto(photo: EventPhoto) {
  const response = await request(photo.imageUrl);
  if (!response.headers.get("content-type")?.startsWith("image/jpeg"))
    throw new Error("Wikimedia returned an unexpected photo format.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Wikimedia returned an empty photo.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 5 * 1024 * 1024)
        throw new Error("Wikimedia photo exceeds the 5 MiB download limit.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  if (size === 0) throw new Error("Wikimedia returned an empty photo.");
  return Buffer.concat(chunks);
}

export async function seedEventPhotos(payload: Payload) {
  assertBulkSeedEnvironment();
  const upload = payload.collections.media.config.upload;
  if (!upload || typeof upload === "boolean")
    throw new Error("Local media storage is required for photo seeding.");
  const cached = [];
  for (let i = 0; i < count; i++) {
    const found = await payload.find({
      collection: "media",
      locale: "de",
      depth: 0,
      overrideAccess: true,
      where: { filename: { contains: `${prefix}-${i + 1}-` } },
      limit: 1,
    });
    cached.push(found.docs[0]);
  }
  // Download before opening a DB transaction. Repeat runs use local media only.
  const photos = cached.every(Boolean) ? [] : await searchEventPhotos();
  const downloads = new Map<number, Buffer>();
  for (let i = 0; i < count; i++)
    if (!cached[i]) downloads.set(i, await downloadPhoto(photos[i]));
  const attempt = randomUUID();
  const transactionID = await payload.db.beginTransaction();
  if (transactionID === null)
    throw new Error("Photo seeding requires PostgreSQL transactions.");
  const common = {
    req: { transactionID },
    depth: 0,
    overrideAccess: true,
  } as const;
  const createdPrefixes: string[] = [];
  let imported = 0;
  let attached = 0;
  try {
    const ids: number[] = [];
    for (let i = 0; i < count; i++) {
      if (cached[i]) {
        ids.push(cached[i].id);
        continue;
      }
      const photo = photos[i];
      const data = downloads.get(i)!;
      const filePrefix = `${prefix}-${i + 1}-${attempt}`;
      createdPrefixes.push(filePrefix);
      // Plain text only. Preserve source title, author, license, and modification notice.
      const credit = `${photo.title} — ${photo.artist} — ${photo.license} — resized/cropped\n${photo.sourceUrl}\n${photo.licenseUrl}`;
      const media = await payload.create({
        ...common,
        collection: "media",
        locale: "de",
        data: { alt: photoAlt.de, credit },
        file: {
          data,
          mimetype: "image/jpeg",
          name: `${filePrefix}.jpg`,
          size: data.byteLength,
        },
      });
      for (const locale of locales.filter((locale) => locale !== "de"))
        await payload.update({
          ...common,
          collection: "media",
          locale,
          id: media.id,
          data: { alt: photoAlt[locale] },
        });
      ids.push(media.id);
      imported++;
    }
    for (let i = 0; i < bulkCounts.events; i++) {
      // Keep deliberately image-free events as fixtures for empty-state rendering.
      if (i % 4 === 0) continue;
      const result = await payload.find({
        ...common,
        collection: "events",
        locale: "de",
        draft: true,
        where: { slugDe: { equals: `bulk-demo-v1-workshop-${i + 1}` } },
        limit: 1,
      });
      const event = result.docs[0];
      if (!event) continue;
      const desired = ids[i % ids.length];
      if (event.image === desired) continue;
      if (event.image) {
        const imageID =
          typeof event.image === "object" ? event.image.id : event.image;
        const media = await payload.find({
          ...common,
          collection: "media",
          where: { id: { equals: imageID } },
          limit: 1,
        });
        // Replace only seed artwork; retain editor-chosen photographs and other media.
        if (!media.docs[0]?.credit?.startsWith("bulk-demo-v1-art-")) continue;
      }
      await payload.update({
        ...common,
        collection: "events",
        id: event.id,
        locale: "de",
        data: { image: desired, _status: event._status },
      });
      attached++;
    }
    await payload.db.commitTransaction(transactionID);
    payload.logger.info(
      { imported, attached },
      "Workshop demo photos ready (Wikimedia Commons).",
    );
    return { imported, attached };
  } catch (error) {
    try {
      await payload.db.rollbackTransaction(transactionID);
    } finally {
      const directory = path.resolve(upload.staticDir ?? "media");
      const files = await readdir(directory).catch(
        (cause: NodeJS.ErrnoException) => {
          if (cause.code === "ENOENT") return [];
          throw cause;
        },
      );
      await Promise.all(
        files
          .filter((file) =>
            createdPrefixes.some((filePrefix) => file.startsWith(filePrefix)),
          )
          .map((file) => rm(path.join(directory, file))),
      );
    }
    throw error;
  }
}
