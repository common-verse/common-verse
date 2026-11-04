# Public routing

Astro owns route resolution. URLs use explicit route mappings, independently of
translated navigation labels and internal field names.

- German routes have no locale prefix: `/` and `/kontakt`.
- Other languages have a locale prefix and English page path names: `/en/contact`,
  `/ar/contact`, `/fa/contact`, `/uk/contact`, and `/ku/contact`.
- New or changed editorial slugs use Latin ASCII letters, digits, hyphens, and
  underscores. Existing saved slugs remain valid when unchanged. Public path
  segments use Latin ASCII characters. Arabic and Cyrillic characters
  are technically supported through URL encoding, but Latin paths are the agreed
  project convention. Editorial titles keep their original script.
- Identify the same page internally with one stable route key, such as `contact`.
  Map that key to `kontakt` for German and `contact` for other languages. Do not
  derive a route by translating its navigation label.
- Language switching resolves the same page through the route mapping and keeps
  its query and anchor. Switching from `/kontakt` to Arabic should lead to
  `/ar/contact`; switching back should return to `/kontakt`.
- Links, previews, canonical URLs, and language alternates must all use the same
  route resolution. Main-page aliases use permanent (301) redirects to the canonical
  localized URL, preserving query parameters; browsers retain URL anchors. Examples:
  `/de` → `/`, `/de/contact` → `/kontakt`, `/ar/kontakt` → `/ar/contact`.
- Content-record slugs are separate from interface labels. Keep existing slugs
  stable; changes to a record's public URL require an explicit naming decision.
- Events store a German and an English slug. German routes use the German slug,
  all other locales the English one (`slugLocale` and `recordPath` in
  `@poetry/i18n`). A slug from the other slot returns 404. Canonical URLs,
  alternates and the language switcher link each locale to its own slug; the
  switcher links locales without the record to the section overview.

Fixed local routes are backed by the About, Contact, Privacy, Legal Notice, and
Terms of sale Payload globals. German uses `/ueber-uns`, `/kontakt`,
`/datenschutz`, `/impressum`, and `/agb`; other locales use `/about`, `/contact`,
`/privacy`, `/legal`, and `/terms` with a locale prefix. The footer links to these local routes. Missing or incomplete
translations use the English page. If English is also unavailable, the route returns
a 404. Language alternates include routes served with English fallback. Editors can
supply and publish translations separately for each language.

Poems, Authors, Events and Articles use `/gedichte`, `/autoren`,
`/veranstaltungen` and `/artikel` in German. Other locales use prefixed English
segments: `/ar/poems`, `/ar/authors`, `/ar/events` and `/ar/articles`.
Main-page redirects also cover collection indexes, such as `/de/articles` →
`/artikel`.

The shop uses `shop` in every locale: `/shop` and `/ar/shop` list books,
`/shop/<slug>` shows a book, and `/shop/cart`, `/shop/checkout`, and
`/shop/checkout/complete` handle the order. Product slugs `cart` and `checkout`
are therefore unavailable. The order status page uses `/bestellstatus` in German
and `/<locale>/order-status` elsewhere, a main-page route with the usual 301 aliases. Detail-page aliases and old collection names (`blog`, `posts`,
`workshops`, `poets`) still return 404 without redirects.

## Implementation

`packages/i18n/src/index.ts` owns stable route keys and public path
mappings. Links, previews, metadata, and language switching use `localizedPath`;
Astro middleware resolves German paths and rejects noncanonical paths. Query strings,
anchors, and content-record slugs survive language switching. About, contact, privacy,
legal, and terms routes resolve fixed Payload globals.

The document declares the routed locale in `lang` and `dir`; embedded content
declares its own language. Fallback content follows the rules in
[translations](translations.md#defaults-and-missing-translations).

## Verification

Check route mappings, canonical URLs, query/anchor preservation, main-page 301
redirects, and detail/old-path 404 responses. Language-switching browser tests
cover the same-page behavior; use [testing guidance](testing.md).

## Framework reference

- [URL character encoding](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURI)
