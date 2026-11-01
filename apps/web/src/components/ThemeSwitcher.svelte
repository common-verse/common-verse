<script lang="ts">
  import { onMount, untrack } from 'svelte'
  import { getLocaleMetadata, type Locale } from '@poetry/i18n'
  import type { ThemePreference } from '$lib/theme'
  import * as m from '../paraglide/messages.js'

  let { preference, locale }: { preference: ThemePreference; locale: Locale } = $props()
  let theme = $state(untrack(() => preference))
  let prefersDark = $state(false)
  let hydrated = $state(false)
  let tipOff = $state(false)
  const options = $derived({ locale })
  const names = $derived({ light: m.theme_light({}, options), dark: m.theme_dark({}, options), system: m.theme_system({}, options) })
  const shown = $derived(theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme)
  const next = $derived(shown === 'dark' ? 'light' : 'dark')
  const tooltip = $derived(
    `${names[theme]} · ${theme === 'system' ? m.theme_tooltip_toggle({ theme: names[next] }, options) : m.theme_tooltip_reset({ theme: names.system }, options)}`,
  )
  const description = $derived(
    [m.theme_switch_to({ theme: names[next] }, options), theme === 'system' ? '' : m.theme_reset_hint({ theme: names.system }, options)].join(' ').trim(),
  )
  let pressTimer: ReturnType<typeof setTimeout> | undefined
  let longPressed = false
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
    if (!reveal) for (const type of ['click', 'contextmenu']) document.addEventListener(type, onPressDuringReveal, true)
    reveal = transition
    transition.finished.finally(() => {
      if (reveal !== transition) return
      reveal = undefined
      for (const type of ['click', 'contextmenu']) document.removeEventListener(type, onPressDuringReveal, true)
    })
  }
  // While the reveal runs, the browser sends pointer events to the root element, not the button.
  function onPressDuringReveal(event: Event) {
    const { clientX: x, clientY: y, target } = event as MouseEvent
    if (button.contains(target as Node)) return
    const { left, right, top, bottom } = button.getBoundingClientRect()
    if (x < left || x > right || y < top || y > bottom) return
    event.preventDefault()
    if (event.type === 'contextmenu') setTheme('system')
    else onclick()
  }
  function onclick() {
    if (longPressed) { longPressed = false; return }
    // The change event can lag behind a device switch; read what is shown right now.
    prefersDark = matchMedia('(prefers-color-scheme: dark)').matches
    setTheme(next)
  }
  function onkeydown(event: KeyboardEvent) {
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); setTheme('system') }
    if (event.key === 'Escape') tipOff = true
  }
  // iOS Safari fires no contextmenu on a long press.
  function onpointerdown(event: PointerEvent) {
    longPressed = false
    if (event.pointerType === 'touch') pressTimer = setTimeout(() => { longPressed = true; setTheme('system') }, 500)
  }
  const cancelPress = () => clearTimeout(pressTimer)
</script>

<div class="theme-toggle" data-tip-off={tipOff || undefined}>
  <button
    bind:this={button}
    type="button"
    disabled={!hydrated}
    aria-label={`${m.theme_label({}, options)}: ${names[theme]}`}
    aria-describedby="theme-description"
    {onclick}
    {onkeydown}
    oncontextmenu={(event) => { event.preventDefault(); setTheme('system') }}
    {onpointerdown}
    onpointerup={cancelPress}
    onpointercancel={cancelPress}
    onpointerleave={cancelPress}
    onblur={() => (tipOff = false)}
    onmouseleave={() => (tipOff = false)}
  >
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
  <span class="tip" dir={getLocaleMetadata(locale).direction} aria-hidden="true">{tooltip}</span>
  <span id="theme-description" hidden>{description}</span>
</div>

<style>
  .theme-toggle {
    --morph: 520ms;
    /* Spring with 13% overshoot, sampled for linear(). */
    --spring: linear(0, 0.049, 0.172, 0.334, 0.508, 0.674, 0.819, 0.936, 1.023, 1.082, 1.114, 1.126, 1.122, 1.109, 1.089, 1.067, 1.046, 1.027, 1.011, 0.999, 0.991, 0.986, 0.984, 0.984, 0.986, 0.988, 0.991, 0.994, 0.996, 0.998, 1);
    position: relative;
  }
  button {
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
  button:hover {
    background: var(--accent);
  }
  /* Tooltip: hover where hover exists, and keyboard focus; Escape hides it. Physical side: the header is LTR. */
  .tip {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    z-index: 5;
    padding: 0.375rem 0.625rem;
    border-radius: 0.625rem;
    corner-shape: squircle;
    background: var(--foreground);
    color: var(--background);
    font-size: var(--font-size-sm);
    font-weight: 600;
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    translate: 0 -2px;
    pointer-events: none;
    transition:
      opacity var(--motion-fast) var(--motion-ease),
      translate var(--motion-fast) var(--motion-ease),
      visibility var(--motion-fast);
  }
  /* Bridges the gap so the pointer can move onto the tooltip. */
  .tip::before {
    content: '';
    position: absolute;
    inset: -0.625rem 0 100% 0;
  }
  @media (hover: hover) {
    .theme-toggle:hover .tip {
      opacity: 1;
      visibility: visible;
      translate: 0 0;
      pointer-events: auto;
      transition-delay: 350ms;
    }
  }
  .theme-toggle:has(:focus-visible) .tip {
    opacity: 1;
    visibility: visible;
    translate: 0 0;
  }
  .theme-toggle[data-tip-off] .tip {
    opacity: 0;
    visibility: hidden;
    transition-delay: 0s;
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
