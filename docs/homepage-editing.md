# Homepage editing

The homepage is a Payload global under **Pages → Home**. Astro renders the
public homepage and its preview using the same components. Ordinary public pages
remain server rendered; the preview bridge is active only on authorised previews.

German lives at `/`; other languages keep their locale prefix. Visitors can choose
Light, Dark, or System appearance in the header. Colour and UI foundations are
documented in [design-tokens.md](design-tokens.md).

Your Payload interface language is your account's preferred language for editor
controls. It is independent of the content language selected for editing: you can
use Ukrainian controls while editing English content. English is the agreed UI
default/fallback, including for unsupported Kurmanji editor UI. Website Kurmanji
content and UI remain supported. Custom editor labels use the CMS UI catalog described in
[translations](translations.md).

## Editorial controls

- **Hero:** choose a poem, workshop/event, or project announcement.
  The headline and short introduction are translated independently. Poems keep
  their original language and show a translation only when one actually exists.
- **Featured:** add a promotion anywhere in the section order. Choose a poem,
  author, or event/workshop, then give the section a translated title and short
  introduction. The selected record supplies its own content and destination;
  editing that record updates the promotion too. A poem shows as a poem card, an
  author as an author card with their biography. Articles are available in their
  own collection and public archive.
- **Mission:** the project introduction. Edit its heading, text, image, link,
  and position. It can be removed or repeated like the other sections.
- **Events:** events and workshops share one picker. Automatic shows up to
  four nearest upcoming published records. Manual shows only the selected records,
  in the chosen order, up to four. Past events, drafts, duplicates, and records
  without a title in the current language are omitted. Events remain
  listed through their calendar day. Dates use Europe/Berlin time.
- **Poems:** Automatic shows the four newest published poems by creation date.
  Manual shows only the chosen poems, up to four and in selection order. Each card
  shows the poem in the visitor's language, else its original with a "not
  available in this language" note; never a third language.
- **Authors:** Automatic shows the four newest published authors with at least one
  published poem. Manual shows only the chosen authors, up to four and in
  selection order. Cards link to the author page (`/autoren/<slug>`); names
  missing in a language show the German name.
- **Take part:** edit up to three destinations and their translated labels and
  descriptions. Root-relative links automatically use the visitor's locale.
- **Newsletter:** edit its heading, text, and signup destination. Signup opens the
  configured newsletter service; this site does not pretend to collect emails.
- **Search and social sharing:** edit the localised title, description, and image.

Mission retains its existing `introduction` block identifier to preserve saved
content. Existing selections and participation links remain available; no seed
command overwrites an existing homepage.

Sections can be removed or repeated; those with a visibility toggle can also be
hidden. Order, relationships,
dates, and visibility are shared between languages; editorial prose is localised.
Payload language fallback is disabled. Missing prose uses the translated base UI
copy, never another language's editorial text. Images without an accessible
description in the current language are omitted.

## Drafts and starting content

Save drafts to review changes privately, then publish to make them public.
See [draft previews](previews.md) for Live Preview setup and security, and
[demo data](demo-data.md#homepage-starting-content) for local initialization.

About, Contact, Privacy, and Legal Notice have separate global editors under Pages.
Their content and fallback rules are in [editorial models](editorial-models.md)
and [translations](translations.md#defaults-and-missing-translations).
