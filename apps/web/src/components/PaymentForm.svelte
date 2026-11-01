<script lang="ts">
  import { onMount } from 'svelte'
  import { loadStripe, type Stripe, type StripeElementLocale, type StripeElements } from '@stripe/stripe-js'
  import { Button } from '$lib/components/ui/button'
  import { notify } from '$lib/notifications'

  let { clientSecret, publishableKey, locale, returnUrl, labels }: {
    clientSecret: string
    publishableKey: string
    locale: StripeElementLocale
    returnUrl: string
    labels: { pay: string; paying: string; loading: string; loadError: string; paymentError: string }
  } = $props()

  let state = $state<'loading' | 'ready' | 'submitting' | 'failed'>('loading')
  let container: HTMLDivElement
  let stripe: Stripe | null = null
  let elements: StripeElements | null = null

  const fail = (text: string) => notify({ tone: 'error', text })

  onMount(() => {
    loadStripe(publishableKey)
      .then((instance) => {
        if (!instance) throw new Error('Stripe.js is unavailable')
        stripe = instance
        elements = instance.elements({ clientSecret, locale })
        const payment = elements.create('payment')
        payment.on('ready', () => { state = 'ready' })
        payment.on('loaderror', () => { state = 'failed'; fail(labels.loadError) })
        payment.mount(container)
      })
      .catch(() => { state = 'failed'; fail(labels.loadError) })
  })

  async function submit(event: SubmitEvent) {
    event.preventDefault()
    if (!stripe || !elements || state !== 'ready') return
    state = 'submitting'
    // Resolves only on failure; success navigates to the return URL.
    const { error: result } = await stripe.confirmPayment({ elements, confirmParams: { return_url: returnUrl } })
    state = 'ready'
    fail(['card_error', 'validation_error'].includes(result.type) && result.message ? result.message : labels.paymentError)
  }
</script>

<form class="payment-form" onsubmit={submit} aria-busy={state === 'loading' || state === 'submitting'}>
  <div bind:this={container}></div>
  {#if state === 'loading'}<p class="payment-loading" role="status">{labels.loading}</p>{/if}
  <Button type="submit" size="lg" disabled={state !== 'ready'}>{state === 'submitting' ? labels.paying : labels.pay}</Button>
</form>

<style>
  .payment-form { display: grid; gap: var(--space-md); justify-items: start; }
  .payment-form > div { justify-self: stretch; }
  .payment-loading { margin: 0; color: var(--muted-foreground); }
</style>
