// Order codes without ArkType or server code, so the status page's code field can use them.

/** Crockford base32: digits and letters without I, L, O and U. */
export const codeLength = 8;

/** Reads what buyers type as the CMS does: any case, hyphens, spaces, and O, I or L for 0 and 1. */
export function normalizeCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  return /^[0-9A-HJKMNP-TV-Z]{8}$/.test(code) ? code : null;
}

/** `K7QD93FA` → `K7QD-93FA`. */
export const formatCode = (code: string) =>
  `${code.slice(0, 4)}-${code.slice(4)}`;

/** The characters of a typed text that a code can hold, read as the CMS reads them. */
export const cleanCode = (text: string) =>
  text
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1")
    .replace(/[^0-9A-HJKMNP-TV-Z]/g, "");

/**
 * The last whole code in pasted text: `K7QD-93FA`, `k7qd 93fa`, „Bestellcode: K7QD-93FA“ or a
 * status link ending in `?code=K7QD93FA`.
 */
export function findCode(text: string): string | null {
  const words = text.matchAll(
    /(?<![0-9a-z])[0-9a-z]{4}[\s-]?[0-9a-z]{4}(?![0-9a-z])/gi,
  );
  return (
    [...words]
      .map(([word]) => normalizeCode(word))
      .reverse()
      .find((code): code is string => code !== null) ?? null
  );
}
