<script lang="ts">
  import { onMount, tick, untrack } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import type { HTMLInputAttributes } from 'svelte/elements'
  import type { Locale } from '@poetry/i18n'
  import { Button } from '$lib/components/ui/button'
  import { Field } from '$lib/components/ui/field'
  import {
    addressFields, checkoutFields, checkoutProblems, checkoutValues, fieldMessages, optionalFields,
    type CheckoutError, type CheckoutField, type CheckoutValues,
  } from '$lib/checkout'
  import * as m from '../paraglide/messages.js'

  let { action, locale, values: initialValues, errors: serverErrors }: {
    action: string
    locale: Locale
    values: Partial<CheckoutValues>
    errors: Partial<Record<CheckoutField, CheckoutError>>
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
  let submitting = $state(false)
  // Hydration keeps values typed before it; count them as edited.
  const loaded = untrack(() => ({ ...values }))
  onMount(() => {
    for (const field of checkoutFields) if (values[field] !== loaded[field]) edited.add(field)
  })

  const error = (field: CheckoutField) => (shown.has(field) ? problems[field] : undefined)

  function oninput(field: CheckoutField, value: string) {
    values[field] = value
    edited.add(field)
    if (shown.has(field) && !problems[field]) shown.delete(field)
  }
  function onblur(field: CheckoutField) {
    if (edited.has(field) && problems[field]) shown.add(field)
  }

  async function onsubmit(event: SubmitEvent) {
    const invalid = checkoutFields.filter((field) => problems[field])
    if (!invalid.length) {
      // One press, one payment start.
      if (submitting) event.preventDefault()
      submitting = true
      return
    }
    event.preventDefault()
    for (const field of invalid) shown.add(field)
    await tick()
    document.getElementById(invalid[0])?.focus()
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
</script>

<!-- Restored from the back/forward cache, the form can be sent again. -->
<svelte:window onpageshow={() => { submitting = false }} />

<!-- novalidate also without JavaScript: the server reports errors in the fields, not browser bubbles. -->
<form class="checkout-form" method="post" {action} novalidate {onsubmit} aria-busy={submitting}>
  <Field {...field('email')} {...inputProps('email')} {...inputs.email} hint={t(m.shop_email_hint)} bind:value={values.email} />
  <fieldset>
    <legend>{t(m.shop_address)}</legend>
    {#each addressFields as name (name)}
      <Field {...field(name)} {...inputProps(name)} {...inputs[name]} bind:value={values[name]} />
    {/each}
    <Field {...field('country')} hint={t(m.shop_shipping_only_de)}>
      {#snippet control(attributes)}
        <select {...attributes} name="country" autocomplete="country">
          <option value="DE">{t(m.shop_country_de)}</option>
        </select>
      {/snippet}
    </Field>
  </fieldset>
  <Button type="submit" size="lg" disabled={submitting}>{t(m.shop_to_payment)}</Button>
</form>

<style>
  .checkout-form { display: grid; gap: var(--space-xs); justify-items: start; }
  fieldset { display: grid; gap: var(--space-xs); justify-self: stretch; margin: 0; padding: 0; border: 0; }
  legend { margin-block: var(--space-sm); font-family: var(--font-serif); font-size: var(--font-size-lg); }
  .checkout-form :global(.field) { justify-self: stretch; max-inline-size: 32rem; }
</style>
