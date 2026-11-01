import { describe, expect, it } from "vitest";
import * as m from "../paraglide/messages.js";
import {
  checkoutProblems,
  checkoutValues,
  decodeCheckout,
  fieldMessages,
  parseCheckout,
  walletValues,
} from "./checkout";

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

describe("checkout", () => {
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
      decodeCheckout(JSON.stringify({ ...value, orderCode: "K7QD93FA" })),
    ).toEqual({ ...value, orderCode: "K7QD93FA" });
    // A code that is not one the CMS creates is dropped, the payment kept.
    expect(
      decodeCheckout(JSON.stringify({ ...value, orderCode: "K7QD-93FA" })),
    ).toEqual(value);
    expect(
      decodeCheckout(JSON.stringify({ ...value, paymentIntentID: "x" })),
    ).toBeNull();
    expect(
      decodeCheckout(JSON.stringify({ ...value, address: { country: "AT" } })),
    ).toBeNull();
    expect(decodeCheckout("{")).toBeNull();
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

  it("reads a JSON body like a form", () => {
    expect(parseCheckout(new Map(Object.entries(address)))).toEqual(
      parseCheckout(form(address)),
    );
  });

  it("checks a wallet's contact like the form, splitting the name at its last space", () => {
    const wallet = {
      billingDetails: { email: "reader@example.org" },
      shippingAddress: {
        name: "Amira Al Haddad",
        address: {
          line1: "Oranienstraße 1",
          line2: null,
          city: "Berlin",
          postal_code: "10999",
          country: "DE",
        },
      },
    };
    expect(
      parseCheckout(new Map(Object.entries(walletValues(wallet)))),
    ).toEqual({
      ok: true,
      email: "reader@example.org",
      address: {
        country: "DE",
        firstName: "Amira Al",
        lastName: "Haddad",
        addressLine1: "Oranienstraße 1",
        postalCode: "10999",
        city: "Berlin",
      },
    });
    const single = walletValues({
      ...wallet,
      shippingAddress: { ...wallet.shippingAddress, name: "Amira" },
    });
    // A single name is a last name; the first name is optional.
    expect(single).toMatchObject({ firstName: "", lastName: "Amira" });
    expect(parseCheckout(new Map(Object.entries(single)))).toMatchObject({
      ok: true,
      address: { lastName: "Amira" },
    });
    expect(
      parseCheckout(new Map(Object.entries({ ...single, lastName: " " }))),
    ).toMatchObject({ ok: false, errors: { lastName: "required" } });
    expect(
      parseCheckout(
        new Map(
          Object.entries(
            walletValues({
              ...wallet,
              shippingAddress: {
                ...wallet.shippingAddress,
                address: { ...wallet.shippingAddress.address, country: "AT" },
              },
            }),
          ),
        ),
      ).ok,
    ).toBe(false);
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
