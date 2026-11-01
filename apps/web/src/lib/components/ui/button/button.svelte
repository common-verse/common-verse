<script lang="ts" module>
  import { tv, type VariantProps } from 'tailwind-variants'
  import type {
    HTMLAnchorAttributes,
    HTMLButtonAttributes
  } from 'svelte/elements'

  export const buttonVariants = tv({
    base: 'inline-flex shrink-0 items-center justify-center gap-2 rounded-(--control-radius) [corner-shape:squircle] text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground',
        outline:
          'border border-input bg-background text-foreground hover:bg-accent',
        ghost: 'text-foreground hover:bg-accent',
        destructive:
          'bg-destructive text-destructive-foreground hover:opacity-90'
      },
      size: {
        default: 'min-h-11 px-5 py-2',
        sm: 'min-h-9 px-3 py-1.5',
        lg: 'min-h-12 px-6 py-3',
        icon: 'size-11 p-0',
        'icon-sm': 'size-9 p-0',
        'icon-lg': 'size-12 p-0'
      }
    },
    defaultVariants: { variant: 'default', size: 'default' }
  })
  export type ButtonVariant = VariantProps<typeof buttonVariants>['variant']
  export type ButtonSize = NonNullable<
    VariantProps<typeof buttonVariants>['size']
  >
  export type ButtonProps = Omit<
    HTMLButtonAttributes & HTMLAnchorAttributes,
    'size'
  > & {
    variant?: ButtonVariant
    ref?: HTMLButtonElement | HTMLAnchorElement | null
  } & (
      | { size: 'icon' | 'icon-sm' | 'icon-lg'; 'aria-label': string }
      | { size?: 'default' | 'sm' | 'lg' }
    )
</script>

<script lang="ts">
  import { cn } from '$lib/utils'
  let {
    href,
    class: className,
    children,
    type = 'button',
    disabled = false,
    variant = 'default',
    size = 'default',
    ref = $bindable(null),
    onclick,
    ...restProps
  }: ButtonProps = $props()
</script>

{#if href !== undefined}
  <a
    {...restProps}
    bind:this={ref}
    data-slot="button"
    class={cn(buttonVariants({ variant, size }), className)}
    href={disabled ? undefined : href}
    aria-disabled={disabled || undefined}
    role={disabled ? 'link' : undefined}
    tabindex={disabled ? -1 : restProps.tabindex}
    onclick={(event) => {
      if (disabled) {
        event.preventDefault()
        return
      }
      onclick?.(event)
    }}
  >
    {@render children?.()}
  </a>
{:else}
  <button
    {...restProps}
    bind:this={ref}
    data-slot="button"
    class={cn(buttonVariants({ variant, size }), className)}
    {type}
    {disabled}
    {onclick}
  >
    {@render children?.()}
  </button>
{/if}
