import { describe, expect, it } from "vitest";
import type { Event } from "@poetry/types";
import {
  contentDirection,
  poemExcerpt,
  safeHref,
  upcomingEvents,
  sectionItems,
  featuredItem,
} from "./homepage";

const event = (
  id: number,
  startDate: string,
  extra: Partial<Event> = {},
): Event => ({
  id,
  startDate,
  title: `Event ${id}`,
  slugDe: `event-${id}`,
  slugEn: `event-${id}`,
  _status: "published",
  ...extra,
});
describe("homepage editorial behaviour", () => {
  it("prioritises pins, excludes past and unpublished events, and removes duplicates", () => {
    const now = new Date("2026-10-08T12:00:00Z");
    const first = event(1, "2026-10-09T12:00:00Z");
    const pinned = event(2, "2026-10-10T12:00:00Z");
    const started = event(3, "2026-10-07T12:00:00Z");
    const past = event(4, "2026-10-01T12:00:00Z");
    const draft = event(5, "2026-10-11T12:00:00Z", { _status: "draft" });
    expect(
      upcomingEvents(
        [first, pinned, started, past, draft],
        [past, pinned],
        3,
        now,
      ).map((entry) => entry.id),
    ).toEqual([2, 1]);
    expect(
      upcomingEvents(
        [event(6, "invalid"), event(7, "2026-10-09", { title: "" })],
        [],
        3,
        now,
      ),
    ).toEqual([]);
  });
  it("preserves the original and does not invent a translation", () => {
    const poem = {
      id: 1,
      slug: "a",
      title: "A",
      originalLanguage: "fa" as const,
      originalText: "one\ntwo\nthree\nfour\nfive\nsix",
      translations: [],
    };
    expect(poemExcerpt(poem, "ar")).toEqual({
      original: "one\ntwo\nthree\nfour\nfive",
      translation: undefined,
    });
    expect(contentDirection("fa")).toBe("rtl");
    expect(contentDirection("ku")).toBe("ltr");
  });
  it("localises internal links and rejects executable or disguised URLs", () => {
    expect(safeHref("/events", "ar")).toBe("/ar/events");
    expect(safeHref("/ar/poems", "de")).toBe("/ar/poems");
    for (const value of [
      "javascript:alert(1)",
      "//evil.test",
      "/\\evil.test",
      "data:text/html,hello",
    ])
      expect(safeHref(value, "en")).toBeUndefined();
    expect(safeHref("mailto:hello@example.org", "en")).toBe(
      "mailto:hello@example.org",
    );
  });
});

describe("composed homepage content", () => {
  it("keeps manual order, removes drafts/unresolved/duplicates, caps at four, and never fills empty manual choices", () => {
    const automatic = Array.from({ length: 6 }, (_, id) => ({
      id,
      _status: "published",
    }));
    expect(sectionItems(automatic, [], "auto").map((item) => item.id)).toEqual([
      0, 1, 2, 3,
    ]);
    expect(sectionItems(automatic, [], "manual")).toEqual([]);
    const selected = [
      automatic[4],
      2,
      automatic[1],
      automatic[4],
      { id: 9, _status: "draft" },
    ];
    expect(
      sectionItems(automatic, selected, "manual").map((item) => item.id),
    ).toEqual([4, 1]);
    expect(
      sectionItems(automatic, selected, undefined).map((item) => item.id),
    ).toEqual([4, 1]);
    expect(
      sectionItems(automatic, selected, "manual", true).map((item) => item.id),
    ).toEqual([4, 1, 9]);
  });
  it("shows only chosen programme items manually and the closest dates automatically", () => {
    const now = new Date("2026-10-08T12:00:00Z");
    const events = [event(1, "2026-10-09"), event(2, "2026-10-11")];
    expect(
      upcomingEvents(events, [events[1]], 4, now, "manual").map(
        (item) => item.id,
      ),
    ).toEqual([2]);
    expect(upcomingEvents(events, [], 4, now, "manual")).toEqual([]);
    expect(
      upcomingEvents(events, [events[1]], 4, now, "auto").map(
        (item) => item.id,
      ),
    ).toEqual([1, 2]);
  });
  it("features populated records only and protects drafts while allowing authorized preview", () => {
    const section = {
      blockType: "featured" as const,
      item: {
        relationTo: "events" as const,
        value: event(1, "2026-11-01", { _status: "draft" }),
      },
    };
    expect(featuredItem(section)).toBeNull();
    expect(featuredItem(section, true)?.kind).toBe("event");
    const author = {
      id: 3,
      slugDe: "poet",
      slugEn: "poet",
      country: "SY",
      awards: [],
    };
    expect(
      featuredItem({
        blockType: "featured",
        item: { relationTo: "authors", value: author },
      })?.kind,
    ).toBe("author");
    expect(
      featuredItem({
        blockType: "featured",
        item: {
          relationTo: "authors",
          value: { ...author, _status: "draft" },
        },
      }),
    ).toBeNull();
    expect(
      featuredItem({
        blockType: "featured",
        item: { relationTo: "poems", value: 2 },
      }),
    ).toBeNull();
  });
});
