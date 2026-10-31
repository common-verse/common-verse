# UI components

Project-owned Svelte 5 primitives live in `apps/web/src/lib/components/ui`.
Import each component from its folder barrel, using `$lib/components/ui/...`.
They render server-side from Astro; add hydration only when browser events or state
require it. They use the existing semantic tokens in `src/styles/token.css`.

| Component   | Props                                                                                                       | Default                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `Button`    | `variant`: default, secondary, outline, ghost, destructive; `size`: default, sm, lg, icon, icon-sm, icon-lg | Primary, 44px minimum height                                      |
| `Link`      | Required `href`; `variant`: inline, standalone, subtle, heading                                             | Underlined inline link                                            |
| `Heading`   | Required `level`: 1–6; optional `variant`: display, title, subtitle                                         | Visual size follows the native heading and existing editorial CSS |
| `Text`      | `as`: p, span, div; `variant`: body, lead, small, caption; `tone`: default, muted                           | Body paragraph                                                    |
| `Eyebrow`   | `as`: p, span                                                                                               | Small introductory paragraph                                      |
| `Card.Root` | `as`: div, article, section, aside; `variant`: default, accent; `size`: default, sm                         | Neutral card surface                                              |
| `Badge`     | `variant`: default, secondary, outline, destructive; optional `href`                                        | Primary badge rendered as a span                                  |

Native HTML attributes, including `id`, `lang`, `dir`, ARIA attributes and event
handlers, are forwarded. Use `class` for layout; use component props for typography
and appearance. `Button` and `Link` also expose a bindable `ref` for composition
with Bits UI triggers.

`Button` renders an anchor when given `href`. A disabled button anchor has no
`href`, exposes `aria-disabled`, leaves the tab order and ignores click handlers.
Icon sizes are Button variations and require `aria-label`; hide decorative icons
from assistive technology. The default icon target is 44px square.

Heading levels express document structure independently of visual size. Text and
Eyebrow do not replace headings. Content language and direction must remain
explicit when they differ from the page locale. Links accept already-resolved
URLs: routes still use `localizedPath`, and editorial URLs still use `safeHref`.

## Svelte composition

Before composing UI, refer to the existing
[event detail page](../apps/web/src/pages/[locale]/events/[slug].astro) for Card,
Button, and typography usage, and
[HomeFeature.astro](../apps/web/src/components/HomeFeature.astro) for links and badges.

Card also exports `Header`, `Content`, `Footer`, `Action`, `Title` and `Description`.
`Title` composes Heading (default level 2, subtitle size), and `Description` composes
Text (default small and muted). Select the appropriate heading level at the call
site. Card parts share `--card-spacing`, which can be customized on the root.

## Accessibility and RTL

Components must work in LTR and RTL, expose semantic HTML, retain visible focus,
and respect reduced motion. Prefer logical CSS properties. Preserve native
controls, keyboard operation, accessible names, useful error text, and WCAG AA
contrast. Use the existing component primitives for patterns needing managed
focus or ARIA. Verify affected UI with keyboard input, a narrow viewport, German
or English, and Arabic or Persian. Use `web-accessibility` for deeper evaluation;
record checks actually performed rather than claiming accessibility from a scan.

## Profile portraits

Public poet cards and profile pages use DiceBear Open Peeps with the Bold Pop
preset. A missing portrait is generated locally from the person’s ID; the same ID
produces the same illustration across locales and pages. Uploaded editorial
portraits take precedence. Earlier imported demo portrait photos are replaced in
the public UI by illustrations; their media records remain intact. No external
avatar API calls, browser JavaScript, or portrait-photo seed step is needed.

## Event page transitions

The programme and event detail pages opt into native cross-document view
transitions, outside draft previews. Matching event titles and descriptions share stable names. Programme rows and
the detail heading use proportional text widths and font sizes
to preserve line wrapping while compact list text scales into the detail heading. Matched text uses a single visible
snapshot rather than a crossfade between duplicate glyphs;
the title and description move for 200 ms while the site header stays steady.
The remaining content fades in with a `space-xs` downward shift, starting at 75%
of `motion-page` (150 ms) and lasting `motion-fast` (160 ms) so it overlaps the end of the text transition. The detail body and back link have their own entrance layers. Only the
active featured title, description, and image participate, avoiding hidden carousel content
in the transition. Browser Back and ordinary links retain native navigation behaviour.
Reduced motion disables the transition, and unsupported browsers navigate normally.
No client-side router or additional runtime dependency is used.
