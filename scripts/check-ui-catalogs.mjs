import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const settingsFile = pathToFileURL(resolve(process.argv[2]));
const settings = JSON.parse(await readFile(settingsFile));
const catalogFile = (locale) =>
  new URL(
    `../${settings["plugin.inlang.messageFormat"].pathPattern.replace("{locale}", locale)}`,
    settingsFile,
  );
const english = JSON.parse(await readFile(catalogFile("en")));
for (const locale of settings.locales) {
  const catalog = JSON.parse(await readFile(catalogFile(locale)));
  for (const [key, value] of Object.entries(catalog)) {
    if (
      !Object.hasOwn(english, key) ||
      // Plural messages are arrays of variants.
      !(Array.isArray(value) ? value.length : value?.trim?.())
    )
      throw new Error(`Invalid UI message: ${locale}.${key}`);
  }
  const missing = Object.keys(english).filter((key) => !catalog[key]);
  if (missing.length)
    console.warn(`${locale}: English fallback for ${missing.join(", ")}`);
}
