<script lang="ts">
  import { onMount, tick, untrack } from 'svelte'
  import { SvelteMap, SvelteSet } from 'svelte/reactivity'
  import { ShoppingBag, X } from 'lucide-svelte'
  import type { Locale } from '@poetry/i18n'
  import { Button } from '$lib/components/ui/button'
  import { notify } from '$lib/notifications'
  import { formatNumber, formatPrice, isolate, type CartView, type CartViewLine } from '$lib/shop'
  import CartLines, { type CartEntry, type CartHandlers } from './CartLines.svelte'
  import CartSummary from './CartSummary.svelte'
  import * as m from '../paraglide/messages.js'

  let { locale, count: cookieCount, cartPath }: { locale: Locale; count: number; cartPath: string } = $props()
  type Undo = Extract<CartEntry, { kind: 'undo' }>
  type Reply = { status: string; message?: string; view: CartView; removed?: { product: string; quantity: number } }

  const options = $derived({ locale })
  let view = $state<CartView | null>(null)
  let open = $state(false)
  // Hides the floating button before the open transition, so it is not in the old frame either.
  let opening = $state(false)
  let sheet = $state(false)
  let loading = $state(false)
  let failed = $state(false)
  let hydrated = $state(false)
  let status = $state('')
  let fresh = $state<string | null>(null)
  // Products in the order they were first shown, so an undone line returns to its place.
  let order = $state<string[]>([])
  const undo = new SvelteMap<string, Undo>()
  const pending = new SvelteMap<string, number>()
  const busy = new SvelteSet<string>()
  const restoring = new SvelteSet<string>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  let dialog: HTMLDialogElement
  let heading: HTMLHeadingElement
  let opener: HTMLElement | null = null
  const count = $derived(view?.count ?? untrack(() => cookieCount))
  const keyOf = (line: CartViewLine) => line.product ?? `line:${line.id}`

  const entries = $derived<CartEntry[]>(
    order.flatMap((key): CartEntry[] => {
      const line = view?.lines.find((entry) => keyOf(entry) === key)
      if (line) {
        const quantity = pending.get(line.id)
        return [{ kind: 'line', line: quantity ? { ...line, quantity } : line, fresh: line.id === fresh, busy: busy.has(line.id) }]
      }
      const removed = undo.get(key)
      return removed ? [removed] : []
    }),
  )

  // One request at a time, so replies apply in the order the changes were made.
  let queue: Promise<unknown> = Promise.resolve()
  function request(body?: object): Promise<Reply> {
    const run = queue.then(async () => {
      const response = await fetch(`/api/cart?locale=${locale}`, body
        ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
        : { cache: 'no-store' })
      if (!response.ok) throw new Error(`Cart request failed with ${response.status}`)
      return response.json() as Promise<Reply>
    })
    queue = run.catch(() => {})
    return run
  }

  // Sends waiting stepper changes now, e.g. before checkout or when the drawer closes.
  function flush() {
    for (const [id, timer] of timers) {
      clearTimeout(timer)
      timers.delete(id)
      const quantity = pending.get(id)
      if (quantity) commit(id, quantity)
    }
    return queue
  }

  // A live region repeats an identical message only if it changes in between.
  async function announce(text: string) {
    status = ''
    await tick()
    status = text
  }

  function apply(next: CartView) {
    view = next
    order = [...order, ...next.lines.map(keyOf).filter((key) => !order.includes(key))]
    // Cards on the shop list switch between "In den Warenkorb" and "Im Warenkorb".
    for (const card of document.querySelectorAll<HTMLElement>('[data-cart-product]'))
      card.toggleAttribute('data-in-cart', next.lines.some((line) => line.product === card.dataset.cartProduct))
  }

  async function load() {
    loading = true
    failed = false
    try { apply((await request()).view) } catch { failed = true }
    loading = false
  }

  const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
  // Cards glide to their new columns while the drawer pushes the page.
  async function transition(update: () => void) {
    if (!document.startViewTransition || reduceMotion()) return update()
    const root = document.documentElement
    root.dataset.cartTransition = ''
    const running = document.startViewTransition(async () => { update(); await tick() })
    running.finished.finally(() => delete root.dataset.cartTransition)
    await running.updateCallbackDone
  }

  let header: ResizeObserver | undefined
  async function show(from: HTMLElement | null) {
    opener = from
    if (open || opening) return heading.focus({ preventScroll: true })
    opening = true
    sheet = !matchMedia('(min-width: 40rem)').matches
    if (!view) load()
    // The push drawer starts where the sticky header ends, which shrinks while scrolling.
    const top = document.querySelector('.site-header')
    const measure = () => document.documentElement.style.setProperty('--cart-top', `${top?.getBoundingClientRect().bottom ?? 0}px`)
    measure()
    header?.disconnect()
    header = new ResizeObserver(measure)
    // The header compacts by padding, so watch its border box.
    if (top) header.observe(top, { box: 'border-box' })
    await tick()
    if (sheet) {
      open = true
      dialog.showModal()
    } else {
      await transition(() => {
        open = true
        dialog.show()
        document.documentElement.classList.add('cart-pushed')
      })
    }
    opening = false
    heading.focus({ preventScroll: true })
  }

  function hide() {
    if (!open) return
    if (sheet) dialog.close()
    else transition(() => {
      dialog.close()
      document.documentElement.classList.remove('cart-pushed')
    })
  }

  async function onclose() {
    flush()
    open = false
    document.documentElement.classList.remove('cart-pushed')
    header?.disconnect()
    dialog.style.translate = ''
    undo.clear()
    fresh = null
    status = ''
    order = view?.lines.map(keyOf) ?? []
    await tick()
    // The add button may have turned into "Im Warenkorb" meanwhile.
    const card = opener?.closest<HTMLElement>('[data-cart-product]')
    const target = opener?.checkVisibility() ? opener : card?.querySelector<HTMLElement>('[data-open-cart]') ?? document.querySelector<HTMLElement>('.cart-fab')
    target?.focus()
  }

  function failure(reply?: Reply) {
    notify({ tone: 'error', text: reply?.message ?? m.shop_status_failed({}, options) })
  }

  let adding = false
  async function add(form: HTMLFormElement, submitter: HTMLElement | null) {
    if (adding) return
    adding = true
    const data = new FormData(form)
    const product = String(data.get('product'))
    try {
      const reply = await request({ action: 'add', product, quantity: Number(data.get('quantity') ?? 1) })
      if (reply.status !== 'added') return failure(reply)
      apply(reply.view)
      fresh = reply.view.lines.find((line) => line.product === product)?.id ?? null
      await show(submitter ?? form)
      announce(m.shop_status_added({}, options))
    } catch {
      failure()
    } finally {
      adding = false
    }
  }

  const handlers: CartHandlers = {
    quantity(line, quantity) {
      pending.set(line.id, quantity)
      clearTimeout(timers.get(line.id))
      // One request for several quick presses.
      timers.set(line.id, setTimeout(() => commit(line.id, quantity), 400))
    },
    async remove(line) {
      if (busy.has(line.id)) return
      busy.add(line.id)
      // A waiting stepper change would update a line that is gone.
      clearTimeout(timers.get(line.id))
      timers.delete(line.id)
      pending.delete(line.id)
      try {
        const reply = await request({ action: 'remove', item: line.id })
        if (reply.status !== 'removed') return failure(reply)
        if (reply.removed) undo.set(keyOf(line), { kind: 'undo', ...reply.removed, title: line.title ?? '', titleLanguage: line.titleLanguage })
        apply(reply.view)
        await tick()
        // "Rückgängig" is described by the row text, so focus alone announces the removal.
        ;(document.getElementById(`undo-${line.product}`) ?? heading).focus()
      } catch {
        failure()
      } finally {
        busy.delete(line.id)
      }
    },
    async undo(entry) {
      if (restoring.has(entry.product)) return
      restoring.add(entry.product)
      try {
        const reply = await request({ action: 'add', product: entry.product, quantity: entry.quantity })
        if (reply.status !== 'added') return failure(reply)
        undo.delete(entry.product)
        apply(reply.view)
        announce(m.shop_restored({ title: isolate(entry.title) }, options))
        await tick()
        const line = reply.view.lines.find((candidate) => candidate.product === entry.product)
        document.getElementById(`title-${line?.id}`)?.focus()
      } catch {
        failure()
      } finally {
        restoring.delete(entry.product)
      }
    },
    announce,
  }

  // Checkout reads the cart from the server, so waiting changes go first.
  async function checkout(event: MouseEvent) {
    if (!timers.size && !busy.size) return
    event.preventDefault()
    const href = (event.currentTarget as HTMLAnchorElement).href
    await flush()
    location.assign(href)
  }

  async function commit(id: string, quantity: number) {
    busy.add(id)
    try {
      const reply = await request({ action: 'update', item: id, quantity })
      if (reply.status !== 'updated') return failure(reply)
      apply(reply.view)
      announce(m.shop_quantity_changed({ quantity: formatNumber(quantity, locale), subtotal: formatPrice(reply.view.subtotal, locale) }, options))
    } catch {
      failure()
    } finally {
      if (pending.get(id) === quantity && !timers.has(id)) pending.delete(id)
      busy.delete(id)
    }
  }

  onMount(() => {
    hydrated = true
    const onsubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement
      if (!form.matches('[data-add-to-cart]')) return
      event.preventDefault()
      add(form, event.submitter)
    }
    const onclick = (event: MouseEvent) => {
      const trigger = (event.target as Element).closest<HTMLElement>('[data-open-cart]')
      if (!trigger) return
      event.preventDefault()
      show(trigger)
    }
    // The push drawer is not modal, so Escape closes it wherever focus is.
    const onkeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open && !sheet && !event.defaultPrevented) hide()
    }
    const wide = matchMedia('(min-width: 40rem)')
    const onresize = () => { if (open) dialog.close() }
    document.addEventListener('submit', onsubmit)
    document.addEventListener('click', onclick)
    document.addEventListener('keydown', onkeydown)
    wide.addEventListener('change', onresize)
    return () => {
      document.removeEventListener('submit', onsubmit)
      document.removeEventListener('click', onclick)
      document.removeEventListener('keydown', onkeydown)
      wide.removeEventListener('change', onresize)
    }
  })

  // Swipe the sheet down by its head to close it; the list keeps its own scrolling.
  let drag: { y: number; time: number } | null = null
  function onpointerdown(event: PointerEvent) {
    if (!sheet || (event.target as Element).closest('button')) return
    drag = { y: event.clientY, time: performance.now() }
    dialog.classList.add('dragging')
    ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
  }
  function onpointermove(event: PointerEvent) {
    if (drag) dialog.style.translate = `0 ${Math.max(0, event.clientY - drag.y)}px`
  }
  function onpointerup(event: PointerEvent) {
    if (!drag) return
    const distance = Math.max(0, event.clientY - drag.y)
    const speed = distance / Math.max(1, performance.now() - drag.time)
    drag = null
    dialog.classList.remove('dragging')
    if (distance > dialog.offsetHeight * 0.25 || (distance > 40 && speed > 0.6)) dialog.close()
    else dialog.style.translate = ''
  }
</script>

{#if count > 0}
  {#if hydrated}
    <button type="button" class="cart-fab" data-open-cart aria-haspopup="dialog" aria-expanded={open} hidden={open || opening} aria-label={m.shop_cart_count({ count: formatNumber(count, locale) }, options)}>
      <ShoppingBag size={22} aria-hidden="true" /><span>{m.shop_cart({}, options)}</span>
      {#key count}<span class="cart-badge" aria-hidden="true">{formatNumber(count, locale)}</span>{/key}
    </button>
  {:else}
    <a class="cart-fab" href={cartPath} aria-label={m.shop_cart_count({ count: formatNumber(count, locale) }, options)}>
      <ShoppingBag size={22} aria-hidden="true" /><span>{m.shop_cart({}, options)}</span>
      <span class="cart-badge" aria-hidden="true">{formatNumber(count, locale)}</span>
    </a>
  {/if}
{/if}

<dialog class="cart-drawer" class:sheet bind:this={dialog} {onclose} aria-labelledby="cart-heading" aria-describedby="cart-status">
  <!-- svelte-ignore a11y_no_static_element_interactions (the close button and Escape do the same) -->
  <div class="cart-head" {onpointerdown} {onpointermove} {onpointerup} onpointercancel={onpointerup}>
    {#if sheet}<span class="cart-grabber" aria-hidden="true"></span>{/if}
    <h2 id="cart-heading" tabindex="-1" bind:this={heading}>
      {m.shop_cart({}, options)}{#if view?.count}{' '}<span class="cart-count">({formatNumber(view.count, locale)})</span>{/if}
    </h2>
    <Button variant="ghost" size="icon" aria-label={m.shop_close_cart({}, options)} onclick={hide}><X aria-hidden="true" /></Button>
  </div>
  <p class="sr-only" id="cart-status" role="status">{loading ? m.shop_cart_loading({}, options) : status}</p>
  <div class="cart-body">
    {#if loading && !view}
      <ul class="cart-skeleton" aria-busy="true">
        {#each { length: Math.min(Math.max(count, 1), 3) } as _, index (index)}<li></li>{/each}
      </ul>
    {:else if failed && !view}
      <div class="cart-message">
        <p>{m.shop_cart_load_error({}, options)}</p>
        <Button variant="outline" onclick={load}>{m.shop_retry({}, options)}</Button>
        <a href={cartPath}>{m.shop_cart({}, options)}</a>
      </div>
    {:else if view}
      {#if entries.length}<CartLines {entries} {locale} action={cartPath} {handlers} />{/if}
      {#if !view.lines.length}
        <div class="cart-message">
          <p>{m.shop_cart_empty({}, options)}</p>
          <Button variant="outline" onclick={hide}>{m.shop_continue({}, options)}</Button>
        </div>
      {/if}
    {/if}
  </div>
  {#if view?.lines.length}
    <div class="cart-foot"><CartSummary {view} {locale} oncontinue={hide} oncheckout={checkout} /></div>
  {/if}
</dialog>

<style>
  .cart-fab {
    position: fixed; z-index: 15; right: max(var(--space-sm), var(--safe-right)); bottom: max(var(--space-sm), env(safe-area-inset-bottom, 0px));
    display: inline-flex; align-items: center; gap: var(--space-2xs); min-block-size: 3.5rem; padding-inline: var(--space-sm) var(--space-xs);
    border: 1px solid transparent; border-radius: var(--panel-radius); corner-shape: squircle; background: var(--foreground); color: var(--background);
    font: inherit; font-weight: 700; text-decoration: none; box-shadow: var(--shadow-floating); cursor: pointer;
  }
  .cart-fab[hidden] { display: none; }
  .cart-badge {
    min-inline-size: 1.625rem; padding-inline: var(--space-3xs); border-radius: var(--control-radius); corner-shape: squircle;
    background: var(--primary); color: var(--primary-foreground); font-size: var(--font-size-sm); line-height: 1.625rem; text-align: center;
    animation: badge-bump 380ms var(--motion-ease);
  }
  @keyframes badge-bump { 40% { scale: 1.25; } }
  /* Keep focused content and the page end clear of the floating button. */
  :global(html:has(.cart-fab:not([hidden]))) { scroll-padding-block-end: calc(3.5rem + 2 * var(--space-sm)); }
  :global(html:has(.cart-fab:not([hidden])) .site-footer) { padding-block-end: calc(3.5rem + 2 * var(--space-sm)); }
  /* Below the bottom bar breakpoint the button sits above the bar. */
  @media (max-width: 51.99rem) {
    .cart-fab { bottom: calc(4.75rem + var(--space-xs) + env(safe-area-inset-bottom, 0px)); }
    :global(html:has(.cart-fab:not([hidden]))) {
      scroll-padding-block-end: calc(4.75rem + 3.5rem + 2 * var(--space-xs) + env(safe-area-inset-bottom, 0px));
    }
  }

  /* Push drawer: physical right in every language, below the sticky header. */
  .cart-drawer {
    position: fixed; z-index: 10; top: var(--cart-top, 0px); right: 0; bottom: 0; left: auto; inline-size: var(--cart-width); max-inline-size: 100vw;
    block-size: auto; max-block-size: none; margin: 0; padding: 0; border: 0; border-left: 1px solid var(--border);
    background: var(--background); color: var(--foreground); overflow: hidden;
  }
  .cart-drawer[open] { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; }
  @media (max-width: 51.99rem) {
    .cart-drawer:not(.sheet) { bottom: calc(4.75rem + env(safe-area-inset-bottom, 0px)); }
  }
  :global(html[data-cart-transition]) .cart-drawer { view-transition-name: cart-drawer; }
  :global(::view-transition-new(cart-drawer)) { animation: var(--motion-page) var(--motion-ease) both cart-in; }
  :global(::view-transition-old(cart-drawer)) { animation: var(--motion-page) var(--motion-ease) both cart-out; }
  @keyframes -global-cart-in { from { translate: 100% 0; } }
  @keyframes -global-cart-out { to { translate: 100% 0; } }

  /* Bottom sheet below 40rem: modal, 90 % high, swipe down to close. */
  .cart-drawer.sheet {
    top: auto; left: 0; inline-size: 100%; block-size: 90dvh; border: 0; border-radius: var(--panel-radius) var(--panel-radius) 0 0;
    corner-shape: squircle; box-shadow: var(--shadow-floating);
    transition: translate var(--motion-page) var(--motion-ease), overlay var(--motion-page) allow-discrete, display var(--motion-page) allow-discrete;
  }
  .cart-drawer.sheet:not([open]) { translate: 0 100%; }
  @starting-style { .cart-drawer.sheet[open] { translate: 0 100%; } }
  .cart-drawer.sheet:global(.dragging) { transition: none; }
  .cart-drawer::backdrop { background: oklch(from var(--black) l c h / 40%); }
  :global(html:has(.cart-drawer.sheet[open])) { overflow: hidden; }

  .cart-head { position: relative; display: flex; align-items: center; gap: var(--space-2xs); padding: var(--space-xs) var(--space-2xs) var(--space-xs) var(--space-sm); border-block-end: 1px solid var(--border); }
  .sheet .cart-head { padding-block-start: var(--space-md); touch-action: none; cursor: grab; }
  .cart-grabber { position: absolute; top: var(--space-2xs); left: calc(50% - 1.25rem); inline-size: 2.5rem; block-size: 0.3rem; border-radius: 1rem; background: var(--input); }
  .cart-head h2 { flex: 1; margin: 0; font-family: var(--font-serif); font-size: var(--font-size-lg); font-weight: 400; }
  /* Focus lands here only to start reading; the heading is not a control. */
  .cart-head h2:focus { outline: none; }
  .cart-count { font-family: var(--font-sans); font-size: var(--font-size-base); color: var(--muted-foreground); }
  .cart-body { overflow-y: auto; overscroll-behavior: contain; padding-inline: var(--space-sm); }
  .cart-foot { padding: var(--space-sm) var(--space-sm) max(var(--space-sm), env(safe-area-inset-bottom, 0px)); border-block-start: 1px solid var(--border); }
  /* Low viewports: the footer scrolls with the lines, so at least one whole line stays visible. */
  @media (max-height: 32rem) {
    .cart-drawer[open] { grid-template-rows: none; overflow-y: auto; }
    .cart-body { overflow: visible; }
  }
  @media (max-height: 45rem) {
    .cart-drawer.sheet[open] { grid-template-rows: none; overflow-y: auto; overscroll-behavior: contain; }
    .sheet .cart-body { overflow: visible; }
  }
  .cart-message { display: grid; gap: var(--space-sm); justify-items: start; padding-block: var(--space-md); }
  .cart-message p { margin: 0; }
  .cart-skeleton { display: grid; gap: var(--space-sm); margin: 0; padding: var(--space-sm) 0; list-style: none; }
  .cart-skeleton li { block-size: 5rem; border-radius: var(--control-radius); corner-shape: squircle; background: var(--muted); }
</style>
