<script lang="ts" module>
  import { tv, type VariantProps } from 'tailwind-variants'
  import type { Component } from 'svelte'
  import type {
    HTMLAttributes,
    HTMLButtonAttributes
  } from 'svelte/elements'
  import type { Locale } from '@poetry/i18n'

  // One line under the sticky header; each tone picks its three banner tokens.
  export const bannerVariants = tv({
    base: 'm-0 border-b border-(--banner-border) bg-(--banner-background) py-2 pr-[max(var(--header-gutter),env(safe-area-inset-right,0px))] pl-[max(var(--header-gutter),env(safe-area-inset-left,0px))] text-center text-sm leading-snug font-semibold text-(--banner-foreground) backdrop-blur-lg [--banner-border:color-mix(in_oklch,var(--banner-foreground)_15%,transparent)]',
    variants: {
      tone: {
        info: '[--banner-background:var(--info-banner-background)] [--banner-foreground:var(--info-banner-foreground)] [--banner-hover:var(--info-banner-hover)]',
        success:
          '[--banner-background:var(--success-banner-background)] [--banner-foreground:var(--success-banner-foreground)] [--banner-hover:var(--success-banner-hover)]',
        warning:
          '[--banner-background:var(--warning-banner-background)] [--banner-foreground:var(--warning-banner-foreground)] [--banner-hover:var(--warning-banner-hover)]',
        error:
          '[--banner-background:var(--error-banner-background)] [--banner-foreground:var(--error-banner-foreground)] [--banner-hover:var(--error-banner-hover)]'
      },
      // Slides down from under the header when it appears (fades with reduced motion).
      animate: {
        true: 'transition-[translate,opacity,display] transition-discrete duration-(--motion-page) ease-(--motion-ease) starting:-translate-y-full starting:opacity-0 motion-reduce:starting:translate-y-0'
      }
    },
    defaultVariants: { tone: 'info' }
  })
  export type BannerTone = NonNullable<VariantProps<typeof bannerVariants>['tone']>
  export type BannerAction = HTMLButtonAttributes & {
    icon: Component
    label: string
  }
  export type BannerProps = HTMLAttributes<HTMLParagraphElement> & {
    tone?: BannerTone
    /** An icon button inside the sentence; the label is its accessible name. */
    action?: BannerAction
    animate?: boolean
    /** Language of the text when it differs from the page. */
    locale?: Locale
  }
</script>

<script lang="ts">
  import { getLocaleMetadata } from '@poetry/i18n'
  import { cn } from '$lib/utils'
  let {
    tone = 'info',
    action,
    animate = false,
    locale,
    class: className,
    children,
    ...restProps
  }: BannerProps = $props()
</script>

<p
  role={tone === 'error' ? 'alert' : 'status'}
  lang={locale}
  dir={locale && getLocaleMetadata(locale).direction}
  {...restProps}
  data-slot="banner"
  class={cn(bannerVariants({ tone, animate }), className)}
>
  <span class="align-middle">{@render children?.()}</span>
  {#if action}
    {@const { icon: Icon, label, ...buttonProps } = action}
    <!-- As tall as the text line, so every banner has one height; the tap area grows to 44px. -->
    <button
      type="button"
      {...buttonProps}
      aria-label={label}
      class="relative -my-1 ms-1 inline-grid h-6 w-7 cursor-pointer place-items-center rounded-[calc(var(--control-radius)-0.375rem)] align-middle [corner-shape:squircle] after:absolute after:-inset-x-2 after:-inset-y-2.5 after:content-[''] hover:bg-(--banner-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
      ><Icon class="size-4" aria-hidden="true" /></button
    >
  {/if}
</p>
