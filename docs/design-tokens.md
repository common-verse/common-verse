# Design tokens

Theme tokens live in `apps/web/src/styles/token.css`, imported by the global CSS
entry point configured in `apps/web/components.json`. Layout and component rules
stay in `global.css`. The token file owns Tailwind mappings, colour generation,
typography, geometry tokens, shadows, and `color-scheme` selection.

## Editable inputs

Only these HEX inputs define the palette:

| Input   | Value   | Purpose                                 |
| ------- | ------- | --------------------------------------- |
| `black` | #101010 | Ink, dark page                          |
| `white` | #FDFDFC | Paper, light page                       |
| `pink`  | #FF3D5E | Primary brand colour                    |
| `green` | #00C853 | Success                                 |
| `red`   | #D70000 | Error fills, field borders, error icons |

The system is monochrome: surfaces, text, borders and the header are mixes of
black and white without a brand tint. Pink is the only brand colour. Semantic
roles derive from the inputs with `color-mix()`; there is no conversion script
or separate numeric value to maintain.

## Surfaces and elevation

Light surfaces are exactly `white` and text exactly `black`; dark mode swaps them.
Dark cards add white at 5% alpha (#1C1C1C on the page), raised and muted states
8%. Card backgrounds use alpha, not element opacity, so nested cards accumulate
light while text stays opaque. Text pairings are verified against up to three
nested card layers; placing these overlays on photographs requires its own
checks. Menus and the dark header are opaque sRGB composites (#2C2C2C and
#1C1C1C) because content behind them must not bleed through.

| Surface              | Light                    | Dark                     |
| -------------------- | ------------------------ | ------------------------ |
| Page, header         | `white`                  | `black` / opaque #1C1C1C |
| Card                 | `white`, small shadow    | White at 5% alpha        |
| Muted / secondary    | Black 5% into white      | White at 8% alpha        |
| Accent (hover, item) | Pink 20% into white      | Pink 16% into black      |
| Menu / popover       | `white`, floating shadow | Opaque #2C2C2C           |

Light hierarchy uses three shadow tokens: `shadow-card` (2px offset / 6px blur),
`shadow-raised` (6px / 20px), and `shadow-floating` (12px / 36px). All use the black
anchor at 8% alpha in light mode and a transparent shadow colour in dark mode.

## Semantic roles

| Role                 | Tokens                                                           |
| -------------------- | ---------------------------------------------------------------- |
| Page and text        | `background`, `foreground`                                       |
| Cards and menus      | `card`, `card-foreground`, `popover`, `popover-foreground`       |
| Main action          | `primary`, `primary-foreground`, `primary-hover`, `primary-text` |
| Supporting surfaces  | `secondary`, `muted`, `accent`, each with `-foreground`          |
| Boundaries and focus | `border`, `input`, `ring`                                        |
| Feedback             | `success`, `error`, each with `-foreground`; `error-text`        |

Pink fills carry black labels (5.51:1). Pink itself is only large text or a fill:
event titles use the exact primary pink (3.39:1 on light, large text). Small pink
text uses `primary-text` (pink 70% into black in light mode, 75% into white in
dark mode). `secondary-text` aliases `primary-text` for eyebrows, notes and
supporting links. The logo indentation uses `primary`.

`secondary` is the quiet neutral control and badge surface (it equals `muted`);
`accent` is the soft pink hover and selection surface. Secondary buttons
therefore still show a visible change on hover.

There are two statuses. `error` (= `destructive`) is a real red, kept clearly
apart from the pink: it fills icons and destructive controls with white labels
and marks invalid field borders; it is never a button fill for actions. Text
uses `error-text`, which is the same red in light mode and 65% red mixed into
white in dark mode (#EE7969, at least 5:1 on three nested cards).
`success` is green with black labels. Info and warning are not statuses.

Use semantic Tailwind utilities such as `bg-primary text-primary-foreground`,
or semantic variables in project CSS. Compatibility aliases `paper`, `ink`,
`soft`, and `white` map existing editorial layouts onto the same system. The
Tailwind `white` compatibility alias represents the card surface; the raw
`--white` input represents the neutral anchor.

Use `border` for decorative dividers and `input` for control boundaries. Use
`ring` for keyboard focus. Do not communicate status through colour alone; add
clear text or an icon with a label. Keep literal colours out of components.

## Shapes

Buttons, controls, menu items, the language menu and the header icon bar use
`corner-shape: squircle` with a `border-radius` fallback. A squircle looks
squarer than a circle at the same radius, so the radii grow when it is
supported: `control-radius` is 12px, or 22px with squircles (a 44px control
becomes a full squircle); `panel-radius` is 18px, or 32px. Browsers without
`corner-shape` show ordinary rounded corners.

## Image overlays

The events programme keeps text on the page background, including in its featured
section. Photographs sit beside the text without overlays. In the programme list, dates, weekday and time, and locations share a consistent
column. Weekday and time stay together on one line, followed by the venue in plain text. Both light
and dark appearances use the same semantic roles.

## Preferences and verification

Light, Dark, and System use the same semantic tokens through `light-dark()` and
`color-scheme`. System follows the device preference even without JavaScript.
Explicit choices are saved in the first-party `poetry-theme` cookie for one year,
shared across locale routes and applied during server rendering to prevent a
wrong-theme flash.

The header has one theme button. It starts at System, labelled "Automatisch"
(the stored value stays `system`); a press switches to the opposite of what is
currently shown, and later presses toggle Light and Dark. Holding the button for
500 ms returns to System, the same way for mouse, finger, pen, Enter and Space;
there is no key or click shortcut. While it is held after a manual choice, a
primary-coloured ring fills along its squircle outline, and Android vibrates
briefly on the switch. Presses act on release, so a hold never toggles first.
The ring keeps its own transition during the reveal, so a hold started then
still fills over time. Screen readers mostly click and cannot hold, so after a
manual choice a visually hidden "reset to System" button follows the toggle;
`tabindex="-1"` keeps it out of the Tab order while the screen reader's own
cursor reaches it, and focus returns to the toggle after use. Its accessible
name states the current choice; the description says what a press does and how
to return to System. There is no tooltip; the ring explains the hold. The icon
morphs between a half-filled circle, sun and moon with CSS transitions only.

The new theme grows as a circle from the button in a same-document view
transition of type `theme`, lasting `motion-theme`. Before each switch the
button writes its centre to `--theme-origin-x/y`, so the circle starts exactly
at the button whether the header is expanded or compacted. During the reveal,
colour transitions and other view-transition names are switched off. The
browser sends pointer events to the root element while a view transition runs,
so the button also catches presses and holds inside its area during the
reveal; quick repeated presses are not lost. Reduced motion uses a `motion-page` cross-fade
and no icon spring. Browsers without typed view transitions switch instantly.

The system requires support for relative OKLCH, `color-mix()`, and `light-dark()`.
After changing an input or formula, rerun theme browser tests: generated colours
do not automatically guarantee contrast. Tests sample composited sRGB pixels,
verify text pairings at 4.5:1 and control/focus pairings at 3:1, check three nested alpha
card layers, and verify that derived roles follow a changed HEX input. German and
Arabic checks cover saved preferences, system changes, keyboard and touch input,
320px layouts, no-JavaScript rendering, and light/dark axe scans.
These checks cover the prototype, not a complete WCAG conformance audit.

## Fluid typography

The seven `--font-size-*` tokens follow the [Fluid Type Scale calculator](https://www.fluid-type-scale.com/):
400–1280px viewport widths, a 16–19px base, and ratios of 1.25–1.333. Values use
`clamp()` with rem bounds and a viewport term, rounded to two decimals at a
16px rem. Below and above this range the scale holds at its minimum and maximum.
Keep the root font size at the browser default; apply the base token to `body`
so rem spacing and browser font preferences remain independent of the fluid scale.

| Step   | Minimum | Maximum | Usage                                                  |
| ------ | ------- | ------- | ------------------------------------------------------ |
| `sm`   | 0.80rem | 0.89rem | Captions, metadata, eyebrows, badges, compact controls |
| `base` | 1.00rem | 1.19rem | Body, navigation, links                                |
| `md`   | 1.25rem | 1.58rem | Leads, editorial prose, translation titles             |
| `lg`   | 1.56rem | 2.11rem | Subtitles, card titles, featured verses                |
| `xl`   | 1.95rem | 2.81rem | Page subheadings and feature titles                    |
| `xxl`  | 2.44rem | 3.75rem | Homepage section headings                              |
| `xxxl` | 3.05rem | 5.00rem | Page and hero titles                                   |

Use these variables for component CSS. Tailwind `text-sm`, `text-base`, `text-md`,
`text-lg`, `text-xl`, `text-xxl`, and `text-xxxl` map to the same scale;
`text-xs`, `text-2xl`, and `text-3xl` are compatibility aliases for `sm`, `xxl`,
and `xxxl`. Choose a step by content role, independently of the semantic heading
level. Heading variants use `display` → `xxxl`, `title` → `xl`, and `subtitle` →
`lg`; Text uses `body` → `base`, `lead` → `md`, and `small`/`caption` → `sm`.
Preserve unitless line heights and wrapping for translated and RTL content.

## Motion

`motion-fast` is 160 ms for controls. `motion-page` is 200 ms for the event title
and description movement. `motion-theme` is 400 ms (2 × `motion-page`) for the
theme reveal. All three use `motion-ease`, `cubic-bezier(0.2, 0, 0, 1)`. The
theme icon morphs with its own spring (520 ms, 13% overshoot).
The remaining page content enters at 75% of the page duration (150 ms), using
half the fast duration (80 ms) and a downward shift of `space-3xs`. The total
sequence is 230 ms. These values are a design choice for this site's frequent
navigation, rather than a universal duration requirement. Reduced motion skips
the page transition.
