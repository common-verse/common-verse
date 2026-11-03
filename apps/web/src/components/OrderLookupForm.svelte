<script lang="ts">
  import type { Locale } from '@poetry/i18n'
  import { Button } from '$lib/components/ui/button'
  import { Field } from '$lib/components/ui/field'
  import type { LookupField } from '$lib/order'
  import { normalizeCode } from '$lib/order-code'
  import { emailPattern } from '$lib/shop'
  import * as m from '../paraglide/messages.js'
  import CodeInput from './CodeInput.svelte'

  // The status form posts to its page and works without JavaScript. With it, a complete code and a
  // valid email send it on their own: the lookup always needs both and keeps its rate limit.
  let { locale, action, values, errors, problem, linked }: {
    locale: Locale
    action: string
    values: Record<LookupField, string>
    errors: Partial<Record<LookupField, 'required' | 'invalid'>>
    problem: 'not_found' | 'too_many' | 'unavailable' | null
    /** The code came from the confirmation's link. */
    linked: boolean
  } = $props()

  const options = $derived({ locale })
  let code = $state(values.code)
  let email = $state(values.email)
  let form: HTMLFormElement
  let sent = false

  const firstError = $derived((['code', 'email'] as const).find((field) => errors[field]))
  const fieldMessages = $derived({
    code: { required: m.shop_error_required({}, options), invalid: m.order_status_error_code({}, options) },
    email: { required: m.shop_error_required({}, options), invalid: m.shop_error_email({}, options) },
  })
  const problems = $derived({
    not_found: m.order_status_not_found({}, options),
    too_many: m.order_status_too_many({}, options),
    unavailable: m.order_status_unavailable({}, options),
  })

  const pair = (codeValue: string, emailValue: string) => `${normalizeCode(codeValue)} ${emailValue.trim().toLowerCase()}`
  // After an answer the page shows the pair it asked for; sending it unchanged would only count again.
  const asked = problem ? pair(values.code, values.email) : null
  const emailValid = () => emailPattern.test(email.trim())
  const ready = () => normalizeCode(code) !== null && emailValid() && pair(code, email) !== asked

  function completed() {
    if (!emailValid()) (form.elements.namedItem('email') as HTMLInputElement).focus()
    else if (ready()) form.requestSubmit()
  }

  function left(event: FocusEvent) {
    // Going back to correct the code is not leaving the form.
    if ((event.relatedTarget as Element | null)?.id !== 'code' && ready()) form.requestSubmit()
  }

  // The blur that sends the form comes before the button press that caused it: send once.
  function submitted(event: SubmitEvent) {
    if (sent) event.preventDefault()
    sent = true
  }
</script>

<svelte:window onpageshow={() => (sent = false)} />

<form bind:this={form} method="post" {action} novalidate onsubmit={submitted}>
  <Field id="code" label={m.shop_order_code({}, options)} messages={fieldMessages.code} error={errors.code}
    hint={linked && !errors.code ? m.order_status_from_link({}, options) : m.order_status_code_hint({}, options)}>
    {#snippet control(attributes)}
      <CodeInput {...attributes} name="code" bind:value={code} placeholder="K7QD-93FA" required autofocus={firstError === 'code'} oncomplete={completed} />
    {/snippet}
  </Field>
  <Field id="email" name="email" type="email" label={m.shop_email({}, options)} bind:value={email}
    messages={fieldMessages.email} error={errors.email} autofocus={firstError === 'email' || (linked && !firstError)}
    dir="ltr" autocomplete="email" spellcheck="false" required onblur={left} />
  <Button type="submit" size="lg" class="w-full">{m.order_status_submit({}, options)}</Button>
  <!-- Every text has its place in one cell, so the longest sets the height and nothing moves. -->
  <div class="status-problem">
    {#each Object.entries(problems) as [key, text] (key)}
      {#if key === problem}
        <!-- svelte-ignore a11y_autofocus -->
        <p id="status-problem" tabindex="-1" autofocus data-active>{text}</p>
      {:else}
        <p aria-hidden="true">{text}</p>
      {/if}
    {/each}
  </div>
</form>

<style>
  form { display: grid; gap: var(--space-2xs); }
  .status-problem { display: grid; margin-block-start: var(--space-2xs); font-size: var(--font-size-sm); line-height: 1.5; }
  .status-problem p { grid-area: 1 / 1; margin: 0; color: var(--error-text); font-weight: 600; }
  .status-problem p:not([data-active]) { visibility: hidden; }
  /* Focused only so it is read; it is not a control. */
  .status-problem p:focus { outline: none; }
</style>
