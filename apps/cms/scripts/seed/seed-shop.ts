import "../../src/env";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { locales, type Locale } from "@poetry/i18n";
import { getPayload } from "payload";
import config from "../../src/payload.config";
import { assertBulkSeedEnvironment } from "./seed-bulk";
import {
  emptyLocales,
  productData,
  productDescriptions,
  shopBooks,
} from "./shop-books";

/** Placeholder until editors set the real rate in Shop settings. */
const placeholderShippingCents = 450;
// Placeholder VAT note; to be confirmed with the treasurer.
const priceNote: Record<Locale, string> = {
  de: "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.",
  en: "No VAT is charged under section 19 of the German VAT Act (UStG).",
  ar: "وفقًا لـ § 19 UStG (قانون ضريبة المبيعات الألماني) لا تُحتسب ضريبة القيمة المضافة.",
  fa: "طبق § 19 UStG (قانون مالیات بر ارزش افزودهٔ آلمان) مالیات بر ارزش افزوده محاسبه نمی‌شود.",
  uk: "Відповідно до § 19 UStG (Закону Німеччини про податок з обороту) податок на додану вартість не нараховується.",
  ku: "Li gorî § 19 UStG (qanûna bacê ya firotinê ya Almanyayê) baca nirxê zêdekirî nayê hesibandin.",
};

assertBulkSeedEnvironment();
const payload = await getPayload({ config });
const attempt = `shop-${randomUUID()}`;
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
let created = 0;
let filled = 0;
// Later runs complete missing locales on covers this seed uploaded, never on editor uploads.
const fillCoverAlt = async (
  id: number,
  slug: string,
  alt: Record<Locale, string>,
) => {
  const media = await payload.findByID({
    ...common,
    collection: "media",
    id,
    locale: "all",
    fallbackLocale: false,
  });
  if (
    !media.filename?.startsWith("shop-") ||
    !media.filename.endsWith(`-${slug}.jpg`)
  )
    return;
  for (const locale of emptyLocales(
    media.alt as unknown as Record<Locale, string>,
  )) {
    await payload.update({
      ...common,
      collection: "media",
      id,
      locale,
      data: { alt: alt[locale] },
    });
    filled++;
  }
};
try {
  for (const book of shopBooks) {
    const existing = await payload.find({
      ...common,
      collection: "products",
      trash: true,
      where: { slug: { equals: book.slug } },
      limit: 1,
    });
    const product = existing.docs[0];
    if (product) {
      if (typeof product.image === "number")
        await fillCoverAlt(product.image, book.slug, book.coverAlt);
      continue;
    }
    const data = await readFile(
      new URL(`./shop-covers/${book.slug}.jpg`, import.meta.url),
    );
    const media = await payload.create({
      ...common,
      collection: "media",
      locale: "de",
      data: { alt: book.coverAlt.de, credit: book.coverCredit },
      file: {
        data,
        name: `${attempt}-${book.slug}.jpg`,
        mimetype: "image/jpeg",
        size: data.byteLength,
      },
    });
    await fillCoverAlt(media.id, book.slug, book.coverAlt);
    const record = await payload.create({
      ...common,
      collection: "products",
      locale: "de",
      data: { ...productData(book), image: media.id },
    });
    for (const [locale, description] of productDescriptions(book))
      await payload.update({
        ...common,
        collection: "products",
        id: record.id,
        locale,
        data: { description },
      });
    created++;
  }
  const settings = await payload.findGlobal({
    ...common,
    slug: "shop-settings",
    locale: "all",
    fallbackLocale: false,
  });
  const note = settings.priceNote as unknown as Record<Locale, string> | null;
  const missing = emptyLocales(note);
  // Empty settings get the placeholders; the seeded note gets its missing translations.
  if (
    (settings.shippingRate == null && missing.length === locales.length) ||
    note?.de === priceNote.de
  )
    for (const locale of missing) {
      await payload.updateGlobal({
        ...common,
        slug: "shop-settings",
        locale,
        data: {
          shippingRate: settings.shippingRate ?? placeholderShippingCents,
          priceNote: priceNote[locale],
        },
      });
      filled++;
    }
  const saved = await payload.find({
    ...common,
    collection: "products",
    trash: true,
    where: { slug: { in: shopBooks.map((book) => book.slug) } },
    limit: shopBooks.length,
  });
  assert.equal(saved.totalDocs, shopBooks.length);
  await payload.db.commitTransaction(transactionID!);
  console.log(
    JSON.stringify({
      created,
      shopProducts: saved.totalDocs,
      filledLocales: filled,
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
