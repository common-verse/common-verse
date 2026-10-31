import { expect, it } from "vitest";
import type { Event } from "@poetry/types";
import { eventProgramme } from "./event-programme";
import { upcomingEvents } from "./homepage";

const now = new Date("2026-10-24T17:00:00Z");
const event = (
  id: number,
  startDate: string,
  extra: Partial<Event> = {},
): Event => ({
  id,
  title: `Event ${id}`,
  slug: `event-${id}`,
  startDate,
  ...extra,
});
const today = event(1, "2026-10-24T08:00:00Z");
const next = event(2, "2026-11-01T12:00:00Z");
const past = event(3, "2026-10-23T12:00:00Z");

it("features the nearest date, keeps today active, and orders the archive newest first", () => {
  const older = event(4, "2026-09-01T12:00:00Z");
  const programme = eventProgramme([older, next, today, past], [], now);
  expect(programme.features).toEqual([today]);
  expect(programme.upcoming).toEqual([next]);
  expect(programme.past).toEqual([past, older]);
  expect(upcomingEvents([today, next, past], [], 4, now)).toEqual([
    today,
    next,
  ]);
});

it("honors a chosen upcoming event without duplication and rejects private or incomplete records", () => {
  const invalid = event(5, "invalid");
  const untranslated = event(6, next.startDate, { title: " " });
  const draft = event(7, next.startDate, { _status: "draft" });
  const events = [today, next, past, invalid, untranslated, draft];
  expect(eventProgramme(events, [next], now)).toEqual({
    features: [next],
    upcoming: [today],
    past: [past],
  });
  expect(eventProgramme(events, [next.id], now).features[0]).toEqual(next);
  for (const selection of [past, draft, 999])
    expect(eventProgramme(events, [selection], now).features[0]).toEqual(today);
  expect(eventProgramme([], [], now)).toEqual({
    features: [],
    upcoming: [],
    past: [],
  });
});

it("keeps up to five chosen features in order and excludes them from the programme", () => {
  const events = Array.from({ length: 7 }, (_, i) =>
    event(i + 10, "2026-11-01T12:00:00Z"),
  );
  const programme = eventProgramme(
    events,
    [events[2], events[0], events[2], ...events.slice(3)],
    now,
  );
  expect(programme.features.map((event) => event.id)).toEqual([
    12, 10, 13, 14, 15,
  ]);
  expect(programme.upcoming.map((event) => event.id)).toEqual([11, 16]);
});

it("automatically selects the nearest primary while honoring additional features", () => {
  expect(
    eventProgramme([today, next], [undefined, next], now).features,
  ).toEqual([today, next]);
});
