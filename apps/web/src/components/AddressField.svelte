<script lang="ts">
  import { onMount } from 'svelte'
  import type { Locale } from '@poetry/i18n'
  import type { HTMLInputAttributes } from 'svelte/elements'
  import { Field } from '$lib/components/ui/field'
  import { minQueryLength, type AddressSuggestion } from '$lib/address'
  import { formatNumber } from '$lib/shop'
  import * as m from '../paraglide/messages.js'

  // The street field as an ARIA 1.2 combobox with Photon suggestions from /api/address.
  // Without JavaScript, or when the search fails, it is a plain text field.
  let { id, label, hint, messages, error, locale, onpick, value = $bindable(), oninput, onblur, ...inputProps }: Omit<HTMLInputAttributes, 'id' | 'oninput' | 'onblur'> & {
    id: string
    label: string
    hint?: string
    messages?: Record<string, string>
    error?: string
    locale: Locale
    onpick: (suggestion: AddressSuggestion) => void
    oninput?: (event: Event) => void
    onblur?: () => void
  } = $props()

  const options = $derived({ locale })
  const listID = $derived(`${id}-suggestions`)
  let hydrated = $state(false)
  let suggestions = $state<AddressSuggestion[]>([])
  let open = $state(false)
  let active = $state(-1)
  let status = $state('')
  let timer: ReturnType<typeof setTimeout> | undefined
  let request: AbortController | undefined
  // Counts searches and dismissals: only the latest search, not dismissed since, may open the list.
  let sequence = 0
  onMount(() => {
    hydrated = true
    return cancel
  })

  function cancel() {
    sequence++
    clearTimeout(timer)
    request?.abort()
  }

  function close() {
    open = false
    active = -1
  }

  async function search(query: string) {
    cancel()
    const current = sequence
    request = new AbortController()
    let found: AddressSuggestion[]
    try {
      const response = await fetch(`/api/address?q=${encodeURIComponent(query)}`, { signal: request.signal })
      found = response.ok ? ((await response.json()).suggestions ?? []) : []
    } catch {
      // Aborted by newer typing or a dismissal, offline or Photon down: no suggestions, no message.
      return
    }
    // A late answer after Escape, a pick, newer typing or leaving the field stays closed.
    if (current !== sequence || document.activeElement?.id !== id) return
    suggestions = found
    active = -1
    open = suggestions.length > 0
    status = open ? m.shop_address_count({ count: formatNumber(suggestions.length, locale) }, options) : ''
  }

  function typed(event: Event) {
    oninput?.(event)
    cancel()
    // Autofill fills street, postcode and city at once; it needs no suggestions.
    const input = event as InputEvent
    if (!input.inputType || input.inputType === 'insertReplacementText') return close()
    const query = (event.currentTarget as HTMLInputElement).value.trim()
    if (query.length < minQueryLength) {
      suggestions = []
      return close()
    }
    timer = setTimeout(() => search(query), 180)
  }

  function pick(index: number) {
    const suggestion = suggestions[index]
    if (!suggestion) return
    cancel()
    onpick(suggestion)
    close()
    suggestions = []
    status = m.shop_address_picked({ address: `${suggestion.line1}, ${suggestion.postalCode} ${suggestion.city}` }, options)
  }

  function keydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!suggestions.length) return
      event.preventDefault()
      const count = suggestions.length
      if (!open) open = true
      active = event.key === 'ArrowDown' ? (active + 1) % count : active <= 0 ? count - 1 : active - 1
    } else if (event.key === 'Enter' && open && active >= 0) {
      event.preventDefault()
      pick(active)
    } else if (event.key === 'Escape') {
      // Closes only the list, not a notice or the page's other Escape handlers.
      if (open) {
        event.preventDefault()
        event.stopPropagation()
      }
      cancel()
      close()
    } else if (event.key === 'Tab') close()
  }

  $effect(() => {
    if (active >= 0) document.getElementById(`${listID}-${active}`)?.scrollIntoView({ block: 'nearest' })
  })
</script>

<Field {id} {label} {hint} {messages} {error}>
  {#snippet control(attributes)}
    <div class="combobox">
      <input
        {...inputProps}
        {...attributes}
        bind:value
        oninput={typed}
        onblur={() => { cancel(); close(); onblur?.() }}
        onkeydown={keydown}
        role={hydrated ? 'combobox' : undefined}
        aria-autocomplete={hydrated ? 'list' : undefined}
        aria-expanded={hydrated ? open : undefined}
        aria-controls={hydrated ? listID : undefined}
        aria-activedescendant={open && active >= 0 ? `${listID}-${active}` : undefined}
      />
      <!-- Overlays the fields below instead of pushing them down. -->
      <div class="suggestions" hidden={!open}>
        <ul id={listID} role="listbox" aria-label={m.shop_address_suggestions({}, options)}>
          {#each suggestions as suggestion, index (`${suggestion.line1}|${suggestion.postalCode}`)}
            <!-- Keys are handled on the combobox; pointer presses keep focus there and the click picks. -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <li id="{listID}-{index}" role="option" aria-selected={index === active}
              onpointerdown={(event) => event.preventDefault()} onclick={() => pick(index)}>
              <span class="line1" dir="ltr">{suggestion.line1}</span>
              <span class="place" dir="ltr">{suggestion.postalCode} {suggestion.city}{suggestion.area ? `, ${suggestion.area}` : ''}</span>
            </li>
          {/each}
        </ul>
        <p class="attribution">
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" tabindex="-1"
            onpointerdown={(event) => event.preventDefault()}>{m.shop_address_attribution({}, options)}</a>
        </p>
      </div>
    </div>
  {/snippet}
</Field>
<p class="sr-only" role="status">{status}</p>

<style>
  .combobox { position: relative; }
  .suggestions {
    position: absolute; z-index: 15; inset-block-start: calc(100% + var(--space-3xs)); inset-inline: 0;
    border: 1px solid var(--border); border-radius: var(--control-radius); corner-shape: squircle;
    background: var(--popover); color: var(--popover-foreground); box-shadow: var(--shadow-floating); overflow: hidden;
  }
  .suggestions[hidden] { display: none; }
  ul { margin: 0; padding: var(--space-3xs); list-style: none; }
  li {
    display: grid; padding: var(--space-2xs) var(--space-xs); border-radius: calc(var(--control-radius) - var(--space-3xs)); corner-shape: squircle;
    cursor: pointer; touch-action: manipulation; text-align: start;
  }
  li:hover, li[aria-selected='true'] { background: var(--accent); color: var(--accent-foreground); }
  /* The selection is not only a colour. */
  li[aria-selected='true'] { box-shadow: inset 3px 0 0 var(--foreground); }
  :global([dir='rtl']) li[aria-selected='true'] { box-shadow: inset -3px 0 0 var(--foreground); }
  .line1 { font-weight: 600; }
  .place { font-size: var(--font-size-sm); color: var(--muted-foreground); }
  li[aria-selected='true'] .place { color: inherit; }
  .attribution { margin: 0; padding: var(--space-3xs) var(--space-xs); border-block-start: 1px solid var(--border); font-size: var(--font-size-sm); color: var(--muted-foreground); }
  .attribution a { color: inherit; }
  @media (forced-colors: active) {
    li[aria-selected='true'] { outline: 2px solid Highlight; outline-offset: -2px; }
  }
</style>
