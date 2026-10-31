<script lang="ts">
  import { onMount } from 'svelte';
  import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-svelte';
  import { getLocaleMetadata, localizedPath, type Locale } from '@poetry/i18n';
  import type { Event } from '@poetry/types';
  import { Heading } from '$lib/components/ui/heading';
  import { Link } from '$lib/components/ui/link';
  import { Button } from '$lib/components/ui/button';
  import { mediaObject } from '$lib/homepage';
  import { eventRelativeDate, eventFormatLocale } from '$lib/event-date';
  import EventFacts from './EventFacts.svelte';
  import * as m from '../../../paraglide/messages.js';

  let { events, locale, title, introduction, cmsUrl, now }: {
    events: Event[]; locale: Locale; title: string; introduction: string; cmsUrl: string; now: Date;
  } = $props();
  let track = $state<HTMLDivElement>();
  let active = $state(0);
  const numbers = $derived(new Intl.NumberFormat(eventFormatLocale(locale), { useGrouping: false }));
  let ready = $state(false);
  onMount(() => { ready = true; });

  function syncActive() {
    if (track?.clientWidth) active = Math.min(events.length - 1, Math.round(Math.abs(track.scrollLeft) / track.clientWidth));
  }
  function goTo(index: number) {
    if (!track) return;
    track.scrollTo({ left: index * track.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
</script>

<section dir="ltr" class="events-hero" class:without-features={!events.length} aria-labelledby="events-heading">
  <header class="hero-introduction" dir={getLocaleMetadata(locale).direction}>
    <Heading level={1} variant="display" id="events-heading">{title}</Heading>
    <p>{introduction}</p>
  </header>
  {#if events.length}
    <div dir="ltr" class="hero-track" id="featured-events" bind:this={track} onscroll={syncActive} role="region" aria-label={m.events_featured({}, { locale })} tabindex="0">
      {#each events as event, index (event.id)}
        {@const media = mediaObject(event.image)}
        {@const status = eventRelativeDate(event.startDate, locale, now)}
        <article dir={getLocaleMetadata(locale).direction} class="hero-slide" class:without-image={!media?.url} aria-labelledby={`feature-title-${event.id}`}>
          {#if media?.url}
            <img src={new URL(media.url, cmsUrl).href} alt={media.alt} width={media.width ?? 1200} height={media.height ?? 800} loading={index === 0 ? 'eager' : 'lazy'} decoding="async" style={`view-transition-name: ${index === active ? `event-image-${event.id}` : "none"}`} />
          {/if}
          <div class="hero-copy">
            {#if status}<span class="hero-status">{status}</span>{/if}
            <Heading level={2} id={`feature-title-${event.id}`} style={`view-transition-name: ${index === active ? `event-title-${event.id}` : "none"}`}>
              <Link variant="heading" href={localizedPath(locale, `events/${event.slug}`)}>{event.title}</Link>
            </Heading>
            {#if event.description}<p style={`view-transition-name: ${index === active ? `event-description-${event.id}` : "none"}`}>{event.description}</p>{/if}
            <div class="hero-meta">
              <EventFacts {event} {locale} {now} compact />
            </div>
          </div>
        </article>
      {/each}
    </div>
    {#if ready && events.length > 1}
      <div class="hero-controls" dir="ltr">
        <Button variant="ghost" size="icon" aria-label={m.events_previous({}, { locale })} disabled={active === 0} aria-controls="featured-events" onclick={() => goTo(active - 1)}><ChevronLeftIcon aria-hidden="true" /></Button>
        <span class="hero-position" aria-live="polite" aria-atomic="true"><bdi dir="ltr" aria-hidden="true"><span>{numbers.format(active + 1)}</span><span> / </span><span>{numbers.format(events.length)}</span></bdi><span class="sr-only">{m.events_position({ current: numbers.format(active + 1), total: numbers.format(events.length) }, { locale })}</span></span>
        <Button variant="ghost" size="icon" aria-label={m.events_next({}, { locale })} disabled={active === events.length - 1} aria-controls="featured-events" onclick={() => goTo(active + 1)}><ChevronRightIcon aria-hidden="true" /></Button>
      </div>
    {/if}
  {/if}
</section>

<style>
  .events-hero { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, .85fr); column-gap: var(--space-lg-xxl); align-items: start; margin-block-end: var(--space-xl-xxl); padding-block: var(--space-sm) var(--space-lg-xl); border-block-end: 1px solid var(--border); min-inline-size: 0; }
  .hero-introduction { grid-column: 1; grid-row: 1 / 3; padding-block: var(--space-sm); overflow-wrap: anywhere; }
  .hero-introduction :global(h1) { margin: 0; line-height: 1.05; font-weight: 700; text-wrap: pretty; }
  .hero-introduction p { margin-block: var(--space-lg) 0; font-size: var(--font-size-md); line-height: 1.5; max-inline-size: 38ch; }
  .without-features { grid-template-columns: minmax(0, 1fr); }
  .hero-track { grid-column: 2; display: flex; min-inline-size: 0; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: thin; scrollbar-color: var(--border) var(--background); }
  .hero-track:focus-visible { outline: 3px solid var(--ring); outline-offset: 5px; }
  .hero-slide { flex: 0 0 100%; min-inline-size: 0; display: flex; flex-direction: column; scroll-snap-align: start; scroll-snap-stop: always; overflow-wrap: anywhere; background: var(--background); color: var(--foreground); }
  img { display: block; inline-size: 100%; aspect-ratio: 16 / 10; object-fit: cover; object-position: center 35%; }
  .hero-copy { padding-block-start: var(--space-sm); min-inline-size: 0; }
  .hero-status { display: inline-block; margin-block-end: var(--space-xs); font-size: var(--font-size-sm); }
  .hero-copy :global(h2) { view-transition-class: event-text; margin: 0; font-size: var(--font-size-lg); line-height: 1.15; font-weight: 700; }
  .hero-copy p { view-transition-class: event-text; margin-block: var(--space-xs) var(--space-sm); font-size: var(--font-size-sm); line-height: 1.5; }
  .hero-meta { display: flex; flex-direction: column; font-size: var(--font-size-sm); line-height: 1.5; color: var(--muted-foreground); }
  .hero-controls { grid-column: 2; display: flex; justify-content: end; align-items: center; gap: var(--space-sm); margin-block-start: var(--space-xs); }
  .hero-position { min-inline-size: 0; color: var(--muted-foreground); text-align: center; font-size: var(--font-size-sm); }
  .hero-position > bdi { display: inline-flex; gap: .35em; }
  @media (max-width: 56rem) {
    .events-hero { grid-template-columns: minmax(0, 1fr); row-gap: var(--space-lg-xl); }
    .hero-introduction { grid-column: 1; grid-row: auto; }
    .hero-introduction p { margin-block-start: var(--space-md); }
    .hero-track, .hero-controls { grid-column: 1; }
    .hero-controls { margin-block-start: calc(-1 * var(--space-lg)); }
  }
</style>
