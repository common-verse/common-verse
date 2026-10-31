import { eventDaysAway } from "./event-date";
import {
  getLocaleMetadata,
  isLocale,
  localizedPath,
  type Locale,
} from "@poetry/i18n";
import type {
  HomepageSection,
  MediaReference,
  Poem,
  Event,
} from "@poetry/types";

export function contentDirection(language: string) {
  return isLocale(language) ? getLocaleMetadata(language).direction : "auto";
}

export function safeHref(
  value?: string | null,
  locale?: Locale,
): string | undefined {
  if (!value) return undefined;
  if (/^\/(?!\/)/.test(value) && !/[\\\s]/.test(value)) {
    const explicitLocale = value.split("/")[1];
    if (isLocale(explicitLocale))
      return localizedPath(explicitLocale, value.split("/").slice(2).join("/"));
    if (!locale) return value;
    return localizedPath(locale, value);
  }
  try {
    const url = new URL(value);
    if (["https:", "http:", "mailto:"].includes(url.protocol)) return url.href;
  } catch {
    /* Do not render unsafe editorial URLs. */
  }
  return undefined;
}

export function mediaObject(
  value: MediaReference | number | string | null | undefined,
) {
  return value && typeof value === "object" && value.url && value.alt
    ? value
    : null;
}

export function upcomingEvents(
  events: Event[],
  pinned: HomepageSection["pinnedEvents"],
  limit: number,
  now = new Date(),
  selectionMode?: HomepageSection["selectionMode"],
  preview = false,
): Event[] {
  const upcoming = (event: Event) =>
    Boolean(event.title) &&
    (preview || event._status !== "draft") &&
    (eventDaysAway(event.startDate, now) ?? -1) >= 0;
  const selected = (pinned ?? []).filter(
    (event): event is Event =>
      Boolean(event) && typeof event === "object" && upcoming(event),
  );
  const ordered = [
    ...(selectionMode === "auto" ? [] : selected),
    ...(selectionMode === "manual" ? [] : events)
      .filter(upcoming)
      .sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate)),
  ];
  const seen = new Set<string>();
  return ordered
    .filter((event) => {
      const id = String(event.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, Math.max(1, Math.min(4, limit)));
}

export function poemExcerpt(poem: Poem, locale: Locale) {
  const translation = poem.translations?.find(
    (entry) => entry.language === locale,
  );
  return {
    original: poem.originalText.split("\n").slice(0, 5).join("\n"),
    translation,
  };
}

/** Explicit manual selections never silently fill empty slots with automatic content. */
export function sectionItems<
  T extends { id: number | string; _status?: string },
>(
  automatic: T[],
  selected: (T | number | string)[] | null | undefined,
  mode: HomepageSection["selectionMode"],
  preview = false,
): T[] {
  const source =
    mode === "manual" || (!mode && selected?.length)
      ? (selected ?? [])
      : automatic;
  const seen = new Set<string>();
  return source
    .filter((item): item is T => {
      if (
        !item ||
        typeof item !== "object" ||
        (!preview && item._status === "draft")
      )
        return false;
      const id = String(item.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, 4);
}

export function featuredItem(section: HomepageSection, preview = false) {
  const item = section.item;
  if (!item?.value || typeof item.value !== "object") return null;
  if (
    item.relationTo === "poems" &&
    (preview || item.value._status !== "draft")
  )
    return { kind: "poem" as const, value: item.value };
  if (item.relationTo === "authors" && item.value.name)
    return { kind: "poet" as const, value: item.value };
  if (
    item.relationTo === "events" &&
    item.value.title &&
    (preview || item.value._status !== "draft")
  )
    return { kind: "event" as const, value: item.value };
  return null;
}
