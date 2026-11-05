<script lang="ts">
  import { localizedPath, recordPath, type Locale } from '@poetry/i18n';
  import type { Event } from '@poetry/types';
  import { Heading } from '$lib/components/ui/heading';
  import { Link } from '$lib/components/ui/link';
  import { Badge } from '$lib/components/ui/badge';
  import { eventRelativeDate } from '$lib/event-date';
  import EventFacts from './EventFacts.svelte';

  let { event, locale, now }: {
    event: Event; locale: Locale; now: Date;
  } = $props();
  const status = $derived(eventRelativeDate(event.startDate, locale, now));
</script>

<article class="event-row">
  <Link class="event-row-link" variant="heading" href={localizedPath(locale, recordPath('events', event, locale))} aria-labelledby={`event-title-${event.id}`}>
    <EventFacts {event} {locale} {now} />
    <div class="event-row-copy event-summary">
      {#if status}<Badge class="event-status">{status}</Badge>{/if}
      <Heading level={3} variant="title" id={`event-title-${event.id}`} style={`view-transition-name: event-title-${event.id}`}>{event.title}</Heading>
      {#if event.description}<p style={`view-transition-name: event-description-${event.id}`}>{event.description}</p>{/if}
    </div>
  </Link>
</article>

<style>
  .event-row { min-inline-size: 0; border-block-start: 1px solid var(--border); }
  .event-row :global(.event-row-link) { display: grid; grid-template-columns: minmax(0, var(--event-date-width)) minmax(0, 1fr); gap: var(--event-column-gap); align-items: start; padding-block: var(--space-md); }
  .event-row :global(.event-row-link:hover) { text-decoration: none; }
  .event-row :global(.event-row-link:hover .ui-heading) { text-decoration: underline; text-underline-offset: .16em; }
  .event-row-copy { min-inline-size: 0; overflow-wrap: anywhere; }
  .event-row-copy :global(.event-status) { margin-block-end: var(--space-xs); }
  @media (max-width: 36rem) {
    .event-row :global(.event-row-link) { grid-template-columns: minmax(0, 1fr); }
  }
</style>
