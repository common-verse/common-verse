import type { Event, EventsPage } from "@poetry/types";
import { eventDaysAway } from "./event-date";

export function eventProgramme(
  events: Event[],
  selected: EventsPage["featuredEvent"][],
  now = new Date(),
) {
  const available = events.filter(
    (event) =>
      event.title?.trim() &&
      event._status !== "draft" &&
      eventDaysAway(event.startDate, now) !== null,
  );
  const upcoming = available
    .filter((event) => eventDaysAway(event.startDate, now)! >= 0)
    .sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate));
  const past = available
    .filter((event) => eventDaysAway(event.startDate, now)! < 0)
    .sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate));
  const first = selected[0];
  const primaryId = first && typeof first === "object" ? first.id : first;
  const primary =
    upcoming.find((event) => String(event.id) === String(primaryId)) ??
    upcoming[0];
  const seen = new Set<string>();
  const features = [primary, ...selected.slice(1)]
    .flatMap((selection) => {
      const id =
        selection && typeof selection === "object" ? selection.id : selection;
      const event = upcoming.find((event) => String(event.id) === String(id));
      if (!event || seen.has(String(event.id))) return [];
      seen.add(String(event.id));
      return [event];
    })
    .slice(0, 5);
  return {
    features,
    upcoming: upcoming.filter((event) => !features.includes(event)),
    past,
  };
}
