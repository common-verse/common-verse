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
| `Field`     | Required `id`, `label`; optional `hint`, `messages`, `error`, `control` snippet                             | Label, input and one reserved line for hint or error              |

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

## Fields and validation

`Field` renders a label, an input (or the `control` snippet, for example a
select) and one line below it for the hint or the error. `messages` lists every
error the field can show and `error` names the current one. All of them sit in
the same grid cell, so the field keeps its height in all states; the error fades
over the hint in `motion-fast` without an icon. The invalid border is `error`
plus a 1px shadow, the text `error-text`. The control gets `aria-invalid` and
`aria-describedby` pointing to the error or the hint.

Forms validate with one ArkType schema that the Astro page and the hydrated form
share (`checkoutSchema` in `src/lib/shop.ts`); the address length limit is
checked beside it, so it is reported together with field errors. An error
appears when an edited field is left invalid; while it shows, it updates on
input and disappears once the value is valid, then waits for the next blur.
Submit marks every invalid field and focuses the first one; a valid submit
disables the button so one press sends the form once. The form is `novalidate`
also without JavaScript: the server renders the same field errors, focuses the
first invalid field and shows one error notification.

On narrow screens `scroll-padding-block-end` keeps focused fields clear of the
bottom bar.

## Notifications

Page feedback slides out under the sticky header and overlays the content, so
nothing moves. There are two kinds: success (polite live region, closes itself
after 6 s, paused on focus and, with a pointer that can hover, on hover) and
error (assertive, stays until closed). Pages pass `notice` to `BaseLayout`,
usually from a `?status=` redirect; islands call `notify()` from
`$lib/notifications` (calls before the area has mounted are dropped).

Server-rendered errors without a field to focus, including cart errors, take
focus (`noticeFocus`) and are read that way; after a checkout field error the
focused field reads its own error, so that notice is not announced. A
server-rendered success is repeated once in a hidden live text after hydration,
because text already in a live region at load is not announced. Without JavaScript the close control is a
link to `noticeCloseHref` (the page without its status) or, by default,
`#notice-closed`, a hidden target that hides the notices in place; with
JavaScript it is a button that keeps keyboard focus from the link, and Escape
closes a focused notice. Reduced motion fades instead of sliding but keeps the
6 s. Persistent states, such as unavailable payments or cart lines, are quiet
text without a box.

## Cart drawer

The shop list and product pages render `CartDrawer`, one island with the floating
cart button and the drawer. From 40rem the drawer is non-modal and pushes the
page aside below the full-width sticky header; below 40rem it is a modal bottom
sheet (90 % high, swipe down on its head, Escape or the close button). It stays on
the physical right in every language; only its text follows the locale. Focus
moves to the heading on open and back to the opener on close, or to the card's
"Im Warenkorb" when the add button has turned into it. While the push drawer
opens or closes, shop cards move to their new columns in a view transition;
reduced motion skips it.

Add-to-cart forms (`data-add-to-cart`) and links to the cart (`data-open-cart`)
work without JavaScript: they post to and link to `/shop/cart`. With JavaScript
the drawer intercepts them and talks to `/api/cart`, an Astro route that calls the
CMS through `src/lib/cms.ts` with the httpOnly cart cookie. The cart page and the
drawer render the same `CartLines` and `CartSummary` from one `cartView`: a
quantity stepper (submit buttons without JavaScript), the limit hint at 10 or the
stock, an inline undo row without a timer after removing, totals, one line each
for delivery within Germany and the payment methods, and the checkout button
(quiet text when checkout is blocked). A new line slides in and is briefly tinted
(a still tint with reduced motion); its sentence goes to the drawer's polite status
line. Without JavaScript the cart page tints the added line instead of showing a
notice, and a quantity change returns to `#line-<id>`. Drawer requests run one at
a time, quantity presses are sent after 400 ms, and waiting presses are sent before
checkout. Errors use the page notification.

The floating button shows the number of copies from the httpOnly
`poetry-cart-count` cookie, which every cart read and change updates, so pages need
no CMS request for it. It sits above the bottom bar on narrow screens, hides while
the drawer is open, and widens the page's bottom scroll padding so focused content
is never behind it. Book titles inside translated sentences are wrapped in Unicode
isolates to keep their own direction.

## Checkout

The checkout is a split screen like Stripe's: a grey, read-only order summary
(covers with quantity badge, title, language, pages and year, subtotal, shipping,
total and price note) on the left and the inputs on the right. The split stays
physical in every language; only the text mirrors. Below 60rem the summary folds
into a bar at the top ("Details anzeigen" with the total), a native `<details>`
that opens without JavaScript; from 60rem it is always open and sticks below the
header. The right column starts with the delivery and payment-method lines, the
wallet buttons and "oder", then contact, address and payment, the legal sentence
with links to terms, withdrawal and privacy, and directly above „Zahlungspflichtig
bestellen“ the order facts: on narrow screens every book with its features, the
shipping, the total and the price note; on wide screens only the total line, as
the books are beside it. The order button is at least 52 px tall with 17 px bold
text at every width (§ 312j Abs. 3 BGB asks for easy reading). Company and address
addition fold behind a link; opening it moves focus to the company field. Germany
is a read-only row („Deutschland · einziges Lieferland“), not a select. Labels are
small and inputs 16 px, so phones do not zoom into them.

`CheckoutForm` mounts Stripe's Payment Element (accordion, wallets hidden) and
Express Checkout Element with an appearance read from our tokens: colours are
resolved to sRGB in the page and updated when the theme changes; the iframes
cannot use squircles, so their radius is the plain control radius. Room is kept
for the Payment Element while it loads. The wallet row is rendered out of the
flow and appears only when Stripe reports a wallet before the buyer has pressed,
typed or scrolled; otherwise it stays away, so nothing ever moves under the
buyer.
A press of the order button sends one payment start (a press while Stripe still
loads says so); Stripe's own field errors
stay inside the Payment Element, other failures use the page notification.

The street field (`AddressField`) is an ARIA 1.2 combobox with a listbox popup
that overlays the fields below. ↓/↑ move through the suggestions (wrapping), Enter
picks, Escape closes only the list, Tab closes it; a pointer or tap picks without
moving focus. A polite status line announces the number of suggestions and the
picked address. Browser autofill does not open suggestions. See
[shop](shop.md#address-suggestions) for the data source.

From the shop to checkout the new page slides in from the right while the header
stays; on wide screens the cart lines move into the summary. Back slides the other
way. All shop pages opt into cross-document view transitions; a small head script
skips every other navigation. Reduced motion and browsers without the Navigation
API's activation info navigate without the transition.

## Header

The header stays `dir="ltr"`; its links and labels carry the locale direction.
On wide screens the navigation sits beside the logo, with language and theme at
the end. With large text on narrow screens the controls wrap below the logo
instead of overflowing. Header, main content, footer and bottom bar keep clear of safe areas
(`viewport-fit=cover`).

The language menu is a native `popover` rendered by Astro (there is no popover
primitive in `ui`), so it opens, closes with Escape or an outside click, and
returns focus without JavaScript. It is a dialog named by its title and fades in without moving. Each
language shows its native name and, below it, its name in the current UI
language from `Intl.DisplayNames`. A small script carries the URL fragment over
to the chosen language and closes the menu when focus moves outside it. Without
anchor positioning the menu sits at a fixed place below the header's end.

Below 52rem the primary navigation becomes a bottom bar of four icons
(`mic-vocal`, `newspaper`, `quote`, `shopping-bag`). It is the same `<nav>`:
labels stay in the markup as accessible names and are only visually hidden.
The current section is marked with `aria-current` and a soft pink squircle
(an outline in forced-colors mode).
A `scroll-state` container query tucks the bar away while scrolling down and
brings it back on scrolling up or keyboard focus; browsers without that query
keep it visible. The theme button is described in
[design tokens](design-tokens.md#preferences-and-verification).

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
