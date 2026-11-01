<script lang="ts" module>
  import type { CartViewLine } from '$lib/shop'

  export type CartEntry =
    | { kind: 'line'; line: CartViewLine; fresh?: boolean; busy?: boolean }
    | { kind: 'undo'; product: string; quantity: number; title: string; titleLanguage: string | null }

  /** With handlers the drawer updates in place; without them every control is a form submit. */
  export interface CartHandlers {
    quantity: (line: CartViewLine, quantity: number) => void
    remove: (line: CartViewLine) => void
    undo: (entry: Extract<CartEntry, { kind: 'undo' }>) => void
    announce: (text: string) => void
  }
</script>

<script lang="ts">
  import { Minus, Plus } from 'lucide-svelte'
  import { localizedPath, type Locale } from '@poetry/i18n'
  import { Button } from '$lib/components/ui/button'
  import { formatNumber, formatPrice, isolate, maxQuantity, titleAttributes } from '$lib/shop'
  import * as m from '../paraglide/messages.js'

  let { entries, locale, action, handlers }: { entries: CartEntry[]; locale: Locale; action: string; handlers?: CartHandlers } = $props()
  const options = $derived({ locale })
  const title = (line: CartViewLine) => line.title ?? m.shop_not_available({}, options)
  const limitHint = (line: CartViewLine) =>
    line.stockLimited ? m.shop_stock_left({ count: formatNumber(line.max, locale) }, options) : m.shop_max_per_book({ max: formatNumber(maxQuantity, locale) }, options)

  function step(event: MouseEvent, line: CartViewLine, quantity: number) {
    if (!handlers) return
    event.preventDefault()
    // Any decrease is allowed, also from far above the stock; an increase stops at the limit.
    if (quantity >= 1 && (quantity < line.quantity || quantity <= line.max)) handlers.quantity(line, quantity)
    else if (quantity > line.quantity) handlers.announce(limitHint(line))
  }
</script>

<ul class="cart-lines">
  {#each entries as entry (entry.kind === 'line' ? entry.line.id : `undo-${entry.product}`)}
    {#if entry.kind === 'line'}
      {@const line = entry.line}
      {@const atMax = line.max > 0 && line.quantity >= line.max}
      <li class="cart-line" id="line-{line.id}" data-fresh={entry.fresh ? '' : undefined} aria-busy={entry.busy ? 'true' : undefined}>
        <div class="cart-cover">{#if line.cover}<img src={line.cover.url} alt="" width={line.cover.width} height={line.cover.height} loading="lazy" />{/if}</div>
        <div class="cart-line-text">
          {#if line.slug}
            <a class="cart-line-title" id="title-{line.id}" href={localizedPath(locale, `shop/${line.slug}`)} {...titleAttributes(line)}>{title(line)}</a>
          {:else}
            <span class="cart-line-title" id="title-{line.id}">{title(line)}</span>
          {/if}
          {#if line.quantity > 1 && line.unitPrice}<span class="cart-line-meta">{m.shop_each({ price: formatPrice(line.unitPrice, locale) }, options)}</span>{/if}
        </div>
        <bdi class="price cart-line-total">{formatPrice(line.unitPrice * line.quantity, locale)}</bdi>
        <div class="cart-line-controls">
          {#if line.max > 0}
            <form class="stepper" method="post" {action} role="group" aria-label={m.shop_quantity_of({ title: isolate(title(line)) }, options)}>
              <input type="hidden" name="action" value="update" />
              <input type="hidden" name="item" value={line.id} />
              <button type="submit" name="quantity" value={line.quantity - 1} aria-label={m.shop_decrease({}, options)}
                disabled={!handlers && line.quantity <= 1} aria-disabled={handlers && line.quantity <= 1 ? 'true' : undefined}
                onclick={(event) => step(event, line, line.quantity - 1)}><Minus size={18} aria-hidden="true" /></button>
              <output>{formatNumber(line.quantity, locale)}</output>
              <button type="submit" name="quantity" value={line.quantity + 1} aria-label={m.shop_increase({}, options)}
                disabled={!handlers && atMax} aria-disabled={handlers && atMax ? 'true' : undefined} aria-describedby={atMax ? `limit-${line.id}` : undefined}
                onclick={(event) => step(event, line, line.quantity + 1)}><Plus size={18} aria-hidden="true" /></button>
            </form>
          {/if}
          <form method="post" {action}>
            <input type="hidden" name="action" value="remove" />
            <input type="hidden" name="item" value={line.id} />
            <Button type="submit" variant={line.max > 0 ? 'ghost' : 'outline'} size="sm" aria-describedby="title-{line.id}"
              onclick={(event: MouseEvent) => { if (handlers) { event.preventDefault(); handlers.remove(line) } }}>{m.shop_remove({}, options)}</Button>
          </form>
        </div>
        {#if !line.available}
          <p class="cart-line-error">{line.max === 0 ? m.shop_sold_out_line({}, options) : m.shop_line_unavailable({}, options)}</p>
        {:else if atMax}
          <p class="cart-line-hint" id="limit-{line.id}">{limitHint(line)}</p>
        {/if}
      </li>
    {:else}
      <li class="cart-undo">
        <span id="undo-text-{entry.product}">{m.shop_removed_line({ title: isolate(entry.title) }, options)}</span>
        <form method="post" {action}>
          <input type="hidden" name="action" value="add" />
          <input type="hidden" name="product" value={entry.product} />
          <input type="hidden" name="quantity" value={entry.quantity} />
          <Button type="submit" variant="outline" size="sm" id="undo-{entry.product}" aria-describedby="undo-text-{entry.product}"
            onclick={(event: MouseEvent) => { if (handlers) { event.preventDefault(); handlers.undo(entry) } }}>{m.shop_undo({}, options)}</Button>
        </form>
      </li>
    {/if}
  {/each}
</ul>

<style>
  .cart-lines { display: grid; grid-template-columns: 3.5rem minmax(0, 1fr) auto; column-gap: var(--space-sm); margin: 0; padding: 0; list-style: none; }
  .cart-line, .cart-undo {
    position: relative; isolation: isolate; grid-column: 1 / -1; display: grid; grid-template-columns: subgrid; align-items: start;
    padding-block: var(--space-sm); border-block-end: 1px solid var(--border);
  }
  .cart-line { row-gap: var(--space-2xs); }
  /* Every cover sits in the same square frame. */
  .cart-cover {
    grid-row: span 2; display: grid; place-items: center; aspect-ratio: 1; padding: var(--space-3xs);
    border-radius: 0.5rem; corner-shape: squircle; background: var(--muted);
  }
  .cart-cover img { display: block; inline-size: 100%; block-size: 100%; object-fit: contain; }
  .cart-line-text { display: grid; gap: var(--space-3xs); min-inline-size: 0; overflow-wrap: anywhere; }
  .cart-line-title { font-family: var(--font-serif); font-size: var(--font-size-md); line-height: 1.25; text-decoration: none; }
  a.cart-line-title:hover { text-decoration: underline; }
  .cart-line-meta { font-size: var(--font-size-sm); color: var(--muted-foreground); }
  .cart-line-total { font-weight: 700; justify-self: end; }
  .cart-line-controls { grid-column: 2 / -1; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-2xs); }
  .cart-line-hint, .cart-line-error { grid-column: 2 / -1; margin: 0; font-size: var(--font-size-sm); }
  .cart-line-hint { color: var(--muted-foreground); }
  .cart-line-error { color: var(--error-text); font-weight: 600; }
  .stepper { display: inline-flex; align-items: center; border: 1px solid var(--input); border-radius: var(--control-radius); corner-shape: squircle; }
  .stepper button {
    display: grid; place-items: center; inline-size: 2.75rem; block-size: 2.75rem; padding: 0; border: 0; border-radius: var(--control-radius); corner-shape: squircle;
    background: none; color: var(--foreground); cursor: pointer;
  }
  .stepper button:hover:not(:disabled, [aria-disabled='true']) { background: var(--accent); }
  .stepper button:is(:disabled, [aria-disabled='true']) { color: var(--muted-foreground); cursor: default; }
  /* Inside the button, so the ring does not cover the number. */
  .stepper button:focus-visible { outline-offset: -3px; }
  .stepper output { min-inline-size: 1.5rem; text-align: center; font-weight: 700; font-variant-numeric: tabular-nums; }
  .cart-undo { align-items: center; }
  .cart-undo > span { grid-column: 1 / 3; }
  /* The new line rises in and is briefly tinted; reduced motion keeps a still tint. */
  .cart-line[data-fresh]::before { content: ''; position: absolute; inset: 0 calc(-1 * var(--space-sm)); z-index: -1; background: var(--accent); }
  @media (prefers-reduced-motion: no-preference) {
    .cart-line[data-fresh]::before { animation: fresh-tint 1800ms var(--motion-ease) 300ms both; }
    .cart-line[data-fresh] > * { animation: fresh-in 420ms var(--motion-ease) both; }
  }
  @keyframes fresh-tint { to { background: transparent; } }
  @keyframes fresh-in { from { opacity: 0; translate: 0 0.625rem; } }
</style>
