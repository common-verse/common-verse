<script lang="ts">
  import type { Locale } from '@poetry/i18n';
  import type { Event } from '@poetry/types';
  import { formatEventDate, formatEventDay, formatEventWeekdayTime } from '$lib/event-date';
  import { locationText } from '$lib/location';

  let { event, locale, now, compact = false }: { event: Event; locale: Locale; now: Date; compact?: boolean } = $props();
</script>

<div class="event-facts" class:compact>
<time class="event-date" datetime={event.startDate} aria-label={formatEventDate(event.startDate, locale, now)}>
  <bdi dir="auto" class="date-day">{formatEventDay(event.startDate, locale, now)}</bdi>
  <bdi dir="auto" class="date-time">{formatEventWeekdayTime(event.startDate, locale)}</bdi>
</time>
{#if locationText(event.location)}<span class="event-place"><bdi dir="auto">{locationText(event.location)}</bdi></span>{/if}
</div>

<style>
  .event-facts { min-inline-size: 0; }
  .event-place { display: block; margin-block-start: var(--space-xs); font-size: var(--font-size-sm); line-height: 1.5; overflow-wrap: anywhere; }
  .event-date { display: flex; flex-direction: column; gap: var(--space-3xs); min-inline-size: 0; overflow-wrap: anywhere; }
  .date-day { font-family: var(--font-serif); font-size: var(--font-size-md); font-weight: 700; line-height: 1.1; white-space: nowrap; }
  .date-time { white-space: nowrap; font-size: var(--font-size-sm); line-height: 1.5; }
  .compact .event-date { gap: 0; }
  .compact .date-day { font-family: inherit; font-size: var(--font-size-sm); font-weight: 400; line-height: 1.5; }
  .compact .event-place { margin-block-start: 0; }
</style>
