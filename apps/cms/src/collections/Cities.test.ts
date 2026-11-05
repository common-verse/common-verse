import { expect, it } from "vitest";
import { Cities, germanCityName } from "./Cities";
import { authenticated } from "./access";
import { countryField } from "./countries";

it("requires all six names in one unlocalized form and the country", () => {
  const [names, country] = Cities.fields;
  expect(names).toMatchObject({ name: "names", type: "group" });
  if (names.type !== "group") throw new Error("Missing names");
  expect(names).not.toHaveProperty("localized");
  expect(names.fields).toEqual(
    ["de", "en", "ar", "fa", "uk", "ku"].map((name) =>
      expect.objectContaining({ name, required: true }),
    ),
  );
  expect(country).toBe(countryField);
  expect(Cities.access?.read?.({} as never)).toBe(true);
  expect(Cities.access?.create).toBe(authenticated);
  expect(Cities.access?.update).toBe(authenticated);
});

it("titles a city with its German name, also on partial updates", () => {
  const hook = (args: object) => germanCityName(args as never);
  expect(hook({ data: { names: { de: "Köln" } } })).toBe("Köln");
  expect(
    hook({ data: { country: "DE" }, originalDoc: { names: { de: "Bonn" } } }),
  ).toBe("Bonn");
});
