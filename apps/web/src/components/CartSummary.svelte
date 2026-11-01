<script lang="ts">
  import { localizedPath, type Locale } from '@poetry/i18n'
  import { Button } from '$lib/components/ui/button'
  import { Link } from '$lib/components/ui/link'
  import type { CartView } from '$lib/shop'
  import ShopFacts from './ShopFacts.svelte'
  import ShopTotals from './ShopTotals.svelte'
  import * as m from '../paraglide/messages.js'

  let { view, locale, oncontinue, oncheckout }: {
    view: CartView
    locale: Locale
    /** In the drawer "Weiter einkaufen" closes it; on the cart page it links to the shop. */
    oncontinue?: () => void
    /** The drawer sends waiting quantity changes before leaving. */
    oncheckout?: (event: MouseEvent) => void
  } = $props()
  const options = $derived({ locale })
  const blocked = $derived(
    view.checkout === 'payments-unavailable' ? m.shop_payments_unavailable({}, options) : view.checkout === 'blocked' ? m.shop_cart_blocked({}, options) : null,
  )
</script>

<div class="cart-summary">
  <ShopTotals {locale} subtotal={view.subtotal} shipping={view.shipping} note={view.priceNote} />
  <ShopFacts {locale} />
  <Button href={localizedPath(locale, 'shop/checkout')} size="lg" class="cart-checkout" disabled={Boolean(blocked)} aria-describedby={blocked ? 'checkout-blocked' : undefined} onclick={oncheckout}>{m.shop_checkout({}, options)}</Button>
  {#if blocked}<p class="checkout-blocked" id="checkout-blocked">{blocked}</p>{/if}
  {#if oncontinue}
    <Button variant="ghost" onclick={oncontinue}>{m.shop_continue({}, options)}</Button>
  {:else}
    <Link variant="standalone" href={localizedPath(locale, 'shop')}>{m.shop_continue({}, options)}</Link>
  {/if}
</div>

<style>
  .cart-summary { display: grid; gap: var(--space-xs); }
  /* A transparent border keeps the button's outline in forced colours. */
  .cart-summary :global(.cart-checkout) { inline-size: 100%; border: 1px solid transparent; }
  .checkout-blocked { margin: 0; font-size: var(--font-size-sm); color: var(--muted-foreground); }
</style>
