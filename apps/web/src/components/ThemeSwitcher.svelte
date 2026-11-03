<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import type { Locale } from '@poetry/i18n'
  import type { ThemePreference } from '$lib/theme'
  import * as m from '../paraglide/messages.js'

  let { preference, locale }: { preference: ThemePreference; locale: Locale } = $props()
  let theme = $state(untrack(() => preference))
  let prefersDark = $state(false)
  let hydrated = $state(false)
  let holding = $state(false)
  const options = $derived({ locale })
  const names = $derived({ light: m.theme_light({}, options), dark: m.theme_dark({}, options), system: m.theme_system({}, options) })
  const shown = $derived(theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme)
  const next = $derived(shown === 'dark' ? 'light' : 'dark')
  const description = $derived(
    [m.theme_switch_to({ theme: names[next] }, options), theme === 'system' ? '' : m.theme_reset_hint({ theme: names.system }, options)].join(' ').trim(),
  )
  let holdTimer: ReturnType<typeof setTimeout> | undefined
  let held = false
  let heldKey = false
  /** A held finger also asks for the context menu on Android; a right-click keeps the browser's menu. */
  let touched = false
  let button: HTMLButtonElement
  let reveal: ViewTransition | undefined

  onMount(() => {
    const query = matchMedia('(prefers-color-scheme: dark)')
    const sync = () => { prefersDark = query.matches }
    sync()
    query.addEventListener('change', sync)
    hydrated = true
    return () => query.removeEventListener('change', sync)
  })

  function setTheme(value: ThemePreference) {
    if (value === theme) return
    // The update reads the latest state, so fast repeated presses never apply a stale choice.
    theme = value
    const apply = () => {
      document.documentElement.dataset.theme = theme
      document.cookie = `poetry-theme=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`
    }
    // Typed transitions let the reveal CSS ignore page-navigation transitions.
    if (!document.startViewTransition || !('types' in ViewTransition.prototype)) return apply()
    const { left, top, width, height } = button.getBoundingClientRect()
    document.documentElement.style.setProperty('--theme-origin-x', `${left + width / 2}px`)
    document.documentElement.style.setProperty('--theme-origin-y', `${top + height / 2}px`)
    const transition = document.startViewTransition({ update: apply, types: ['theme'] })
    // A quick second press skips this transition; that is expected, not an error.
    transition.ready.catch(() => {})
    if (!reveal) for (const type of revealEvents) document.addEventListener(type, onPressDuringReveal, true)
    reveal = transition
    transition.finished.finally(() => {
      if (reveal !== transition) return
      reveal = undefined
      for (const type of revealEvents) document.removeEventListener(type, onPressDuringReveal, true)
    })
  }
  // While the reveal runs, the browser sends pointer events to the root element, not the button.
  const revealEvents = ['pointerdown', 'pointerup', 'pointercancel', 'click'] as const
  function onPressDuringReveal(event: MouseEvent) {
    if (button.contains(event.target as Node)) return
    // A release anywhere ends the hold, as leaving the button would.
    if (event.type === 'pointerup' || event.type === 'pointercancel') return endPointerHold()
    const { left, right, top, bottom } = button.getBoundingClientRect()
    if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) return
    if (event.type === 'pointerdown') return onpointerdown(event as PointerEvent)
    event.preventDefault()
    onclick()
  }
  function toggle() {
    // The change event can lag behind a device switch; read what is shown right now.
    prefersDark = matchMedia('(prefers-color-scheme: dark)').matches
    setTheme(next)
  }

  // Holding the button for 500 ms returns to System, the same way for mouse, finger and key.
  function startHold() {
    held = false
    if (theme === 'system') return
    holding = true
    holdTimer = setTimeout(() => {
      held = true
      holding = false
      navigator.vibrate?.(10)
      setTheme('system')
    }, 500)
  }
  // Screen readers mostly click and cannot hold, so they get their own way back.
  function resetForScreenReader() {
    setTheme('system')
    button.focus()
  }
  function cancelHold() {
    clearTimeout(holdTimer)
    holding = false
  }
  function onpointerdown(event: PointerEvent) {
    touched = event.pointerType === 'touch'
    heldKey = false
    if (event.button === 0) startHold()
  }
  // A reveal moves the pointer's target to the root, which must not end a held key.
  const endPointerHold = () => heldKey || cancelHold()
  // The release after a hold also clicks; that click must not toggle again.
  function onclick() {
    if (held) held = false
    else toggle()
  }
  // Enter clicks on press and Space on release; both wait for the release here, so a held key can count.
  const isPress = (event: KeyboardEvent) => event.key === 'Enter' || event.key === ' '
  function onkeydown(event: KeyboardEvent) {
    if (!isPress(event)) return
    event.preventDefault()
    if (event.repeat) return
    heldKey = true
    startHold()
  }
  function onkeyup(event: KeyboardEvent) {
    if (!isPress(event)) return
    event.preventDefault()
    cancelHold()
    if (held) held = false
    else toggle()
  }
</script>

<div class="theme-toggle" data-holding={holding || undefined}>
  <button
    bind:this={button}
    class="theme-button"
    type="button"
    disabled={!hydrated}
    aria-label={`${m.theme_label({}, options)}: ${names[theme]}`}
    aria-describedby="theme-description"
    {onclick}
    {onkeydown}
    {onkeyup}
    oncontextmenu={(event) => touched && event.preventDefault()}
    {onpointerdown}
    onpointerup={endPointerHold}
    onpointercancel={endPointerHold}
    onpointerleave={endPointerHold}
  >
    <!-- Lucide's squircle, starting at the top centre and running clockwise. -->
    <svg class="hold" viewBox="2.4 2.4 19.2 19.2" aria-hidden="true" focusable="false"><path d="M12 3c7.2 0 9 1.8 9 9s-1.8 9-9 9-9-1.8-9-9 1.8-9 9-9" pathLength="100" /></svg>
    <svg class="theme-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <mask id="theme-icon-mask" maskUnits="userSpaceOnUse" x="-4" y="-4" width="32" height="32">
        <rect x="-4" y="-4" width="32" height="32" fill="#fff" />
        <circle class="bite" cx="12" cy="12" r="8" fill="#000" />
        <rect class="half" x="-4" y="-4" width="16" height="32" fill="#000" />
      </mask>
      <circle class="ring" cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2" />
      <circle class="core" cx="12" cy="12" r="9" fill="currentColor" mask="url(#theme-icon-mask)" />
      <path class="rays" d="M19.4 12L21.9 12M17.23 17.23L19 19M12 19.4L12 21.9M6.77 17.23L5 19M4.6 12L2.1 12M6.77 6.77L5 5M12 4.6L12 2.1M17.23 6.77L19 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  </button>
  {#if theme !== 'system'}
    <!-- Reached by the screen reader's own cursor; tabindex -1 keeps it out of the Tab order. -->
    <button type="button" class="sr-only" tabindex="-1" onclick={resetForScreenReader}>{m.theme_reset({ theme: names.system }, options)}</button>
  {/if}
  <span id="theme-description" hidden>{description}</span>
</div>

<style>
  .theme-toggle {
    --morph: 520ms;
    /* Spring with 13% overshoot, sampled for linear(). */
    --spring: linear(0, 0.049, 0.172, 0.334, 0.508, 0.674, 0.819, 0.936, 1.023, 1.082, 1.114, 1.126, 1.122, 1.109, 1.089, 1.067, 1.046, 1.027, 1.011, 0.999, 0.991, 0.986, 0.984, 0.984, 0.986, 0.988, 0.991, 0.994, 0.996, 0.998, 1);
    position: relative;
  }
  .theme-button {
    position: relative;
    display: inline-grid;
    place-items: center;
    inline-size: 2.75rem;
    block-size: 2.75rem;
    padding: 0;
    border: 0;
    border-radius: var(--control-radius);
    corner-shape: squircle;
    background: transparent;
    color: var(--header-foreground);
    cursor: pointer;
    -webkit-touch-callout: none;
    user-select: none;
  }
  .theme-button:hover {
    background: var(--accent);
  }
  /* A held button fills this ring in 500 ms, then the theme returns to System. */
  .hold {
    position: absolute;
    inset: -0.25rem;
    inline-size: calc(100% + 0.5rem);
    block-size: calc(100% + 0.5rem);
    pointer-events: none;
  }
  /* 1.1 view-box units are 3px at the 52px size. */
  .hold path {
    fill: none;
    stroke: var(--primary);
    stroke-width: 1.1;
    stroke-linecap: round;
    stroke-dasharray: 100;
    stroke-dashoffset: 100;
    opacity: 0;
  }
  [data-holding] .hold path {
    opacity: 1;
    stroke-dashoffset: 0;
    transition: stroke-dashoffset 500ms linear;
  }
  /* The reveal switches transitions off; a hold started meanwhile would show the ring full at once. */
  :global(:root:active-view-transition-type(theme)) [data-holding] .hold path {
    transition: stroke-dashoffset 500ms linear !important;
  }

  /* One icon: System is a half-filled circle, Light a sun, Dark a moon. */
  .theme-icon {
    inline-size: 1.5rem;
    block-size: 1.5rem;
    overflow: visible;
    transition: rotate var(--morph) var(--spring);
  }
  .theme-icon * {
    transform-box: view-box;
    transform-origin: 12px 12px;
    transition:
      transform var(--morph) var(--spring),
      opacity var(--motion-fast) var(--motion-ease);
  }
  @media (prefers-reduced-motion: no-preference) {
    :global(:root:active-view-transition-type(theme)) .theme-icon * {
      transition:
        transform var(--morph) var(--spring),
        opacity var(--motion-fast) var(--motion-ease) !important;
    }
  }
  .bite {
    transform: translate(14px, -14px);
  }
  .rays {
    opacity: 0;
    transform: rotate(-90deg) scale(0.3);
  }
  :global(:root[data-theme='light']) .ring,
  :global(:root[data-theme='dark']) .ring {
    opacity: 0;
    transform: scale(0.5);
  }
  :global(:root[data-theme='light']) .half,
  :global(:root[data-theme='dark']) .half {
    transform: translateX(-17px);
  }
  :global(:root[data-theme='light']) .core {
    transform: scale(0.46);
  }
  :global(:root[data-theme='light']) .rays {
    opacity: 1;
    transform: none;
  }
  :global(:root[data-theme='dark']) .theme-icon {
    rotate: -24deg;
  }
  :global(:root[data-theme='dark']) .bite {
    transform: translate(5.5px, -5.5px);
  }
</style>
