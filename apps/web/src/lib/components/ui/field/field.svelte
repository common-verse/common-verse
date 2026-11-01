<script lang="ts" module>
  import type { Snippet } from 'svelte'
  import type { HTMLInputAttributes } from 'svelte/elements'

  export type FieldControlAttributes = {
    id: string
    'aria-invalid': 'true' | undefined
    'aria-describedby': string | undefined
  }
  export type FieldProps = Omit<HTMLInputAttributes, 'id'> & {
    id: string
    label: string
    hint?: string
    /** Every error the field can show; the reserved line fits the longest. */
    messages?: Record<string, string>
    /** Key of the message shown now. */
    error?: string
    /** Replaces the input, for example with a select. */
    control?: Snippet<[FieldControlAttributes]>
  }
</script>

<script lang="ts">
  import { cn } from '$lib/utils'

  let { id, label, hint, messages = {}, error, control, value = $bindable(), class: className, ...restProps }: FieldProps = $props()
  const invalid = $derived(error !== undefined && error in messages)
  const attributes: FieldControlAttributes = $derived({
    id,
    'aria-invalid': invalid ? 'true' : undefined,
    'aria-describedby': invalid ? `${id}-error` : hint ? `${id}-hint` : undefined,
  })
</script>

<div class={cn('field', className)} data-invalid={invalid ? '' : undefined}>
  <label for={id}>{label}</label>
  {#if control}
    {@render control(attributes)}
  {:else}
    <!-- bind:value keeps what was typed before hydration. -->
    <input {...restProps} {...attributes} bind:value />
  {/if}
  <div class="field-message">
    {#if hint}<p class="field-hint" id="{id}-hint">{hint}</p>{/if}
    {#each Object.entries(messages) as [code, text] (code)}
      <p class="field-error" id={invalid && code === error ? `${id}-error` : undefined} data-active={invalid && code === error ? '' : undefined}>{text}</p>
    {/each}
  </div>
</div>

<style>
  .field {
    display: grid;
    gap: var(--space-3xs);
  }
  label {
    font-weight: 600;
  }
  .field :global(:is(input, select)) {
    min-block-size: 3rem;
    inline-size: 100%;
    padding-inline: var(--space-xs);
    border: 1px solid var(--input);
    border-radius: var(--control-radius);
    corner-shape: squircle;
    background: var(--background);
    color: var(--foreground);
    font: inherit;
  }
  /* A second pixel as shadow, so the invalid border does not move the text. */
  .field :global([aria-invalid='true']) {
    border-color: var(--error);
    box-shadow: 0 0 0 1px var(--error);
  }
  /* Forced colours drop the red and the shadow; a dashed border still marks the field. */
  @media (forced-colors: active) {
    .field :global([aria-invalid='true']) {
      border-style: dashed;
    }
  }
  /* Hint and errors share one cell: its height is the longest text in every state. */
  .field-message {
    display: grid;
    min-block-size: 1lh;
    font-size: var(--font-size-sm);
    line-height: 1.4;
  }
  .field-message > p {
    grid-area: 1 / 1;
    margin: 0;
    transition:
      opacity var(--motion-fast) var(--motion-ease),
      translate var(--motion-fast) var(--motion-ease),
      visibility var(--motion-fast);
  }
  .field-hint {
    color: var(--muted-foreground);
  }
  .field-error {
    color: var(--error-text);
    font-weight: 600;
  }
  .field-error:not([data-active]),
  [data-invalid] .field-hint {
    opacity: 0;
    visibility: hidden;
  }
  .field-error:not([data-active]) {
    translate: 0 -3px;
  }
  [data-invalid] .field-hint {
    translate: 0 3px;
  }
  @media (prefers-reduced-motion: reduce) {
    .field-message > p {
      translate: none !important;
    }
  }
</style>
