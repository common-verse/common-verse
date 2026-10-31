# Translations

Supported locales are `de`, `en`, `ar`, `fa`, `uk`, and `ku` (Kurmanji).
Locale labels and direction live in `@poetry/i18n`. These translation rules are
project requirements; public URL conventions live in [routing](routing.md).

## Three translation buckets

| Bucket               | Owner                                       | Examples                                                                                                                                                           |
| -------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Payload UI we define | A dedicated Paraglide/inlang catalog in Git | Collection and section names, field labels, descriptions, placeholders, option labels, custom validation messages, custom components, and the draft-preview banner |
| Website UI           | A separate Paraglide/inlang catalog in Git  | Navigation, fixed button labels, language controls, theme controls, and standard empty-state messages                                                              |
| Website content      | Payload editorial data and translations     | Headlines, introductions, biographies, event descriptions, image alternative text, editorial link text, poems, and their explicit translations                     |

Payload's standard controls, such as Publish, Save, and version history, retain
Payload's built-in translation packs. We do not copy or replace those packs in
Paraglide. This is a framework implementation detail within the Payload UI bucket,
not another content or UI catalog owned by the project.

Website and Payload UI catalogs remain separate. Both use Paraglide/inlang, but
they have their own messages and compilation. Share language codes and direction
metadata through `@poetry/i18n`; do not merge the catalogs or couple their wording.
The draft-preview banner is editor UI even though Astro renders it inside the
website preview. Its text belongs to the Payload UI catalog.

Classify text by who authors it, not by the HTML element displaying it. A fixed
navigation label is UI. A button's link text written by an editor is content. The
field label “Project introduction” is UI; the introduction typed into that field
is content. Payload localization stores editorial translations; it does not
automatically write translations for either editorial text or our UI labels.

Poems belong to the website-content bucket. Preserve one original title, language,
and text, plus optional explicit translation records and translator attribution.
Do not treat the original as missing merely because it differs from the website
language, or require a translation in every supported language.

## Independent language choices

The **Payload interface language** is the language chosen by a person using
Payload. It applies to editors and administrators; it is unrelated to their role
or permissions. Existing Payload account preferences own this choice.

The **content language** is the language selected for editing editorial fields.
Changing it selects another content translation. It must not change the interface
language or translate existing saved text automatically.

The **website language** is selected by the public locale route. It determines
website UI messages and the requested content translation. Embedded poem originals
and translations retain their own language and direction.

For example, a user can choose Ukrainian Payload controls, edit English content,
and then preview Arabic content. Their editor controls and draft banner remain
Ukrainian; the preview's website UI becomes Arabic. Switching content languages
must not change the user's interface preference.

## Defaults and missing translations

- English is the default and fallback for project UI translations. A supported
  user preference or selected website locale still takes precedence.
- If a UI translation is missing, use its English message. Keep an English source
  message for every key and make incomplete translation coverage visible during
  development and review.
- Kurmanji (`ku`) falls back to English for the entire Payload interface because
  the installed Payload translation package does not support it. Do not add a
  partial Kurmanji editor language or replace Payload's translation packs.
- Kurmanji remains supported for website UI and editorial content.
- German remains the default content locale and the website language at `/`.
  English UI fallback does not change that routing or content decision.
- About, Contact, Privacy, and Legal Notice fall back to the complete English
  page when the requested translation is missing or incomplete. Their articles
  declare the content language and direction; surrounding UI uses the route locale.
  A missing English page remains a 404. No missing-translation notice is shown.
- Other editorial content fallback is disabled. Never silently substitute English,
  German, or another language's editorial text for a missing translation. Omit
  unavailable content or show an appropriate translated UI message. A deliberately
  designed generic UI message may fill an empty area, but must not be presented as
  a translation of missing editorial content.

## Displayed labels and stored values

A label is text the user sees. A stored value is the stable identifier saved in
Payload and read by the application. Translate the label; keep the identifier.

The Poems section's selection mode provides a practical example:

| Payload interface language | Displayed option | Saved value |
| -------------------------- | ---------------- | ----------- |
| English                    | Automatic        | `auto`      |
| Ukrainian                  | Автоматично      | `auto`      |
| German                     | Automatisch      | `auto`      |

Payload saves `selectionMode: "auto"` in every case. The website reads `auto` and
shows the four newest published poems. Translating or rewording the option does
not change the saved setting or require the website to recognize every translated
word. The manual option similarly keeps the value `manual`.

Field names follow the same rule: the UI can translate “Heading”, while the stored
field remains `heading`. Keep collection slugs, block identifiers such as
`introduction`, relationship IDs, and option values stable. Translating UI alone
must not require a database migration or rewrite editorial records.

## Direction and translation quality

Use central locale metadata: Arabic and Persian are RTL; German, English,
Ukrainian, and Kurmanji are LTR. Interface direction follows the effective
interface language. The Events header keeps its introduction on the left and
featured event on the right in every locale. The site header also keeps its logo,
navigation links, and controls in the same physical order; individual labels keep
their language direction. Text follows the locale direction. Carousel controls keep previous on the left,
next on the right, and the same arrow and slide directions in every language. Date/time strings and the feature counter use bidi
isolation to preserve their internal order. Content fields and embedded text follow their content
language, including when it differs from the interface.

Declare the correct `lang` and `dir` for mixed-language content and the preview
banner. Verify keyboard behavior, narrow layouts, long translations, mixed writing
directions, and English fallback. Translated wording is provisional for the
MVP/POC. Native-speaker wording review is a separate task before public launch;
it does not block the MVP implementation.

Adding a locale requires central metadata, Paraglide catalogs, Payload locales,
tests, metadata alternates, and editor documentation to be updated together.

## Implementation

- **Payload UI:** `packages/cms-ui/messages/{locale}.json`, with a separate Inlang
  project in `packages/cms-ui/project.inlang`. It compiles English, German, Arabic,
  Persian, and Ukrainian. `label()` supplies Payload's localized label objects;
  `message()` resolves custom messages with an explicit interface language.
  Neither changes global request locale state. Payload's own packs handle its
  standard controls, with English fallback.
- **Website UI:** `apps/web/messages/{locale}.json`, with its own Inlang project.
  English is the base/fallback. Shared compiler options in
  `apps/web/paraglide.config.mjs` explicitly recognize unprefixed German URLs,
  independently of the English UI fallback.
- **Content:** Payload's six content locales keep `fallback: false`. Preview
  queries explicitly disable content fallback as well. No field names, collection
  slugs, block identifiers, selection values, or existing records were renamed.
- **Inputs:** native Payload text and textarea controls retain their validation
  and behavior. Localized editorial inputs declare the selected content language
  and direction. Original poems and explicit translations use their own language
  fields, so Arabic originals and English translations can share one form.
  Interface labels continue to follow the editor preference.

## Catalog compilation

Run the owning catalog compiler from the repository root:

```sh
pnpm --filter @poetry/cms-ui compile
pnpm --filter @poetry/web compile:ui
```

Compilation, development setup, and the owning app commands check the catalogs.
Every message requires an English source. Missing locale messages produce a visible
English-fallback warning. Generated Paraglide files are ignored and recreated by
setup, app builds, and tests; edit the JSON catalogs instead.

Choose affected checks using [testing guidance](testing.md).
See [draft previews](previews.md) for the editor-language banner.

## Verification and remaining review

Automated checks cover English fallback in both compiler configurations, stable
saved values, disabled editorial fallback, independent editor language, ASCII slug
validation, route mappings, query/anchor preservation, main-page redirects, and old-path 404 responses.
Browser tests cover all six website locales, preview authorization, language
switching, keyboard interaction, and RTL rendering.

Real signed-in Payload checks confirmed German, English, Ukrainian, Arabic, and
Persian interface preferences independently of English content. Ukrainian controls
also previewed Arabic content while retaining a Ukrainian draft banner. Arabic
editor controls were checked at a narrow viewport. Arabic poem original inputs
retained RTL while their English translation inputs retained LTR. Temporary test
accounts and draft records were removed afterward.

Native-speaker review is still pending and is required before treating the wording
as final for public launch. Payload-owned translation gaps (for example its
hardcoded “Responsive” preview control) remain framework-owned; this work does
not replace Payload's translation packs. A small client-side label adapter handles
Payload 3.90's relationship drawer accessibility label, which otherwise displays a
localized label object as `[object Object]`.

## Framework references

- [Payload interface translations](https://payloadcms.com/docs/configuration/i18n)
- [Payload content localization](https://payloadcms.com/docs/configuration/localization)
- [Inlang message catalogs](https://inlang.com/m/reootnfj/plugin-inlang-messageFormat)

## Event date and time formatting

Event labels use `Intl.DateTimeFormat` and its CLDR locale data for `de`, `en`,
`ar`, `fa`, `uk`, and `ku`. Keep weekday and time in the same formatter so the
locale controls their punctuation and clock format. German appends “Uhr” through
the UI catalog; other languages retain their native time patterns.

All event times use `Europe/Berlin`, including daylight saving. Calendars and
numerals follow locale conventions: Persian uses the Solar Hijri calendar and
Persian digits. Arabic explicitly uses Arabic-Indic digits, and Persian explicitly
uses Persian digits, consistently for dates, times, and featured-event counters. The list omits the year only when the event and today share the
same year in the displayed calendar, so Persian year changes follow Nowruz.
English follows the generic `en` locale (month/day numeric dates and a 12-hour
clock). A regional English variant would be a separate product decision.

References: [Unicode locale date charts](https://cldr.unicode.org/index/charts)
and [Intl calendar options](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#calendar).
