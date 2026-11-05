import { label } from "@poetry/cms-ui";
import { getLocaleMetadata, locales } from "@poetry/i18n";
import type { CollectionConfig, FieldHook } from "payload";
import { authenticated } from "./access";
import { countryField } from "./countries";
import { languageLabels } from "./languageOptions";

export const germanCityName: FieldHook = ({ data, originalDoc }) =>
  data?.names?.de ?? originalDoc?.names?.de;

export const Cities: CollectionConfig = {
  slug: "cities",
  labels: { singular: label("city"), plural: label("cities") },
  admin: {
    useAsTitle: "name",
    group: label("content"),
    defaultColumns: ["name", "country"],
  },
  access: {
    read: () => true,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      // Not localized, so all six names are edited and required in one form.
      name: "names",
      type: "group",
      label: label("name"),
      fields: locales.map((locale) => ({
        name: locale,
        type: "text",
        label: label(languageLabels[locale]),
        required: true,
        admin: { rtl: getLocaleMetadata(locale).direction === "rtl" },
      })),
    },
    countryField,
    {
      // Payload cannot use a nested field as the title, so the German name is copied here.
      name: "name",
      type: "text",
      admin: { hidden: true },
      hooks: { beforeChange: [germanCityName] },
    },
  ],
};
