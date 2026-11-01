<script lang="ts">
  import { onMount, tick, untrack } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import type { HTMLInputAttributes } from 'svelte/elements'
  import { Plus } from 'lucide-svelte'
  import { loadStripe, type Stripe, type StripeElementLocale, type StripeElements, type StripeError, type StripeExpressCheckoutElementConfirmEvent } from '@stripe/stripe-js'
  import type { Locale } from '@poetry/i18n'
  import { Button } from '$lib/components/ui/button'
  import { Field } from '$lib/components/ui/field'
  import { notify, type Notice } from '$lib/notifications'
  import { formatNumber, formatPrice, titleAttributes } from '$lib/shop'
  import { tokenAppearance } from '$lib/stripe-appearance'
  import type { AddressSuggestion } from '$lib/address'
  import {
    checkoutFields, checkoutProblems, checkoutValues, fieldMessages, optionalFields, walletValues,
    type CheckoutError, type CheckoutField, type CheckoutValues,
  } from '$lib/checkout'
  import AddressField from './AddressField.svelte'
  import * as m from '../paraglide/messages.js'

  interface OrderLine { id: string; title: string; titleLanguage: string | null; quantity: number; meta: string; total: number }

  let { action, locale, values: initialValues, errors: serverErrors, cart, payment, order, links }: {
    action: string
    locale: Locale
    values: Partial<CheckoutValues>
    errors: Partial<Record<CheckoutField, CheckoutError>>
    /** The checkout key this page shows; the server refuses to charge another cart or amount. */
    cart: string
    payment: { publishableKey: string; stripeLocale: StripeElementLocale; returnUrl: string }
    /** Shown directly above the order button (§ 312j Abs. 2 BGB); all in cents. */
    order: { lines: OrderLine[]; shipping: number; total: number; note: string | null }
    links: { terms: string; privacy: string }
  } = $props()

  const t = (message: (inputs: {}, options: { locale: Locale }) => string) => message({}, { locale })
  const labels: Record<CheckoutField, string> = {
    email: t(m.shop_email), firstName: t(m.shop_first_name), lastName: t(m.shop_last_name), company: t(m.shop_company), addressLine1: t(m.shop_street),
    addressLine2: t(m.shop_address2), postalCode: t(m.shop_postal_code), city: t(m.shop_city), country: t(m.shop_country),
  }
  const inputs: Partial<Record<CheckoutField, HTMLInputAttributes>> = {
    email: { type: 'email', autocomplete: 'email', spellcheck: false, dir: 'ltr' },
    firstName: { autocomplete: 'given-name' },
    lastName: { autocomplete: 'family-name' },
    company: { autocomplete: 'organization' },
    addressLine1: { autocomplete: 'address-line1' },
    addressLine2: { autocomplete: 'address-line2' },
    postalCode: { autocomplete: 'postal-code', inputmode: 'numeric', spellcheck: false },
    city: { autocomplete: 'address-level2' },
  }

  let values = $state(untrack(() => ({ ...checkoutValues(() => ''), country: 'DE', ...initialValues })))
  // Errors show when an edited field is left invalid, after submit, or when the server reported them.
  const shown = new SvelteSet<CheckoutField>(untrack(() => Object.keys(serverErrors) as CheckoutField[]))
  // Not rendered, so a plain Set.
  const edited = new Set<CheckoutField>()
  const problems = $derived(checkoutProblems(checkoutValues((field) => values[field as CheckoutField])).errors)
  const firstServerError = untrack(() => checkoutFields.find((field) => serverErrors[field]))
  // Company and address addition stay folded until needed.
  let more = $state(untrack(() => Boolean(initialValues.company || initialValues.addressLine2)))
  let submitting = $state(false)
  let stripeState = $state<'loading' | 'ready' | 'failed'>('loading')
  // Wallet buttons appear only if Stripe reports one before the buyer starts, so nothing moves under them.
  let express = $state<'pending' | 'shown' | 'none'>('pending')
  let form: HTMLFormElement
  let payButton = $state<HTMLButtonElement | null>(null)
  let paymentHost: HTMLDivElement
  let expressHost: HTMLDivElement
  let stripe: Stripe | null = null
  let elements: StripeElements | null = null

  // Hydration keeps values typed before it; count them as edited.
  const loaded = untrack(() => ({ ...values }))
  onMount(() => {
    for (const field of checkoutFields) if (values[field] !== loaded[field]) edited.add(field)
    let active = true
    const dark = matchMedia('(prefers-color-scheme: dark)')
    const restyle = () => requestAnimationFrame(() => elements?.update({ appearance: tokenAppearance(form) }))
    const themes = new MutationObserver(restyle)
    const interacted = () => { if (express === 'pending') express = 'none' }
    const interactions = ['pointerdown', 'keydown', 'scroll'] as const
    for (const type of interactions) addEventListener(type, interacted, { capture: true, passive: true, once: true })
    loadStripe(payment.publishableKey)
      .then((instance) => {
        if (!instance) throw new Error('Stripe.js is unavailable')
        if (!active) return
        stripe = instance
        // Deferred intent: the PaymentIntent is created on submit, with the same amount and currency.
        elements = instance.elements({ mode: 'payment', amount: order.total, currency: 'eur', locale: payment.stripeLocale, appearance: tokenAppearance(form) })
        const paymentElement = elements.create('payment', {
          layout: { type: 'accordion', defaultCollapsed: false, radios: 'always', spacedAccordionItems: false },
          // Wallets have their own buttons above the form; the email comes from our field, so no Link sign-up.
          wallets: { applePay: 'never', googlePay: 'never', link: 'never' },
          // Email and country come from the form (Germany only); the name stays with Stripe, e.g. a SEPA account holder.
          fields: { billingDetails: { email: 'never', address: { country: 'never' } } },
        })
        paymentElement.on('ready', () => { stripeState = 'ready' })
        paymentElement.on('loaderror', () => { stripeState = 'failed'; fail(t(m.shop_payment_load_error)) })
        paymentElement.mount(paymentHost)
        const expressElement = elements.create('expressCheckout', {
          buttonType: { applePay: 'plain' },
          // Only the wallets the association offers, whatever else the Dashboard enables.
          paymentMethods: { applePay: 'auto', googlePay: 'auto', link: 'never', amazonPay: 'never', paypal: 'never', klarna: 'never' },
          buttonHeight: 48,
          emailRequired: true,
          shippingAddressRequired: true,
          allowedShippingCountries: ['DE'],
          shippingRates: [{ id: 'germany', displayName: t(m.shop_shipping), amount: order.shipping }],
        })
        expressElement.on('ready', ({ availablePaymentMethods }) => {
          if (express === 'pending') express = availablePaymentMethods ? 'shown' : 'none'
        })
        expressElement.on('loaderror', () => { express = 'none' })
        // While the form starts a payment, a wallet sheet must not start a second one.
        expressElement.on('click', (event) => (submitting ? event.reject() : event.resolve()))
        expressElement.on('confirm', payWithWallet)
        expressElement.mount(expressHost)
        themes.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
        dark.addEventListener('change', restyle)
      })
      .catch(() => {
        stripeState = 'failed'
        express = 'none'
        fail(t(m.shop_payment_load_error))
      })
    return () => {
      active = false
      for (const type of interactions) removeEventListener(type, interacted, { capture: true })
      themes.disconnect()
      dark.removeEventListener('change', restyle)
    }
  })

  const fail = (text: string, link?: Notice['link']) => notify({ tone: 'error', text, link })
  const error = (field: CheckoutField) => (shown.has(field) ? problems[field] : undefined)

  function oninput(field: CheckoutField, value: string) {
    values[field] = value
    edited.add(field)
    if (shown.has(field) && !problems[field]) shown.delete(field)
  }
  function onblur(field: CheckoutField) {
    if (edited.has(field) && problems[field]) shown.add(field)
  }
  function onpick(suggestion: AddressSuggestion) {
    for (const [field, value] of [['addressLine1', suggestion.line1], ['postalCode', suggestion.postalCode], ['city', suggestion.city]] as const) {
      values[field] = value
      edited.add(field)
      shown.delete(field)
    }
  }

  /** Asks our server to start the payment; returns the client secret or reports why not. */
  async function start(contact: CheckoutValues): Promise<string | null> {
    try {
      const response = await fetch(`/api/checkout?locale=${locale}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...contact, cart }),
      })
      const reply = await response.json()
      if (response.ok && typeof reply.clientSecret === 'string') return reply.clientSecret
      const refusal = reply.error ?? {}
      // The page shows the current cart again, with what was typed and the notice.
      if (refusal.code === 'cart_changed') HTMLFormElement.prototype.submit.call(form)
      else if (refusal.code === 'completed' && typeof refusal.redirect === 'string') location.assign(refusal.redirect)
      else fail(refusal.text ?? t(m.shop_start_error), refusal.link)
    } catch {
      fail(t(m.shop_start_error))
    }
    return null
  }

  const confirm = (clientSecret: string, email: string) =>
    stripe!.confirmPayment({
      elements: elements!,
      clientSecret,
      confirmParams: { return_url: payment.returnUrl, payment_method_data: { billing_details: { email, address: { country: 'DE' } } } },
    })

  // Resolves only on failure; success leaves for the return URL.
  const paymentError = (result: StripeError) =>
    ['card_error', 'validation_error'].includes(result.type) && result.message ? result.message : t(m.shop_payment_error)

  async function onsubmit(event: SubmitEvent) {
    // With JavaScript the form never posts; without it the server checks the fields.
    event.preventDefault()
    const invalid = checkoutFields.filter((field) => problems[field])
    if (invalid.length) {
      for (const field of invalid) shown.add(field)
      await tick()
      document.getElementById(invalid[0])?.focus()
      return
    }
    if (!stripe || !elements) {
      fail(t(stripeState === 'failed' ? m.shop_payment_load_error : m.shop_payment_loading))
      return
    }
    // The disabled button makes one press one payment; a form with a disabled default button ignores Enter.
    submitting = true
    const contact = checkoutValues((field) => values[field as CheckoutField])
    // The Payment Element shows its own field errors.
    const { error: incomplete } = await elements.submit()
    const clientSecret = incomplete ? null : await start(contact)
    const result = clientSecret ? (await confirm(clientSecret, contact.email)).error : null
    submitting = false
    if (result) {
      fail(paymentError(result))
      await tick()
      payButton?.focus()
    }
  }

  async function payWithWallet(event: StripeExpressCheckoutElementConfirmEvent) {
    if (submitting) return event.paymentFailed()
    const wallet = walletValues(event)
    const contact = checkoutValues((field) => wallet[field as CheckoutField])
    const checked = checkoutProblems(contact)
    if (Object.keys(checked.errors).length || checked.tooLong) {
      event.paymentFailed({ reason: 'invalid_shipping_address', message: t(m.shop_wallet_address) })
      return
    }
    submitting = true
    const { error: incomplete } = await elements!.submit()
    const clientSecret = incomplete ? null : await start(contact)
    if (!clientSecret) {
      submitting = false
      event.paymentFailed()
      return
    }
    const { error: result } = await confirm(clientSecret, contact.email)
    submitting = false
    fail(paymentError(result))
  }

  const field = (name: CheckoutField) => ({
    id: name,
    label: labels[name],
    messages: fieldMessages(name, locale),
    error: error(name),
  })
  const inputProps = (name: CheckoutField) => ({
    name,
    required: name !== 'country' && !optionalFields.has(name),
    autofocus: name === firstServerError,
    onblur: () => onblur(name),
    oninput: (event: Event) => oninput(name, (event.currentTarget as HTMLInputElement).value),
  })
  // Link texts stand in for {terms}, {withdrawal} and {privacy} inside the translated sentence.
  const legalParts = $derived(
    m.shop_legal({ days: formatNumber(14, locale), terms: '{terms}', withdrawal: '{withdrawal}', privacy: '{privacy}' }, { locale }).split(/(\{\w+\})/),
  )
  const legalLinks: Record<string, { href: string; text: string }> = $derived({
    '{terms}': { href: links.terms, text: t(m.shop_legal_terms) },
    '{withdrawal}': { href: links.terms, text: t(m.shop_legal_withdrawal) },
    '{privacy}': { href: links.privacy, text: t(m.shop_legal_privacy) },
  })
</script>

<!-- Restored from the back/forward cache, the form can be sent again. -->
<svelte:window onpageshow={() => { submitting = false }} />

<div class="express" data-state={express} aria-hidden={express === 'shown' ? undefined : 'true'}>
  <div class="express-buttons" bind:this={expressHost}></div>
  <p class="express-or">{t(m.shop_or)}</p>
</div>

<!-- novalidate also without JavaScript: the server reports errors in the fields, not browser bubbles. -->
<form class="checkout-form" method="post" {action} novalidate {onsubmit} aria-busy={submitting} bind:this={form}>
  <input type="hidden" name="cart" value={cart} />
  <fieldset>
    <legend>{t(m.shop_contact)}</legend>
    <Field {...field('email')} {...inputProps('email')} {...inputs.email} hint={t(m.shop_email_hint)} bind:value={values.email} />
  </fieldset>
  <fieldset>
    <legend>{t(m.shop_address)}</legend>
    <div class="pair">
      <Field {...field('firstName')} {...inputProps('firstName')} {...inputs.firstName} bind:value={values.firstName} />
      <Field {...field('lastName')} {...inputProps('lastName')} {...inputs.lastName} bind:value={values.lastName} />
    </div>
    <AddressField {...field('addressLine1')} {...inputProps('addressLine1')} {...inputs.addressLine1} {locale} {onpick} bind:value={values.addressLine1} />
    <details class="more" bind:open={more} ontoggle={(event) => { if (event.currentTarget.open) document.getElementById('company')?.focus() }}>
      <summary><Plus size={16} aria-hidden="true" />{t(m.shop_address_more)}</summary>
      <Field {...field('company')} {...inputProps('company')} {...inputs.company} bind:value={values.company} />
      <Field {...field('addressLine2')} {...inputProps('addressLine2')} {...inputs.addressLine2} bind:value={values.addressLine2} />
    </details>
    <div class="pair place">
      <Field {...field('postalCode')} {...inputProps('postalCode')} {...inputs.postalCode} bind:value={values.postalCode} />
      <Field {...field('city')} {...inputProps('city')} {...inputs.city} bind:value={values.city} />
    </div>
    <!-- Germany is the only destination: a fact, not a choice. -->
    <dl class="country">
      <dt>{t(m.shop_country)}</dt>
      <dd><span>{t(m.shop_country_de)}</span><span class="country-note">{t(m.shop_only_country)}</span></dd>
    </dl>
    <input type="hidden" name="country" value="DE" />
  </fieldset>
  <fieldset>
    <legend>{t(m.shop_payment)}</legend>
    <div class="payment-slot" data-state={stripeState}>
      <div bind:this={paymentHost}></div>
      {#if stripeState === 'loading'}<p class="payment-note" role="status">{t(m.shop_payment_loading)}</p>{/if}
    </div>
    <p class="payment-note needs-js">{t(m.shop_payment_needs_js)}</p>
  </fieldset>
  <p class="legal">
    {#each legalParts as part, index (index)}
      {#if legalLinks[part]}<a href={legalLinks[part].href}>{legalLinks[part].text}</a>{:else}{part}{/if}
    {/each}
  </p>
  <div class="order-facts">
    <ul aria-label={t(m.shop_order_summary)}>
      {#each order.lines as line (line.id)}
        <li class="order-book">
          <span><span class="order-title" {...titleAttributes(line)}>{line.title}</span> <bdi class="order-quantity">× {formatNumber(line.quantity, locale)}</bdi>
            {#if line.meta}<span class="order-meta">{line.meta}</span>{/if}</span>
          <bdi class="price">{formatPrice(line.total, locale)}</bdi>
        </li>
      {/each}
      <li class="order-shipping"><span>{t(m.shop_shipping)}</span><bdi class="price">{formatPrice(order.shipping, locale)}</bdi></li>
      <li class="order-total"><span>{t(m.shop_total)}</span><bdi class="price">{formatPrice(order.total, locale)}</bdi></li>
    </ul>
    {#if order.note}<p class="order-note">{order.note}</p>{/if}
    <Button type="submit" size="lg" class="order-button" disabled={submitting} bind:ref={payButton}>{submitting ? t(m.shop_paying) : t(m.shop_pay)}</Button>
  </div>
</form>

<style>
  .express { display: grid; gap: var(--space-sm); margin-block-end: var(--space-md); }
  /* Rendered out of the flow until Stripe reports a wallet, so the form never moves for it. */
  .express:not([data-state='shown']) { position: absolute; inset-inline: 0; visibility: hidden; pointer-events: none; }
  .express[data-state='none'] { display: none; }
  .express-or { display: flex; align-items: center; gap: var(--space-xs); margin: 0; font-size: var(--font-size-sm); color: var(--muted-foreground); }
  .express-or::before, .express-or::after { content: ''; flex: 1; block-size: 1px; background: var(--border); }
  .checkout-form { display: grid; gap: var(--space-md); }
  fieldset { display: grid; gap: var(--space-2xs); min-inline-size: 0; margin: 0; padding: 0; border: 0; }
  legend { padding: 0; margin-block-end: var(--space-2xs); font-weight: 700; font-size: var(--font-size-base); }
  /* Compact labels like the prototype; inputs keep 16px so phones do not zoom into them. */
  .checkout-form :global(.field label), .country dt { font-size: var(--font-size-sm); }
  .checkout-form :global(.field :is(input, select)) { min-block-size: 2.75rem; font-size: 1rem; }
  .country { display: grid; gap: var(--space-3xs); margin: 0; }
  .country dt { font-weight: 600; }
  .country dd {
    display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-3xs) var(--space-sm);
    min-block-size: 2.75rem; margin: 0; padding: var(--space-2xs) var(--space-xs); border-radius: var(--control-radius); corner-shape: squircle; background: var(--muted);
  }
  .country-note { font-size: var(--font-size-sm); color: var(--muted-foreground); }
  /* start: a longer reserved error line in one field must not stretch its neighbour. */
  .pair { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr)); align-items: start; gap: var(--space-2xs) var(--space-xs); }
  .pair.place { grid-template-columns: repeat(auto-fit, minmax(min(100%, 7rem), 2fr)); }
  .more { display: grid; gap: var(--space-2xs); }
  .more summary {
    display: inline-flex; align-items: center; gap: var(--space-2xs); justify-self: start; min-block-size: 2.75rem;
    font-weight: 600; text-decoration: underline; text-underline-offset: 0.2em; cursor: pointer; list-style: none;
  }
  .more summary::-webkit-details-marker { display: none; }
  .more[open] summary { display: none; }
  /* The loading note sits where the Payment Element appears, in room reserved for it. */
  .payment-slot { display: grid; }
  .payment-slot > * { grid-area: 1 / 1; }
  .payment-slot[data-state='loading'] { min-block-size: 12rem; }
  .payment-note { margin: 0; color: var(--muted-foreground); }
  .needs-js { display: none; }
  @media (scripting: none) {
    .express, .payment-slot { display: none; }
    .needs-js { display: block; }
  }
  .legal { margin: 0; font-size: var(--font-size-sm); color: var(--muted-foreground); }
  .legal a { color: var(--foreground); text-decoration: underline; }
  .order-facts { display: grid; gap: var(--space-xs); padding-block-start: var(--space-sm); border-block-start: 1px solid var(--border); }
  .order-facts ul { display: grid; gap: var(--space-2xs); margin: 0; padding: 0; list-style: none; }
  .order-facts li { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-sm); overflow-wrap: anywhere; }
  .order-title { font-family: var(--font-serif); }
  .order-quantity, .order-meta { color: var(--muted-foreground); }
  .order-meta { display: block; font-size: var(--font-size-sm); }
  .order-total { padding-block-start: var(--space-2xs); border-block-start: 1px solid var(--border); font-weight: 700; }
  .order-total .price { font-family: var(--font-serif); font-weight: 400; font-size: var(--font-size-lg); }
  .order-note { margin: 0; font-size: var(--font-size-sm); color: var(--muted-foreground); }
  /* „Zahlungspflichtig bestellen“ must be easy to read (§ 312j Abs. 3 BGB): large, bold, tall. */
  .order-facts :global(.order-button) {
    inline-size: 100%; min-block-size: 3.25rem; border: 1px solid transparent;
    font-size: max(1.0625rem, var(--font-size-base)); font-weight: 700;
  }
  /* Beside the summary on wide screens, the books and the price note are already in view. */
  @media (min-width: 60rem) {
    .order-book, .order-shipping, .order-note { display: none !important; }
    .order-total { padding-block-start: 0; border: 0; }
  }
</style>
