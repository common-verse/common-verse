import { describe, expect, it } from "vitest";
import { cleanCode, findCode, formatCode, normalizeCode } from "./order-code";

describe("order code", () => {
  it.each([
    ["k7qd-93fa", "K7QD93FA"],
    [" K7QD 93FA ", "K7QD93FA"],
    ["oiL0-0000", "01100000"],
    ["K7QD-93F", null],
    ["K7QD-93FU", null],
    [undefined, null],
  ])("reads %o as %o, like the CMS", (value, expected) => {
    expect(normalizeCode(value)).toBe(expected);
  });

  it("shows the code in two groups", () => {
    expect(formatCode("K7QD93FA")).toBe("K7QD-93FA");
  });

  it("keeps what a typed text can hold, reading O, I and L as the CMS does", () => {
    expect(cleanCode("k7qd-93 fa")).toBe("K7QD93FA");
    expect(cleanCode("oIl#U?ä")).toBe("011");
  });

  it.each([
    ["https://example.org/bestellstatus?code=k7qd93fa", "K7QD93FA"],
    ["Bestellcode: K7QD-93FA", "K7QD93FA"],
    ["k7qd 93fa", "K7QD93FA"],
    ["Bestellung K7QD-93FA, nicht SH1P-0003?", "SH1P0003"],
    ["Bestellcode K7QD93FAX", null],
    ["93fa", null],
    ["Hallo Welt", null],
  ])("finds the whole code in %o", (text, expected) => {
    expect(findCode(text)).toBe(expected);
  });
});
