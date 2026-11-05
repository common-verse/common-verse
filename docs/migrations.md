# Prototype schema and local data

This is a greenfield prototype with no production database. Use Payload's
development schema push while iterating. Do not add migration chains, compatibility
fields, or renamed-field fallbacks for prototype model changes. Define the intended
schema directly and rebuild disposable feature tables when a reset is authorized.

The Locations collection is `locations`. It stores optional alias and address fields, plus one required native coordinate point. Events store their own address and point snapshots. No virtual point, duplicate latitude/longitude columns, old collection aliases, or location migrations are needed.

A feature reset must stay within its authorized scope. Users, uploads, and unrelated
editorial data remain intact. Ordinary startup never resets database tables or
Docker volumes. Back up PostgreSQL and `apps/cms/media/` together when transferring
content; cloning Git does not transfer local data.

## Poems and authors reset

Poems and authors were rebuilt; the old experimental records are not migrated.
With the CMS stopped, run `pnpm --filter @poetry/cms reset:poems` once against the
local Compose database, then start the CMS: its schema push recreates empty poem
and author tables. Afterwards `pnpm --filter @poetry/cms seed` adds the demo poems.

The reset (`apps/cms/scripts/reset-poems-authors.sql`) runs in one transaction. It
drops all poem and author records, versions and tables, and clears the homepage
hero poem plus homepage poem/author selections and edit locks that pointed at
them. Homepage sections themselves, cities, media files, users, events, products,
articles and globals stay. A homepage "Featured" section that showed a poem or
author keeps no item, so the homepage cannot be published again until an editor
picks a new one. It also runs on an empty database. Running it again
deletes the rebuilt poems and authors too.

Verify persistence and queries against PostgreSQL, using rolled-back transactions
for temporary verification records. See [testing](testing.md) and
[development](development.md).
