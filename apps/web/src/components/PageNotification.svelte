<script lang="ts">
  import { onMount, tick, untrack } from 'svelte'
  import { getLocaleMetadata, type Locale } from '@poetry/i18n'
  import { listen, type Notice, type NoticeTone } from '$lib/notifications'
  import * as m from '../paraglide/messages.js'

  let { notice, focus = false, closeHref = '#notice-closed', locale }: {
    notice?: Notice
    /** Server errors without a field to focus take focus themselves. */
    focus?: boolean
    /** Without JavaScript the close control is a link: the page without its status, or the in-page target below. */
    closeHref?: string
    locale: Locale
  } = $props()

  // relay: a server-rendered notice repeated in a hidden live text, so it is announced once after hydration.
  type Shown = Notice & { key: number; relay?: boolean }
  const tones: NoticeTone[] = ['success', 'error']
  let shown = $state<Partial<Record<NoticeTone, Shown>>>(untrack(() => (notice ? { [notice.tone]: { ...notice, key: 0 } } : {})))
  let hydrated = $state(false)
  let area: HTMLDivElement
  let key = 0
  const options = $derived({ locale })
  const labels = $derived({ success: m.notice_success({}, options), error: m.notice_error({}, options) })

  onMount(() => {
    // The close link becomes a button; keep keyboard focus on it.
    const focused = document.activeElement?.matches('.notice-close') ? (document.activeElement.closest('.notice') as HTMLElement).dataset.tone : undefined
    hydrated = true
    if (focused) tick().then(() => area.querySelector<HTMLElement>(`[data-tone="${focused}"] .notice-close`)?.focus())
    // Text already in a live region at load is not announced; focused errors are read through focus.
    const initial = shown.success ?? (focus ? undefined : shown.error)
    if (initial && !initial.link) requestAnimationFrame(() => { if (shown[initial.tone]?.key === 0) shown[initial.tone]!.relay = true })
    return listen((next) => { shown[next.tone] = { ...next, key: ++key } })
  })

  function close(tone: NoticeTone) {
    const notice = area.querySelector(`[data-tone="${tone}"]`)
    if (notice?.contains(document.activeElement)) document.getElementById('main')?.focus({ preventScroll: true })
    shown[tone] = undefined
  }

  function onkeydown(event: KeyboardEvent) {
    const tone = (document.activeElement?.closest('.notice') as HTMLElement | null)?.dataset.tone as NoticeTone | undefined
    if (event.key === 'Escape' && tone && area.contains(document.activeElement)) close(tone)
  }

  function leave(_node: Element) {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    return { duration: 200, css: (t: number) => (reduce ? `opacity: ${t}` : `translate: 0 ${(t - 1) * 100}%`) }
  }

  const squircle = 'M22.5 12L22.48 15.1L22.42 16.38L22.32 17.34L22.18 18.14L22 18.83L21.77 19.42L21.5 19.95L21.19 20.42L20.83 20.83L20.42 21.19L19.95 21.5L19.42 21.77L18.83 22L18.14 22.18L17.34 22.32L16.38 22.42L15.1 22.48L12 22.5L8.9 22.48L7.62 22.42L6.66 22.32L5.86 22.18L5.17 22L4.58 21.77L4.05 21.5L3.58 21.19L3.17 20.83L2.81 20.42L2.5 19.95L2.23 19.42L2 18.83L1.82 18.14L1.68 17.34L1.58 16.38L1.52 15.1L1.5 12L1.52 8.9L1.58 7.62L1.68 6.66L1.82 5.86L2 5.17L2.23 4.58L2.5 4.05L2.81 3.58L3.17 3.17L3.58 2.81L4.05 2.5L4.58 2.23L5.17 2L5.86 1.82L6.66 1.68L7.62 1.58L8.9 1.52L12 1.5L15.1 1.52L16.38 1.58L17.34 1.68L18.14 1.82L18.83 2L19.42 2.23L19.95 2.5L20.42 2.81L20.83 3.17L21.19 3.58L21.5 4.05L21.77 4.58L22 5.17L22.18 5.86L22.32 6.66L22.42 7.62L22.48 8.9Z'
</script>

<svelte:window {onkeydown} />

{#snippet cross()}
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
{/snippet}

<div class="notices" class:hydrated dir={getLocaleMetadata(locale).direction} bind:this={area}>
  <!-- In-page target of the close link without JavaScript; a hidden target neither scrolls nor matches the skip link. -->
  <span id="notice-closed" hidden></span>
  {#each tones as tone (tone)}
    {@const current = shown[tone]}
    <div class="notice-live" aria-live={tone === 'error' ? 'assertive' : 'polite'}>
      {#if current}
        {#key current.key}
          <!-- svelte-ignore a11y_autofocus, a11y_no_noninteractive_tabindex (only -1, for server errors) -->
          <div
            class="notice"
            data-tone={tone}
            tabindex={focus && current.key === 0 ? -1 : undefined}
            autofocus={focus && current.key === 0}
            onanimationend={(event) => { if (event.animationName.endsWith('notice-life')) close(tone) }}
            out:leave|global
          >
            <div class="notice-inner">
              <svg class="notice-icon" viewBox="0 0 24 24" role="img" aria-label={labels[tone]}>
                <path class="notice-shape" d={squircle} />
                {#if tone === 'success'}
                  <path class="notice-glyph" d="M7.5 12.4l3 3 6-6.6" />
                {:else}
                  <path class="notice-glyph" d="M12 7v6" /><circle class="notice-dot" cx="12" cy="16.6" r="1.4" />
                {/if}
              </svg>
              <p class="notice-text" aria-hidden={current.relay ? 'true' : undefined}>
                {current.text}
                {#if current.link}<a href={current.link.href}>{current.link.label}</a>{/if}
              </p>
              {#if current.relay}<span class="sr-only">{current.text}</span>{/if}
              <!-- Native controls: the shared Button would add its styling runtime to every page. -->
              {#if hydrated}
                <button class="notice-close" type="button" aria-label={m.notice_close({}, options)} onclick={() => close(tone)}>{@render cross()}</button>
              {:else}
                <a class="notice-close" href={closeHref} aria-label={m.notice_close({}, options)}>{@render cross()}</a>
              {/if}
            </div>
          </div>
        {/key}
      {/if}
    </div>
  {/each}
</div>

<style>
  /* Overlays the content under the sticky header: nothing below moves. */
  .notices {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    overflow: clip;
    pointer-events: none;
    padding-block-end: var(--space-md);
  }
  .notice-live {
    display: grid;
  }
  .notice {
    grid-area: 1 / 1;
    pointer-events: auto;
    background: var(--header-background);
    color: var(--foreground);
    border-block-end: 1px solid var(--header-border);
    box-shadow: var(--shadow-raised);
    transition: translate var(--motion-page) var(--motion-ease);
  }
  .notice:focus-visible {
    outline-offset: -3px;
  }
  @starting-style {
    .notice {
      translate: 0 -100%;
    }
  }
  /* Without JavaScript a close link to #notice-closed hides the notices in place. */
  .notices:not(.hydrated):has(#notice-closed:target) .notice {
    display: none;
  }
  .notice-inner {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--space-xs);
    max-inline-size: 72rem;
    margin-inline: auto;
    padding-block: var(--space-2xs);
    padding-left: max(var(--space-gutter), var(--safe-left));
    padding-right: max(var(--space-gutter), var(--safe-right));
  }
  .notice-text {
    margin: 0;
    padding-block: var(--space-3xs);
    min-inline-size: 0;
  }
  .notice-text a {
    font-weight: 600;
  }
  .notice-close {
    display: grid;
    place-items: center;
    inline-size: 2.75rem;
    block-size: 2.75rem;
    padding: 0;
    border: 0;
    border-radius: var(--control-radius);
    corner-shape: squircle;
    background: transparent;
    color: var(--foreground);
    cursor: pointer;
  }
  .notice-close:hover {
    background: var(--accent);
  }
  .notice-close svg {
    inline-size: 1.25rem;
    block-size: 1.25rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }
  .notice-icon {
    inline-size: 1.5rem;
    block-size: 1.5rem;
  }
  .notice-shape {
    stroke: var(--black);
    stroke-width: 1.5;
  }
  .notice-glyph {
    fill: none;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  [data-tone='success'] .notice-shape {
    fill: var(--success);
  }
  [data-tone='success'] .notice-glyph {
    stroke: var(--success-foreground);
  }
  [data-tone='error'] .notice-shape {
    fill: var(--error);
  }
  [data-tone='error'] .notice-glyph {
    stroke: var(--error-foreground);
  }
  .notice-dot {
    fill: var(--error-foreground);
  }
  /* Success closes itself after 6 s: one CSS animation, paused while pointer or focus is on it. */
  .notice[data-tone='success'] {
    animation: notice-life 6s both;
  }
  .notice[data-tone='success']:focus-within {
    animation-play-state: paused;
  }
  /* A tap leaves hover behind on touch screens, which would pause it for good. */
  @media (hover: hover) {
    .notice[data-tone='success']:hover {
      animation-play-state: paused;
    }
  }
  @keyframes notice-life {
    0% {
      translate: 0 -100%;
      animation-timing-function: var(--motion-ease);
    }
    3.5%,
    96% {
      translate: 0 0;
      visibility: visible;
      animation-timing-function: ease-in;
    }
    100% {
      translate: 0 -100%;
      visibility: hidden;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .notice {
      transition: opacity var(--motion-page) ease;
    }
    /* The global reduced-motion rule shortens every animation; this one is also the 6 s timer. */
    .notice[data-tone='success'] {
      animation-duration: 6s !important;
    }
    @starting-style {
      .notice {
        translate: none;
        opacity: 0;
      }
    }
    @keyframes notice-life {
      0% {
        opacity: 0;
      }
      3.5%,
      96% {
        opacity: 1;
        visibility: visible;
      }
      100% {
        opacity: 0;
        visibility: hidden;
      }
    }
  }
</style>
