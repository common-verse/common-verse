# Line Break identity

The identity contains two marks: the full written logo and the stanza favicon.
The wordmark has a pink indentation beside the offset middle line. The stanza
mark stands alone; never place it next to the wordmark.

## Files

- `logo.svg`: transparent wordmark with vector lettering and no font dependency.
- `logo.png`: transparent wordmark, 1200 pixels wide.
- `favicon.svg`: stanza mark on a squircle tile; the tile inverts in dark browser themes.
- `favicon.ico`: 16, 32 and 48 pixel browser fallback (light-theme colours).

## Usage

The header and footer render the full wordmark through `BrandLogo.astro`, using
semantic theme colours for the lettering and the primary colour for the indentation.
The logo changes instantly with the theme, and its header size shrinks during scrolling.
The document head uses the SVG favicon and ICO fallback.

Preserve the offset line, proportions and gaps. Keep both marks upright in LTR
and RTL layouts; do not mirror them. Give the artwork clear space of at least
one bar thickness.

Saved artwork uses ink `#101010` and pink `#FF3D5E`; the favicon tile is ink with
white `#FDFDFC` lines, inverted in dark mode.
