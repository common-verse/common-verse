<script lang="ts">
  import type { Locale } from "@poetry/i18n";
  import { Heading } from "$lib/components/ui/heading";
  import { Link } from "$lib/components/ui/link";
  import * as m from "../../../paraglide/messages.js";

  let {
    name,
    lang,
    href,
    country,
    poems,
    portrait,
    locale,
  }: {
    name: string;
    /** The name's language: the page's, or German for the fallback name. */
    lang: Locale;
    href: string;
    country: string;
    poems: number;
    /** An uploaded portrait's URL; never a generated face. */
    portrait?: string;
    locale: Locale;
  } = $props();
</script>

<article class="author-card">
  {#if portrait}
    <!-- Decorative: the name follows. -->
    <img class="author-tile" src={portrait} alt="" loading="lazy" decoding="async" />
  {:else}
    <!-- The monogram's bar sits where the name's own script starts. -->
    <span class="author-tile monogram" dir="auto" aria-hidden="true"
      >{[...name][0]?.toLocaleUpperCase(locale)}</span
    >
  {/if}
  <Heading level={2} class="author-card-name"
    ><Link variant="heading" {href}><bdi {lang}>{name}</bdi></Link></Heading
  >
  <p>{country}</p>
  <p class="author-card-count">
    {poems
      ? m.poems_count({ count: poems }, { locale })
      : m.authors_no_poems_yet({}, { locale })}
  </p>
</article>

<style>
  .author-card {
    position: relative;
    display: grid;
    grid-template-columns: 4.5rem minmax(0, 1fr);
    column-gap: var(--space-xs);
    align-items: center;
    padding: var(--space-xs);
    background: var(--card);
    color: var(--card-foreground);
    border: 1px solid var(--border);
    border-radius: var(--panel-radius);
    corner-shape: squircle;
    box-shadow: var(--shadow-card);
    overflow-wrap: anywhere;
    transition: border-color var(--motion-fast) var(--motion-ease);
  }
  .author-card:hover {
    border-color: var(--primary);
  }
  .author-card:has(:global(a:focus-visible)) {
    outline: 3px solid var(--ring);
    outline-offset: 4px;
  }
  .author-card :global(a:focus-visible) {
    outline: none;
  }
  .author-card :global(.author-card-name a::after) {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
  }
  .author-tile {
    grid-row: 1 / span 3;
    display: grid;
    place-items: center;
    inline-size: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: var(--control-radius);
    corner-shape: squircle;
  }
  .monogram {
    position: relative;
    background: var(--primary);
    color: var(--primary-foreground);
    font-family: var(--font-serif);
    font-size: 2.25rem;
    line-height: 1;
  }
  /* The logo's indent bar, in ink. */
  .monogram::before {
    content: "";
    position: absolute;
    inset-block: 26%;
    inset-inline-start: 16%;
    inline-size: 7%;
    border-radius: 2px;
    background: currentColor;
  }
  .author-card :global(.author-card-name) {
    margin: 0;
    font-size: var(--font-size-md);
    font-weight: 500;
    line-height: 1.25;
  }
  p {
    margin: 0;
    font-size: var(--font-size-sm);
  }
  .author-card-count {
    color: var(--muted-foreground);
  }
  @media (min-width: 30rem) {
    .author-card {
      grid-row: span 4;
      grid-template-rows: subgrid;
      grid-template-columns: minmax(0, 1fr);
      row-gap: 0;
      align-items: start;
      padding: var(--space-2xs) var(--space-2xs) var(--space-sm);
    }
    .author-tile {
      grid-row: auto;
      margin-block-end: var(--space-xs);
    }
    .monogram {
      font-size: var(--font-size-xxxl);
    }
    .author-card :global(.author-card-name),
    p {
      padding-inline: var(--space-3xs);
    }
  }
</style>
