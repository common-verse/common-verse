<script lang="ts">
  import type { Locale } from '@poetry/i18n'
  import { Copy } from 'lucide-svelte'
  import { Button } from '$lib/components/ui/button'
  import * as m from '../paraglide/messages.js'

  /** `code` is shown as given, for example `K7QD-93FA`. */
  let { locale, code, statusHref }: { locale: Locale; code: string; statusHref: string } = $props()
  const options = $derived({ locale })
  let copied = $state(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      return
    }
    copied = true
    clearTimeout(timer)
    timer = setTimeout(() => (copied = false), 2000)
  }
</script>

<div class="order-code">
  <span class="order-code-label" id="order-code-label">{m.shop_order_code({}, options)}</span>
  <div class="order-code-row">
    <bdi class="order-code-value" dir="ltr">{code}</bdi>
    <Button type="button" variant="ghost" size="sm" class="order-code-copy" aria-describedby="order-code-label" onclick={copy}>
      <Copy aria-hidden="true" />{copied ? m.shop_copied({}, options) : m.shop_copy({}, options)}
    </Button>
  </div>
  <a class="order-code-link" href={statusHref}>{m.shop_status_link({}, options)}</a>
  <span class="sr-only" role="status">{copied ? m.shop_code_copied({}, options) : ''}</span>
</div>

<style>
  .order-code {
    display: grid; gap: var(--space-3xs); padding: var(--space-sm) var(--space-md);
    border: 1px solid var(--border); border-radius: var(--panel-radius); corner-shape: squircle; background: var(--card);
  }
  .order-code-label { font-size: var(--font-size-sm); font-weight: 600; color: var(--muted-foreground); }
  .order-code-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-2xs) var(--space-sm); }
  .order-code-value {
    font-size: clamp(1.375rem, 6vw, 1.875rem); font-weight: 700; line-height: 1.15; letter-spacing: 0.08em;
    font-variant-numeric: tabular-nums lining-nums; white-space: nowrap;
  }
  /* Copying needs JavaScript; without it the code can still be selected. */
  @media (scripting: none) {
    .order-code-row :global(.order-code-copy) { visibility: hidden; }
  }
  .order-code-link { justify-self: start; display: inline-flex; align-items: center; min-block-size: 2rem; font-size: var(--font-size-sm); font-weight: 600; text-decoration: underline; }
</style>
