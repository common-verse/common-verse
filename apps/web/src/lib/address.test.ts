import { describe, expect, it } from "vitest";
import { clientKey, photonSuggestions, rateLimiter } from "./address";

const feature = (properties: Record<string, string>) => ({ properties });

describe("Photon suggestions", () => {
  it("maps houses and streets, keeps a typed house number and drops unusable or repeated results", () => {
    const response = {
      features: [
        feature({
          type: "house",
          street: "Hermannstraße",
          housenumber: "12",
          postcode: "12049",
          city: "Berlin",
          district: "Neukölln",
        }),
        feature({
          type: "street",
          name: "Hermannstraße",
          postcode: "12049",
          city: "Berlin",
        }),
        feature({
          type: "street",
          name: "Hermannstraße",
          postcode: "12049",
          city: "Berlin",
        }),
        feature({
          type: "street",
          name: "Hermannweg",
          postcode: "1234",
          city: "Wien",
        }),
        feature({ type: "street", name: "Ohne Ort", postcode: "10115" }),
        feature({
          type: "street",
          name: "Dorfstraße",
          postcode: "17337",
          locality: "Klein Luckow",
        }),
      ],
    };
    expect(photonSuggestions(response, "Hermannstr 7a")).toEqual([
      {
        line1: "Hermannstraße 12",
        postalCode: "12049",
        city: "Berlin",
        area: "Neukölln",
      },
      {
        line1: "Hermannstraße 7a",
        postalCode: "12049",
        city: "Berlin",
        area: null,
      },
      // Another street does not get the typed number.
      {
        line1: "Dorfstraße",
        postalCode: "17337",
        city: "Klein Luckow",
        area: null,
      },
    ]);
    expect(photonSuggestions(response, "Hermannstr")[1]!.line1).toBe(
      "Hermannstraße",
    );
  });

  it("returns nothing for a malformed response", () => {
    expect(photonSuggestions(null, "abc")).toEqual([]);
    expect(photonSuggestions({ features: "x" }, "abc")).toEqual([]);
  });
});

describe("rate limit", () => {
  it("allows a number of calls per key and window, then starts again", () => {
    const allowed = rateLimiter(2, 1000);
    expect([allowed("a", 0), allowed("a", 10), allowed("a", 20)]).toEqual([
      true,
      true,
      false,
    ]);
    expect(allowed("b", 20)).toBe(true);
    expect(allowed("a", 1000)).toBe(true);
  });

  it("takes a call back with a negative cost", () => {
    const allowed = rateLimiter(1, 1000);
    expect(allowed("a", 0)).toBe(true);
    allowed("a", 10, -1);
    expect(allowed("a", 20)).toBe(true);
    expect(allowed("a", 30)).toBe(false);
    // Taking back a call that was never counted gives nothing extra.
    allowed("b", 30, -1);
    expect([allowed("b", 40), allowed("b", 50)]).toEqual([true, false]);
  });
});

describe("rate limit client", () => {
  it.each([
    ["2001:db8:1:2:3:4:5:6", "2001:db8:1:2::/64"],
    ["2001:0DB8:0001:0002::ffff", "2001:db8:1:2::/64"],
    ["2001:db8::1", "2001:db8:0:0::/64"],
    ["::1", "0:0:0:0::/64"],
    ["fe80::1%en0", "fe80:0:0:0::/64"],
    ["::ffff:192.0.2.1", "192.0.2.1"],
    ["192.0.2.1", "192.0.2.1"],
  ])("counts %o as %o", (address, key) => {
    expect(clientKey(address)).toBe(key);
  });

  it("counts every address of one /64 against the same limit", () => {
    const allowed = rateLimiter(1, 1000);
    expect(allowed("2001:db8:1:2::a", 0)).toBe(true);
    expect(allowed("2001:db8:1:2::b", 10)).toBe(false);
    expect(allowed("2001:db8:1:3::a", 20)).toBe(true);
  });
});
