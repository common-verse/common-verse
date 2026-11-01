<script lang="ts">
  import type { Locale } from '@poetry/i18n'
  import { formatPrice } from '$lib/shop'
  import * as m from '../paraglide/messages.js'

  let { locale, subtotal, shipping, note }: { locale: Locale; subtotal: number; shipping: number | null; note?: string | null } = $props()
  const rows = $derived<[string, number][]>(
    shipping === null
      ? [[m.shop_subtotal({}, { locale }), subtotal]]
      : [
          [m.shop_subtotal({}, { locale }), subtotal],
          [m.shop_shipping({}, { locale }), shipping],
          [m.shop_total({}, { locale }), subtotal + shipping],
        ],
  )
</script>

<dl class="shop-totals">
  {#each rows as [label, cents] (label)}
    <div><dt>{label}</dt><dd><bdi class="price">{formatPrice(cents, locale)}</bdi></dd></div>
  {/each}
</dl>
{#if note}<p class="shop-note">{note}</p>{/if}

<style>
  .shop-totals { display: grid; gap: var(--space-2xs); margin: 0; }
  .shop-totals div { display: flex; justify-content: space-between; gap: var(--space-sm); }
  .shop-totals div:last-child { padding-block-start: var(--space-2xs); border-block-start: 1px solid var(--border); font-weight: 700; }
  dd { margin: 0; }
  .shop-note { margin: var(--space-xs) 0 0; font-size: var(--font-size-sm); color: var(--muted-foreground); }
</style>
