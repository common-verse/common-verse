import { describe, expect, it } from "vitest";
import * as m from "../paraglide/messages.js";
import {
  cartSignature,
  cartSubtotal,
  decodeCart,
  checkoutProblems,
  checkoutValues,
  decodeCheckout,
  encodeCart,
  fieldMessages,
  formatPrice,
  isLineAvailable,
  isPurchasable,
  parseCheckout,
  parseQuantity,
} from "./shop";

const form = (entries: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
};

const address = {
  email: " reader@example.org ",
  firstName: "Amira",
  lastName: "Haddad",
  addressLine1: "Oranienstraße 1",
  postalCode: "10999",
  city: "Berlin",
  country: "DE",
};

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

  it("restores a started payment from the checkout cookie", () => {
    const value = {
      paymentIntentID: "pi_123",
      clientSecret: "pi_123_secret_x",
      email: "a@b.de",
      address: { country: "DE", city: "Berlin" },
      cart: "1x2",
    };
    expect(decodeCheckout(JSON.stringify(value))).toEqual(value);
    expect(
      decodeCheckout(JSON.stringify({ ...value, paymentIntentID: "x" })),
    ).toBeNull();
    expect(
      decodeCheckout(JSON.stringify({ ...value, address: { country: "AT" } })),
    ).toBeNull();
    expect(decodeCheckout("{")).toBeNull();
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

  it("returns a trimmed German shipping address", () => {
    expect(parseCheckout(form(address))).toEqual({
      ok: true,
      email: "reader@example.org",
      address: {
        firstName: "Amira",
        lastName: "Haddad",
        addressLine1: "Oranienstraße 1",
        postalCode: "10999",
        city: "Berlin",
        country: "DE",
      },
    });
  });

  it("reports missing and invalid fields and keeps entered values", () => {
    const result = parseCheckout(
      form({
        ...address,
        email: "reader@",
        lastName: " ",
        postalCode: "1099",
        country: "AT",
      }),
    );
    expect(result).toMatchObject({
      ok: false,
      values: { email: "reader@", postalCode: "1099" },
      errors: {
        email: "invalid",
        lastName: "required",
        postalCode: "invalid",
        country: "invalid",
      },
      tooLong: false,
    });
    expect(result.ok || Object.keys(result.errors)).toHaveLength(4);
  });

  it("rejects addresses that exceed Stripe's metadata limit, also beside field errors", () => {
    expect(
      parseCheckout(form({ ...address, company: "x".repeat(400) })),
    ).toMatchObject({ ok: false, tooLong: true, errors: {} });
    expect(
      parseCheckout(
        form({ ...address, company: "x".repeat(400), postalCode: "1" }),
      ),
    ).toMatchObject({
      ok: false,
      tooLong: true,
      errors: { postalCode: "invalid" },
    });
  });

  it("maps empty required fields to missing and other rejections to invalid", () => {
    const values = checkoutValues(
      (name) => address[name as keyof typeof address],
    );
    expect(checkoutProblems({ ...values, email: "", city: "" })).toEqual({
      errors: { email: "required", city: "required" },
      tooLong: false,
    });
    expect(
      checkoutProblems({ ...values, email: "a@b", country: "" }).errors,
    ).toEqual({
      email: "invalid",
      country: "invalid",
    });
  });

  it("offers each field only the messages it can show, in the requested locale", () => {
    const en = { locale: "en" } as const;
    expect(fieldMessages("email", "en")).toEqual({
      required: m.shop_error_required({}, en),
      invalid: m.shop_error_email({}, en),
    });
    expect(fieldMessages("postalCode", "ar")).toEqual({
      required: m.shop_error_required({}, { locale: "ar" }),
      invalid: m.shop_error_postal_code({}, { locale: "ar" }),
    });
    expect(fieldMessages("city", "en")).toEqual({
      required: m.shop_error_required({}, en),
    });
    expect(fieldMessages("company", "en")).toEqual({});
    expect(fieldMessages("country", "en")).toEqual({
      invalid: m.shop_error_country({}, en),
    });
    expect(fieldMessages("email", "de")).not.toEqual(
      fieldMessages("email", "en"),
    );
  });
});
