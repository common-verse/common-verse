<script lang="ts">
  import { locationText } from "../../location";
  import { localizedPath, recordPath, type Locale } from "@poetry/i18n";
  import type { Event } from "@poetry/types";
  import { Heading } from "$lib/components/ui/heading";
  import { Link } from "$lib/components/ui/link";
  import * as m from "../../../paraglide/messages.js";

  let { event, locale }: { event: Event; locale: Locale } = $props();
  const dateFormat = $derived(
    new Intl.DateTimeFormat(locale, {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Europe/Berlin",
    }),
  );
  const href = $derived(localizedPath(locale, recordPath("events", event, locale)));
</script>

<article>
  <div class="event-date">
    <time datetime={event.startDate}
      >{dateFormat.format(new Date(event.startDate))}</time
    >
  </div>
  <div class="event-copy">
    <Heading level={3}
      ><Link variant="heading" {href}>{event.title}</Link></Heading
    >
    {#if locationText(event.location)}<p>{locationText(event.location)}</p>{/if}
    {#if event.description}<p>{event.description}</p>{/if}
  </div>
  <Link
    class="event-details"
    {href}
    aria-label={`${m.home_event_details({}, { locale })}: ${event.title}`}
    >{m.home_event_details({}, { locale })}</Link
  >
</article>
