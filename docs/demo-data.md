# Demo data

Development seed tooling, fixtures, artwork, and tests live in
`apps/cms/scripts/seed/`, separate from application source in `apps/cms/src/`.
The CLI imports the real Payload configuration so generated records follow the
same schema and validation as editorial content. Application code does not import
seed tooling; Faker and the script runner remain development dependencies.

The curated TypeScript seed uses Payload's Local API to create one six-language
workshop with artwork, plus fictional cities, authors and poems
(`scripts/seed/seed-poems.ts`). Automatic seeding checks authors, media, pages,
poems, and events and skips the database if any contain records. User accounts
are excluded from this emptiness check.

The poem seed covers every page state: 26 published poems and one draft, with
originals in all six languages; Arabic and Persian originals without a German
translation; poems translated into all six languages, into some, or none; poems
with and without year and snippet. Its seven authors include ones with and
without portrait (generated SVG artwork, no photos), city and awards, the
pseudonym "Nachtfalke" without portrait or city, and one draft author. Names,
awards and places are fictional demo data. Poems are matched by German slug
(`demo-gedicht-*`), authors by German name and cities by German name; existing
records are skipped.

All writes share one PostgreSQL transaction. A failure rolls back records and
removes only files belonging to that attempt. Existing editorial files and records
are preserved. Avoid simultaneous first-time setup against the same database.
You can explicitly run `pnpm --filter @poetry/cms seed` to fill missing demo records;
it does not update existing records or repair an older partial translation set.

See [migrations and local data](migrations.md) before transferring a database
or uploads.

### Optional bulk demo data

Run `pnpm --filter @poetry/cms seed:bulk` from the repository root to add 100
workshops and 12 local SVG artwork assets. Start PostgreSQL first with `docker compose up -d postgres`.
This separate command does not change the small automatic startup seed.

The bulk command only accepts a local `poetry` database and refuses production.
It writes through Payload in one transaction, rolls back on failure, and removes
only uploads from the failed attempt. Repeat runs skip existing demo records,
including drafts, without updating or deleting editorial content. Do not run seeds
concurrently. Keep the `bulk-demo-v1` identifiers in demo names, slugs, and artwork
credits if you want later runs to recognize those records.

Faker supplies fixed-range workshop dates. Its version and random seeds are
pinned. Six-language editorial fixtures supply workshop prose and the curated demo
poems; they are illustrative writing, not real poems or reviewed publication
translations. Workshop translations are intentionally incomplete in some records.
One in five workshops is a draft; text lengths, artwork relationships, and past/future dates vary. Workshops
are marked `noIndex` and omit registration links. No users or credentials are seeded.

### Optional event photographs (no API key)

Run `pnpm --filter @poetry/cms seed:photos` to prepare the bulk dataset and import
12 JPEG photographs of poetry events from Wikimedia Commons' public API. This
free service requires no API key. The ordinary startup and `seed:bulk` commands remain offline
with respect to image services.

The importer searches for poetry readings, selects a repeatable sample, and
accepts only photos with an author, source page, and CC BY or CC BY-SA license.
It saves source title, photographer, license, source link, license link, and a
resizing/cropping notice in each media credit. Credits remain stored in CMS media metadata. Localized alternative text describes its illustrative purpose.

The command upgrades only seed artwork on bulk demo workshops, keeps intentionally
image-free fixtures, and preserves editor-chosen images and draft/published status.
Downloaded originals and Payload-generated sizes live in `apps/cms/media/`.
Repeat runs reuse the cached 12 media records without image API requests; do not
rename their `bulk-demo-v1-commons-photo-*` filenames. API failures stop the photo
import rather than silently changing images. Database writes share a transaction;
a failure rolls back attachments and removes only that attempt's files. Photo
imports and the preceding bulk dataset preparation are separate transactions.

Sanitized production snapshots remain a later milestone. A populated imported
database already bypasses automatic demo seeding.

## Homepage starting content

Run `pnpm seed:homepage` in `apps/cms` with PostgreSQL available. It creates the
homepage only if no saved homepage exists, using existing published records and
the six translated starting texts. It never replaces an existing homepage.
Review the initial content before using it outside the local prototype.

Invitation, support, and newsletter links initially point to the existing Poetry
Project website. Editors can replace them in the homepage sections. See
[homepage editing](homepage-editing.md) for the controls.

## Fixed informational page starting content

Run `pnpm seed:pages` in `apps/cms` to import the German and English
About, Contact, Privacy, Legal Notice, and Terms of sale & withdrawal content.
This replaces those two locales for the five globals in one transaction and preserves other translations. Existing
versions retain the previous content. The command refuses production.

The adaptations were prepared from [About](https://thepoetryproject.de/ueber-uns),
[Association](https://thepoetryproject.de/ueber-uns/der-verein),
[Contact](https://thepoetryproject.de/kontakt),
[Privacy](https://thepoetryproject.de/datenschutz), and
[Legal Notice](https://thepoetryproject.de/impressum), retrieved on 10 October 2026.
Names, organization identifiers, addresses and contact details use placeholders.
Privacy describes the starting content and needs to match the services used by the
website. Replace placeholders and review
privacy/legal content before public launch. No old photographs are imported.

## Editorial event programme

`pnpm --filter @poetry/cms seed:programme` adds twenty independently written
readings, workshops, and neighbourhood events dated July 2026–January 2027.
Each event has six-language titles, descriptions, and rich text, with longer
German and English treatments. The bodies vary headings, quotations, ordered and
unordered lists, inline images, and contact links. Covers combine original SVG
artwork and licensed Wikimedia photographs with source and license credits.
The public editorial copy uses natural titles and contains no fixture labels.

The command requires the local `poetry` database and refuses production. Photos
are cached before database writes. Events, localized media metadata, and the
initial Events-page introduction and five featured selections are written in a single transaction; failures
roll back records and remove only uploads from that attempt. Existing event slugs
are skipped, existing introduction text is preserved, and unrelated drafts and
uploads are untouched. Rerunning the command does not duplicate events.

## Bookshop catalogue

`pnpm --filter @poetry/cms seed:shop` adds the five books from the old WooCommerce
shop with their covers (from `scripts/seed/shop-covers/`) to the
[shop](shop.md). Descriptions use the published German and English texts; other
languages stay empty. Cover alt texts exist in all six languages. ISBN, page
count, publisher, and year are left empty where the sources are missing or
contradict each other.

These values are placeholders. Set the real ones in the admin before launch:

- Stock is `10` for every buyable book. The old shop tracked no stock.
- The sold-out _Berliner Anthologie_ has stock `0` and price `0`.
- Shop settings: shipping rate `4.50` €. Confirm the six-language
  small-business VAT note (§ 19 UStG) with the treasurer.

The command has the same guards as the event programme. It skips existing product
slugs, including trashed products, and writes shop settings only while they are
empty. Repeat runs add missing cover alt texts and price-note translations to the
records it created, without replacing filled values.
