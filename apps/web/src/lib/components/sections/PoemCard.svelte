<script lang="ts">
  import { getLocaleMetadata, type Locale } from "@poetry/i18n";
  import { Info } from "lucide-svelte";
  import { Heading, type HeadingLevel } from "$lib/components/ui/heading";
  import { Link } from "$lib/components/ui/link";
  import type { PoemTeaser } from "$lib/poems";
  import * as m from "../../../paraglide/messages.js";

  let {
    poem,
    locale,
    level = 2,
  }: { poem: PoemTeaser; locale: Locale; level?: HeadingLevel } = $props();
</script>

<!-- The whole card takes the direction of the version it shows. -->
<article
  class="poem-card"
  lang={poem.language}
  dir={getLocaleMetadata(poem.language).direction}
>
  <Heading {level} class="poem-card-title"
    ><Link variant="heading" href={poem.href}>{poem.title}</Link></Heading
  >
  <p class="poem-card-meta">
    {#if poem.author}<bdi lang={poem.author.lang}>{poem.author.name}</bdi>{/if}
    {#if poem.author && poem.year}{" · "}{/if}
    {#if poem.year}<span class="poem-card-year"><bdi>{poem.year}</bdi></span>{/if}
  </p>
  <p class="excerpt">
    {#each poem.lines as line, index (index)}<span>{line}</span>{/each}
  </p>
  {#if poem.language !== locale}
    <p class="poem-note">
      <Info aria-hidden="true" /><bdi
        lang={locale}
        dir={getLocaleMetadata(locale).direction}
        >{m.poem_not_available({}, { locale })}</bdi
      >
    </p>
  {/if}
</article>

<style>
  .poem-card {
    position: relative;
    display: grid;
    grid-row: span 4;
    grid-template-rows: subgrid;
    row-gap: 0;
    min-inline-size: 0;
    padding: var(--space-sm) var(--space-sm) var(--space-md);
    background: var(--card);
    color: var(--card-foreground);
    border: 1px solid var(--border);
    border-radius: var(--panel-radius);
    corner-shape: squircle;
    box-shadow: var(--shadow-card);
    overflow-wrap: anywhere;
    transition:
      border-color var(--motion-fast) var(--motion-ease),
      box-shadow var(--motion-fast) var(--motion-ease);
  }
  .poem-card:hover {
    border-color: var(--primary);
    box-shadow: var(--shadow-raised);
  }
  /* One link per card, stretched over it; the ring surrounds the card. */
  .poem-card:has(:global(a:focus-visible)) {
    outline: 3px solid var(--ring);
    outline-offset: 4px;
  }
  .poem-card :global(.poem-card-title) {
    margin: 0 0 var(--space-3xs);
    color: var(--primary);
    font-size: var(--font-size-lg);
    font-weight: 500;
    line-height: 1.2;
  }
  .poem-card :global(.poem-card-title a::after) {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }
  .poem-card :global(.poem-card-title a:focus-visible) {
    outline: none;
  }
  .poem-card-meta {
    margin: 0 0 var(--space-xs);
    font-size: var(--font-size-sm);
    font-weight: 600;
  }
  .poem-card-year {
    color: var(--muted-foreground);
    font-weight: 400;
  }
  .excerpt {
    align-self: start;
    margin: 0;
    padding-inline-start: var(--space-xs);
    font-size: var(--font-size-base);
    line-height: var(--verse-line-height);
  }
  .poem-note {
    align-self: end;
    margin: var(--space-sm) 0 0;
  }
</style>
