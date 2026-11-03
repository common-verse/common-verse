<script lang="ts">
  import { onMount } from 'svelte'
  import type { HTMLInputAttributes } from 'svelte/elements'
  import { cleanCode, codeLength, findCode } from '$lib/order-code'

  // One real text field over eight drawn cells: one tab stop and native editing. Without
  // JavaScript it is a plain text field (hyphen allowed) whose value the server reads.
  let { value = $bindable(''), oncomplete, ...inputProps }: Omit<HTMLInputAttributes, 'value'> & {
    value?: string
    /** Called when an edit leaves all eight characters filled. */
    oncomplete?: () => void
  } = $props()

  let input: HTMLInputElement
  const cells: HTMLElement[] = []
  let enhanced = $state(false)
  let focused = $state(false)
  let start = $state(0)
  let end = $state(0)
  let pressed = false
  const single = $derived(end - start <= 1)

  onMount(() => {
    // Keeps what was typed before hydration.
    value = cleanCode(input.value).slice(0, codeLength)
    enhanced = true
    const changed = () => document.activeElement === input && sync()
    // Fired at the field in some browsers and at the document in others; capture sees both.
    document.addEventListener('selectionchange', changed, true)
    return () => document.removeEventListener('selectionchange', changed, true)
  })

  /** A caret inside the code selects the character after it, so typing replaces it. */
  function sync() {
    if (!enhanced || document.activeElement !== input) return
    const length = input.value.length
    if (input.selectionStart === input.selectionEnd) {
      const at = Math.min(input.selectionStart ?? length, codeLength - 1)
      if (at < length) input.setSelectionRange(at, at + 1)
    }
    start = input.selectionStart ?? 0
    end = input.selectionEnd ?? 0
  }

  function place(index: number) {
    const at = Math.max(0, Math.min(index, input.value.length))
    input.setSelectionRange(at, at)
    sync()
  }

  function write(next: string, caret: number) {
    const changed = next !== value
    input.value = next
    value = next
    place(caret)
    if (changed && next.length === codeLength) oncomplete?.()
  }

  // A character a code cannot hold leaves the field as it is, instead of replacing the selected one.
  function filter(event: InputEvent) {
    if (enhanced && event.inputType === 'insertText' && event.data && !cleanCode(event.data)) event.preventDefault()
  }

  function edited(event: Event) {
    if (!enhanced || (event as InputEvent).isComposing) return
    const caret = input.selectionStart ?? input.value.length
    const before = cleanCode(input.value.slice(0, caret))
    write((before + cleanCode(input.value.slice(caret))).slice(0, codeLength), before.length)
  }

  function pasted(event: ClipboardEvent) {
    if (!enhanced) return
    event.preventDefault()
    const text = event.clipboardData?.getData('text/plain') ?? ''
    const code = findCode(text)
    if (code) return write(code, codeLength)
    const added = cleanCode(text)
    const from = input.selectionStart ?? value.length
    write((value.slice(0, from) + added + value.slice(input.selectionEnd ?? from)).slice(0, codeLength), from + added.length)
  }

  function keydown(event: KeyboardEvent) {
    if (!enhanced || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
    const from = input.selectionStart ?? 0
    const to = input.selectionEnd ?? 0
    const range = to - from > 1
    const target = {
      ArrowLeft: range ? from : from - 1,
      ArrowRight: range ? to : from + 1,
      ArrowUp: 0,
      Home: 0,
      ArrowDown: codeLength,
      End: codeLength,
    }[event.key]
    if (target === undefined) return
    event.preventDefault()
    place(target)
  }

  // A click or tap puts the caret into the nearest cell, at most right after the last character.
  function clicked(event: MouseEvent) {
    pressed = false
    if (!enhanced) return
    const distances = cells.map((cell) => {
      const { left, width } = cell.getBoundingClientRect()
      return Math.abs(event.clientX - (left + width / 2))
    })
    place(distances.indexOf(Math.min(...distances)))
  }

  function focusin() {
    focused = true
    // Focus without a selection (a script, the label) starts after the last character;
    // a click places the caret itself, Tab keeps the browser's select-all.
    if (pressed) pressed = false
    else if (input.selectionStart === input.selectionEnd) place(codeLength)
    else sync()
  }
</script>

<div class="code-box">
  <div class="code-input" data-enhanced={enhanced ? '' : undefined} data-range={focused && !single ? '' : undefined}>
    <input
      bind:this={input}
      type="text"
      inputmode="text"
      autocomplete="off"
      autocapitalize="characters"
      spellcheck="false"
      enterkeyhint="next"
      maxlength={16}
      {...inputProps}
      dir="ltr"
      {value}
      onbeforeinput={filter}
      oninput={edited}
      oncompositionend={edited}
      onpaste={pasted}
      onkeydown={keydown}
      onpointerdown={() => (pressed = true)}
      onclick={clicked}
      onfocus={focusin}
      onblur={() => (focused = false)}
    />
    <div class="code-cells" aria-hidden="true" dir="ltr">
      {#each [0, 4] as from (from)}
        {#if from}<span class="code-sep"></span>{/if}
        <span class="code-group">
          {#each [0, 1, 2, 3] as offset (offset)}
            {@const index = from + offset}
            {@const character = enhanced ? (value[index] ?? '') : ''}
            {@const active = focused && single && index === start}
            <span
              class="code-cell"
              bind:this={cells[index]}
              data-active={active ? '' : undefined}
              data-selected={focused && !single && index >= start && index < end ? '' : undefined}
              data-caret={active && !character ? '' : undefined}>{character}</span
            >
          {/each}
        </span>
      {/each}
    </div>
  </div>
</div>

<style>
  .code-box {
    container-type: inline-size;
  }
  /* As wide as the other fields; cells share the width but never get narrower than 2rem. */
  .code-input {
    --code-gap: 1.5rem;
    --cell-inline: max(2rem, (100cqi - var(--code-gap)) / 8);
    position: relative;
    display: grid;
    inline-size: 100%;
    min-inline-size: calc(8 * 2rem + var(--code-gap));
    block-size: clamp(3rem, var(--cell-inline) * 7 / 6, 3.5rem);
    /* Monospace with a slashed or dotted zero, so 0 never reads as O. */
    font-family: ui-monospace, Menlo, Monaco, Consolas, 'Cascadia Mono', 'Roboto Mono', 'DejaVu Sans Mono', 'Liberation Mono', monospace;
    font-feature-settings: 'zero';
    font-size: clamp(1.125rem, var(--cell-inline) / 2, 1.5rem);
    font-weight: 700;
  }
  .code-input input {
    grid-area: 1 / 1;
    min-block-size: 0;
    block-size: 100%;
    font: inherit;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .code-input input::placeholder {
    font-weight: 400;
    text-transform: none;
  }
  .code-cells {
    display: none;
  }

  /* With JavaScript the field stays the focused control, invisible over the cells. */
  [data-enhanced] input {
    z-index: 1;
    opacity: 0;
    outline: none;
  }
  [data-enhanced] .code-cells {
    grid-area: 1 / 1;
    display: flex;
  }
  .code-group {
    display: flex;
    flex: 1;
    border-radius: var(--control-radius);
    corner-shape: squircle;
  }
  .code-sep {
    display: grid;
    flex: none;
    place-items: center;
    inline-size: var(--code-gap);
  }
  .code-sep::before {
    content: '';
    inline-size: 0.625rem;
    border-block-start: 2px solid var(--muted-foreground);
  }
  /* The cells of a group share their borders; only the group's outer corners are rounded. */
  .code-cell {
    display: grid;
    flex: 1;
    place-items: center;
    border: 1px solid var(--input);
    background: var(--background);
    color: var(--foreground);
    corner-shape: squircle;
  }
  .code-cell + .code-cell {
    margin-inline-start: -1px;
  }
  .code-cell:first-child {
    border-start-start-radius: var(--control-radius);
    border-end-start-radius: var(--control-radius);
  }
  .code-cell:last-child {
    border-start-end-radius: var(--control-radius);
    border-end-end-radius: var(--control-radius);
  }
  /* The one focus indicator: the active cell, or the whole code while a range is selected. */
  .code-cell[data-active] {
    z-index: 1;
    border-color: var(--ring);
    outline: 3px solid var(--ring);
  }
  [data-range] {
    border-radius: var(--control-radius);
    corner-shape: squircle;
    outline: 3px solid var(--ring);
    outline-offset: 4px;
  }
  .code-cell[data-selected] {
    background: var(--accent);
    color: var(--accent-foreground);
  }
  .code-cell[data-caret]::after {
    content: '';
    block-size: 1.1em;
    border-inline-start: 2px solid var(--foreground);
    animation: code-caret 1.1s steps(1) infinite;
  }
  @keyframes code-caret {
    50% {
      opacity: 0;
    }
  }
  .code-input:has(input[aria-invalid='true']) .code-cell:not([data-active]) {
    border-color: var(--error);
  }
  /* The second pixel as shadow, as on every invalid field. */
  .code-input:has(input[aria-invalid='true']) .code-group {
    box-shadow: 0 0 0 1px var(--error);
  }
  @media (prefers-reduced-motion: reduce) {
    .code-cell[data-caret]::after {
      animation: none;
    }
  }
  @media (forced-colors: active) {
    .code-cell[data-active],
    [data-range] {
      outline-color: Highlight;
    }
    .code-cell[data-selected] {
      forced-color-adjust: none;
      background: Highlight;
      color: HighlightText;
    }
    .code-input:has(input[aria-invalid='true']) .code-cell {
      border-style: dashed;
    }
  }
</style>
