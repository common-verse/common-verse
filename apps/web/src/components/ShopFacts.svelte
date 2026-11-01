<script lang="ts">
  import { CreditCard, Truck } from 'lucide-svelte'
  import type { Locale } from '@poetry/i18n'
  import * as m from '../paraglide/messages.js'

  // Delivery area and payment methods, shown before checkout starts (§ 312j Abs. 1 BGB).
  let { locale }: { locale: Locale } = $props()
</script>

<ul class="shop-facts">
  <li><Truck size={16} aria-hidden="true" />{m.shop_delivery_de({}, { locale })}</li>
  <li><CreditCard size={16} aria-hidden="true" />{m.shop_payment_methods({}, { locale })}</li>
</ul>

<style>
  .shop-facts { display: grid; gap: var(--space-3xs); margin: 0; padding: 0; list-style: none; font-size: var(--font-size-sm); color: var(--muted-foreground); }
  .shop-facts li { display: flex; align-items: baseline; gap: var(--space-2xs); }
  .shop-facts :global(svg) { flex: none; translate: 0 0.15em; color: var(--foreground); }
</style>
