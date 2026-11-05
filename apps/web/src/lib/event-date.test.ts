import { expect, it } from "vitest";
import {
  berlinDayStart,
  eventDaysAway,
  eventRelativeDate,
  formatEventDate,
  formatEventDay,
  formatEventWeekdayTime,
  shopFormatLocale,
} from "./event-date";

it("keeps events active for their entire Berlin calendar day", () => {
  const now = new Date("2026-10-24T21:59:59Z");
  expect(eventDaysAway("2026-10-24T06:00:00Z", now)).toBe(0);
  expect(eventRelativeDate("2026-10-24T06:00:00Z", "en", now)).toBe("today");
  expect(
    eventDaysAway("2026-10-24T06:00:00Z", new Date("2026-10-24T22:00:00Z")),
  ).toBe(-1);
  expect(eventRelativeDate("2026-10-23T06:00:00Z", "en", now)).toBeNull();
  expect(eventDaysAway("invalid", now)).toBeNull();
});

it("counts calendar days across daylight saving and localizes relative labels", () => {
  const now = new Date("2026-10-24T22:30:00Z");
  expect(eventDaysAway("2026-10-25T23:30:00Z", now)).toBe(1);
  expect(eventRelativeDate("2026-10-25T23:30:00Z", "de", now)).toBe("morgen");
  expect(eventRelativeDate("2026-11-01T12:00:00Z", "en", now)).toBeNull();
  expect(
    eventDaysAway("2026-03-29T22:30:00Z", new Date("2026-03-28T23:30:00Z")),
  ).toBe(1);
});

it("queries from Berlin midnight, using the offset before a clock change", () => {
  expect(berlinDayStart(new Date("2026-10-25T12:00:00Z"))).toBe(
    "2026-10-24T22:00:00.000Z",
  );
  expect(berlinDayStart(new Date("2026-03-29T12:00:00Z"))).toBe(
    "2026-03-28T23:00:00.000Z",
  );
});

it("omits the current Berlin year while retaining other years and the time", () => {
  const now = new Date("2026-10-24T12:00:00Z");
  const current = formatEventDate("2026-10-31T18:00:00Z", "de", now);
  expect(current).not.toContain("2026");
  expect(current).toContain("31.");
  expect(current).toMatch(/19:00 Uhr$/);
  expect(formatEventDate("2026-10-31T18:00:00Z", "en", now)).not.toContain(
    "Uhr",
  );
  expect(formatEventDate("2027-01-09T14:00:00Z", "de", now)).toContain("2027");
  expect(formatEventDate("2025-12-01T14:00:00Z", "de", now)).toContain("2025");
  expect(
    formatEventDate(
      "2026-12-31T23:30:00Z",
      "en",
      new Date("2026-12-31T23:00:00Z"),
    ),
  ).not.toContain("2027");
});

it.each([
  ["de", "9.1.2027", "Sa., 19:00 Uhr"],
  ["en", "1/9/2027", "Sat 07:00 PM"],
  ["ar", "9\u200f/1\u200f/2027", "السبت 07:00 م"],
  ["fa", "1405/10/19", "شنبه 19:00"],
  ["uk", "09.01.2027", "сб 19:00"],
  ["ku", "09.01.2027", "şem 19:00"],
] as const)(
  "formats %s dates and weekday/time using the locale with Latin digits",
  (locale, day, time) => {
    const date = "2027-01-09T18:00:00Z";
    const now = new Date("2026-03-01T12:00:00Z");
    expect(formatEventDay(date, locale, now)).toBe(day);
    expect(formatEventWeekdayTime(date, locale)).toBe(time);
  },
);

it("compares Persian calendar years at Nowruz rather than January", () => {
  const now = new Date("2026-12-31T12:00:00Z");
  expect(formatEventDay("2027-01-09T18:00:00Z", "fa", now)).not.toContain(
    "1405",
  );
  expect(formatEventDate("2027-01-09T18:00:00Z", "fa", now)).not.toContain(
    "1405",
  );
  const beforeNowruz = new Date("2027-03-19T12:00:00Z");
  expect(formatEventDay("2027-03-23T18:00:00Z", "fa", beforeNowruz)).toContain(
    "1406",
  );
  expect(formatEventDate("2027-03-23T18:00:00Z", "fa", beforeNowruz)).toContain(
    "1406",
  );
});

it("uses Berlin summer time for the displayed weekday and hour", () => {
  expect(formatEventWeekdayTime("2027-07-10T17:00:00Z", "de")).toBe(
    "Sa., 19:00 Uhr",
  );
});

it.each([
  ["ar", "١"],
  ["fa", "۱"],
] as const)(
  "keeps %s shop numbers in the native numeral system",
  (locale, expected) => {
    expect(new Intl.NumberFormat(shopFormatLocale(locale)).format(1)).toBe(
      expected,
    );
  },
);
