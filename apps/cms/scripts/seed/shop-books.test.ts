import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import sharp from "sharp";
import { locales } from "@poetry/i18n";
import {
  emptyLocales,
  placeholderStock,
  productData,
  productDescriptions,
  shopBooks,
} from "./shop-books";

it("seeds buyable books with placeholder stock and the sold-out book without price or stock", () => {
  const products = shopBooks.map(productData);
  expect(new Set(products.map(({ slug }) => slug)).size).toBe(5);
  for (const product of products) {
    expect(product.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(product.generateSlug).toBe(false);
  }
  expect(
    products.map(({ slug, priceInEUR, inventory }) => [
      slug,
      priceInEUR,
      inventory,
    ]),
  ).toEqual([
    ["sei-neben-mir-und-sieh-was-mir-geschehen-ist", 2000, placeholderStock],
    ["ich-wollte-bleiben-ich-ging", 2200, placeholderStock],
    ["i-wanted-to-stay-i-left", 2200, placeholderStock],
    ["allein-nach-europa", 800, placeholderStock],
    ["berliner-anthologie", 0, 0],
  ]);
  expect(products.find(({ slug }) => slug === "allein-nach-europa")?.year).toBe(
    null,
  );
});

it("fills only locales with original text, one paragraph per source paragraph", () => {
  const described = shopBooks.map((book) =>
    productDescriptions(book).map(([locale, text]) => [
      locale,
      text.root.children.length,
    ]),
  );
  expect(described).toEqual([
    [
      ["de", 4],
      ["en", 1],
    ],
    [["de", 4]],
    [["en", 2]],
    [
      ["de", 3],
      ["en", 3],
    ],
    [],
  ]);
  // The old shop stored the other anthology's blurb on this book.
  const [, ichWollteBleiben] = shopBooks;
  expect(JSON.stringify(productDescriptions(ichWollteBleiben))).not.toContain(
    "Ahmad al Aboud",
  );
});

it("ships a small cover for every book", async () => {
  for (const { slug } of shopBooks) {
    const data = await readFile(
      new URL(`./shop-covers/${slug}.jpg`, import.meta.url),
    );
    const { width, height } = await sharp(data).metadata();
    expect(Math.max(width, height)).toBeLessThanOrEqual(1200);
    expect(data.byteLength).toBeLessThan(100_000);
  }
});

it("completes only empty locales so editor text is kept", () => {
  expect(
    emptyLocales({ de: "Cover", en: "", ar: null, uk: "Обкладинка" }),
  ).toEqual(["en", "ar", "fa", "ku"]);
  expect(emptyLocales(null)).toEqual(locales);
  for (const { coverAlt } of shopBooks)
    expect(emptyLocales(coverAlt)).toEqual([]);
});
