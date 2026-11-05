import type { Locale } from "@poetry/i18n";
import * as m from "../paraglide/messages.js";

const berlinDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function berlinDay(value: Date) {
  const parts = berlinDate.formatToParts(value);
  const part = (type: string) =>
    Number(parts.find((entry) => entry.type === type)!.value);
  return Date.UTC(part("year"), part("month") - 1, part("day"));
}

export function berlinDayStart(now = new Date()) {
  const midnightUTC = berlinDay(now);
  const offsetHours = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Berlin",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(midnightUTC)),
  );
  return new Date(midnightUTC - offsetHours * 3_600_000).toISOString();
}

/** Compare calendar days in Berlin, including across daylight-saving changes. */
export function eventDaysAway(date: string, now = new Date()): number | null {
  const event = new Date(date);
  if (!Number.isFinite(event.getTime())) return null;

  return Math.round((berlinDay(event) - berlinDay(now)) / 86_400_000);
}

export function eventRelativeDate(
  date: string,
  locale: Locale,
  now = new Date(),
) {
  const days = eventDaysAway(date, now);
  return days === null || days < 0 || days > 1
    ? null
    : new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
        days,
        "day",
      );
}

export function formatEventDate(
  date: string,
  locale: Locale,
  now = new Date(),
) {
  const event = new Date(date);
  const year = new Intl.DateTimeFormat(eventFormatLocale(locale), {
    year: "numeric",
    timeZone: "Europe/Berlin",
  });
  const formatted = new Intl.DateTimeFormat(eventFormatLocale(locale), {
    day: "numeric",
    month: "short",
    year: year.format(event) === year.format(now) ? undefined : "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  }).format(event);
  return m.events_time({ time: formatted }, { locale });
}

export function formatEventDay(date: string, locale: Locale, now = new Date()) {
  const event = new Date(date);
  const year = new Intl.DateTimeFormat(eventFormatLocale(locale), {
    year: "numeric",
    timeZone: "Europe/Berlin",
  });
  return new Intl.DateTimeFormat(eventFormatLocale(locale), {
    day: "numeric",
    month: "numeric",
    year: year.format(event) === year.format(now) ? undefined : "numeric",
    timeZone: "Europe/Berlin",
  }).format(event);
}

export function formatEventWeekdayTime(date: string, locale: Locale) {
  const time = new Intl.DateTimeFormat(eventFormatLocale(locale), {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  }).format(new Date(date));
  return m.events_time({ time }, { locale });
}

/** Event and article dates use Latin digits in every locale, like years and counts. */
export const eventFormatLocale = (locale: Locale) => `${locale}-u-nu-latn`;

/** The shop keeps each locale's own digits. */
export function shopFormatLocale(locale: Locale) {
  return locale === "ar"
    ? "ar-u-nu-arab"
    : locale === "fa"
      ? "fa-u-nu-arabext"
      : locale;
}
