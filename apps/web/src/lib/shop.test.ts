import { describe, expect, it } from "vitest";
import {
  cartSignature,
  cartView,
  decodeCartCount,
  cartSubtotal,
  decodeCart,
  encodeCart,
  formatPrice,
  isLineAvailable,
  isPurchasable,
  parseQuantity,
} from "./shop";

describe("prices", () => {
  it("formats cents as euros with the project's Arabic digits", () => {
    expect(formatPrice(1250, "ar")).toMatch(/١٢٫٥٠/);
  });

  it.each([
    [{ priceInEUR: 1200, inventory: null }, true],
    [{ priceInEUR: 1200, inventory: 2 }, true],
    [{ priceInEUR: 1200, inventory: 0 }, false],
    [{ priceInEUR: 1200, inventory: -1 }, false],
    [{ priceInEUR: 0, inventory: 5 }, false],
  ])("treats %o as purchasable: %s", (product, expected) => {
    expect(isPurchasable(product)).toBe(expected);
  });
});

describe("cart lines", () => {
  const book = (priceInEUR: number, inventory: number | null) => ({
    id: 1,
    slug: "book",
    title: "Book",
    priceInEUR,
    inventory,
  });

  it("totals current prices of the shown lines and ignores deleted products", () => {
    expect(
      cartSubtotal([
        { product: book(2000, null), quantity: 2 },
        { product: null, quantity: 3 },
        { product: 7, quantity: 1 },
      ]),
    ).toBe(4000);
  });

  it.each([
    [{ product: book(2000, null), quantity: 10 }, true],
    [{ product: book(2000, 3), quantity: 3 }, true],
    [{ product: book(2000, 3), quantity: 4 }, false],
    [{ product: book(2000, 0), quantity: 1 }, false],
    [{ product: book(0, null), quantity: 1 }, false],
    [{ product: null, quantity: 1 }, false],
  ])("treats %o as available: %s", (line, expected) => {
    expect(isLineAvailable(line)).toBe(expected);
  });

  it("describes lines for the drawer and the cart page", () => {
    const cover = {
      id: 9,
      url: "/media/cover.jpg",
      alt: "Cover",
      width: 600,
      height: 900,
    };
    const view = cartView(
      [
        {
          id: "a",
          product: { ...book(2000, null), image: cover },
          quantity: 2,
        },
        { id: "b", product: { ...book(1500, 4), id: 2 }, quantity: 5 },
        { id: "c", product: { ...book(1000, 0), id: 3 }, quantity: 1 },
        { id: "d", product: null, quantity: 1 },
        { id: "e", product: { ...book(0, null), id: 4 }, quantity: 1 },
      ],
      { shippingRate: 400, priceNote: "Note" },
      true,
      "https://cms.example",
    );
    expect(
      view.lines.map(({ id, max, stockLimited, available }) => ({
        id,
        max,
        stockLimited,
        available,
      })),
    ).toEqual([
      { id: "a", max: 10, stockLimited: false, available: true },
      { id: "b", max: 4, stockLimited: true, available: false },
      { id: "c", max: 0, stockLimited: false, available: false },
      { id: "d", max: 0, stockLimited: false, available: false },
      { id: "e", max: 0, stockLimited: false, available: false },
    ]);
    expect(view.lines[0]).toMatchObject({
      product: "1",
      cover: {
        url: "https://cms.example/media/cover.jpg",
        width: 600,
        height: 900,
      },
    });
    expect(view.lines[3]).toMatchObject({
      product: null,
      title: null,
      cover: null,
    });
    expect(view).toMatchObject({
      count: 10,
      subtotal: 2000 * 2 + 1500 * 5 + 1000,
      shipping: 400,
      priceNote: "Note",
      checkout: "blocked",
    });
  });

  it.each([
    [{ shippingRate: 400 }, true, "ready"],
    [{ shippingRate: 400 }, false, "payments-unavailable"],
    [{}, true, "payments-unavailable"],
  ] as const)(
    "offers checkout for settings %o and payments %s: %s",
    (settings, payments, checkout) => {
      const lines = [{ id: "a", product: book(2000, null), quantity: 1 }];
      expect(
        cartView(lines, settings, payments, "https://cms.example").checkout,
      ).toBe(checkout);
    },
  );

  it.each([
    ["3", 3],
    ["0", 0],
    ["999", 999],
    ["1000", 0],
    ["-1", 0],
    ["2x", 0],
    [undefined, 0],
  ])("reads the cart count cookie %o as %o", (value, expected) => {
    expect(decodeCartCount(value)).toBe(expected);
  });

  it("changes the signature when a quantity changes", () => {
    const lines = [{ product: book(2000, null), quantity: 1 }];
    expect(cartSignature(lines)).not.toBe(
      cartSignature([{ ...lines[0], quantity: 2 }]),
    );
  });
});

describe("cookies", () => {
  it("round-trips cart access and rejects tampered values", () => {
    const access = { id: "12", secret: "a".repeat(40) };
    expect(decodeCart(encodeCart(access))).toEqual(access);
    for (const value of [
      undefined,
      "12",
      `12.${"a".repeat(40)}.x`,
      `1;2.${"a".repeat(40)}`,
      "12.short",
    ])
      expect(decodeCart(value)).toBeNull();
  });
});

describe("form input", () => {
  it.each([
    ["1", 1],
    ["10", 10],
    ["0", null],
    ["11", null],
    ["1.5", null],
    ["", null],
    [null, null],
  ])("parses quantity %o as %o", (value, expected) => {
    expect(parseQuantity(value)).toBe(expected);
  });
});
