# Editorial models

Model editor meaning rather than anticipated layouts. Prefer a few intentional
blocks over unrestricted visual configuration. Add a field only when editors can
understand when to use it and the frontend has a clear rendering contract.

Poems preserve one original title, language, and text, plus zero or more explicit
translation records, each with language, title, text, and translator attribution.
Never require one translation per site locale or hide the original based on the
UI locale. Keep shared facts such as dates, media relationships, and IDs
unlocalized. Localize editorial prose and editor-authored link labels where
independent translations make sense. Field labels and other editor controls are
UI, not editorial content.

Poems require an Author relationship when published; drafts may omit it. Authors
are shared writer profiles, independent of CMS user accounts. Their related poems
are shown through Payload’s native join field in the admin. Fixed shared pages do
not need a byline; events describe activities rather than authored texts.

Keep Payload’s native dashboard and cards. Organize the editorial sidebar as
Content (Articles, Events, Locations, Cities), Media (Images & Files), Administration (Users),
Pages (Home, About, Contact, Privacy, Legal Notice, Terms of sale), then Shop
(Products, Orders, Shop settings). Collection IDs, route identities and labels use the same editorial names, including `locations`.

Home, the Events page, About, Contact, Privacy, Legal Notice, and Terms of sale & withdrawal are fixed Payload globals. Event,
poet, and poem detail pages come from their collections. Articles are an MVP collection with localized native rich text, drafts, preview
and public article routes. Do not add arbitrary pages. The legacy `pages` collection remains
hidden to preserve existing records and is not used by public routing or bulk seeding.

Poems and Authors are hidden from admin navigation until v2.0; preserve their
records and existing public routes.

Cities have six required, unlocalized names (one per site locale, all in one
form) and a required country, stored as an ISO 3166-1 alpha-2 code. The admin
shows country names in the editor's interface language. Editors write cities;
anyone can read them.
See [accounts and permissions](accounts-and-permissions.md) for content access
and the planned contributor workflow.

Events contain a localized title, required description, required registration link,
required cover image, one date/time (`startDate`), required map-based location,
and required localized Lexical content. Payload’s native `slugField()` creates the
stored `slug` text field from `title`, with its standard lock and regeneration
controls. Its native `generateSlug` checkbox owns automatic generation, including
draft autosaves; there is no custom event slug hook, transliteration, or collision
suffixing. Drafts and authorized previews remain supported.
There are no event subtypes, prices, end dates, or separate SEO fields. Public
metadata derives from the title, description, and cover image. Upcoming events remain active through their date in Europe/Berlin; the time tells visitors when the event starts.

The Events page has its own global under **Pages → Events page**, separate from
the Events collection. Editors can translate its heading and introduction and
select a primary featured event and up to four additional events in display order. With no eligible selection, the nearest
upcoming published event is featured automatically. Past events, drafts, and
events without a title in the current language cannot be featured. Featured events
are shown once in a manually browsed, non-rotating feature beside the main page heading and introduction, above the remaining chronological programme. Featured events use an image and compact caption, separate from the list layout. The list uses text-only date and title columns; event images appear only in the featured section of the programme page. On compact screens, dates stack above the event text. Only events today or tomorrow receive a relative-day badge. A collapsed archive
shows past events newest first. The page supports drafts and authorized Live
Preview; missing introduction translations use UI copy in the visitor’s language,
never another language’s editorial text.

Event titles have an 80-character maximum and descriptions a 160-character maximum, enforced by Payload’s native validation with translated editor guidance. Events-page headings allow 80 characters and introductions 180. The content
editor supports headings, lists, quotes, alignment, indentation, emphasis, links,
separators, and Media images with alternative text and credits. Articles retain
their simpler toolbar. The location is a structured address/coordinate snapshot.
Its autocomplete searches saved locations by alias and address, then external map
results, deduplicating matches at the same coordinates. Focus, clicking, or clearing
shows saved bookmarks. Selecting a result fills its full address and saved alias.

The shared `Location` component provides a Payload search input with a
bookmark button in a reserved leading slot and a Leaflet map underneath. Direct Photon requests
support autocomplete after three characters and reverse lookup; no geocoder plugin
is used. Saved suggestions use a bookmark icon and a bold alias
followed by the address on one line. Clear removes the selection and map pin.
Editors can also click the map, drag the pin, or search latitude/longitude pairs.
Reverse lookup fills the address without moving the chosen coordinates. When it
fails, coordinates remain usable and the picker shows an error.

In event forms, the search field contains a leading bookmark button. A bookmark-plus
opens Payload's native Create Location drawer, with the selected address and
coordinates prefilled. A filled bookmark opens the existing Location for editing.
The drawer uses the same form as the Locations page: an optional native Alias field
above the required Location search and map. There is no inline alias editor or
automatic bookmark creation. Saving creates or updates the Location, selects its
saved address/coordinates in the event, and closes the drawer. Cancelling leaves
the event selection unchanged. Saving a Location does not publish the event; its normal draft autosave continues.

Locations store three fields: optional `alias`, optional `address`, and required
`coordinates` as Payload's native Point in longitude/latitude order. The Location
control automatically writes the point from an address result, pasted coordinates,
map click, or marker drag. There are no duplicate coordinate fields or a nested
location group in the saved Locations collection, so the creation form has no group
separator. Its search only queries the geocoder; saved bookmarks appear only in
the event selector. Coordinate-only locations are valid.

Search results are cached in IndexedDB in the editor's browser, scoped to the
signed-in user and content language. Up to 100 query responses are retained for
one day; up to 50 selected places retain frequency and recency for 90 days.
Only selection increments usage, and bookmark aliases/IDs are not cached.
Unavailable browser storage falls back to normal search without blocking editing.
On empty event search focus, at most five bookmarks/recent selections appear.
While typing, at most two strongly matching familiar places precede up to six
provider results. Text relevance comes before bookmark status, frequency and
recency; weak substring matches are not promoted. Provider order is preserved,
duplicate points appear once, and provider matches of saved Locations retain
their bookmark icon even outside the two promoted positions. Cached results appear
immediately, with Photon refreshing after three characters and a 200ms debounce.
Location creation uses cached address results but never bookmark/history promotions.

The native Location drawer has a responsive maximum width of 42rem. It uses the
same fields as the Locations page, and its save action returns to the event form.

Events keep their own location snapshots, so later bookmark edits do not automatically change other events. The same structured value is used by the field, collection, search, and public website. The development experiment has been removed.

Products are books in the shop. A product has one unlocalized title (the
edition's title) with an optional title language for `lang`/`dir`, a slug, a
required cover, an optional localized description, a price, stock, and optional
ISBN, page count, publisher and year. Products have no drafts. See [shop](shop.md).

## Naming contracts

Use Articles (`Article`, `Articles`, `getArticle`, `getArticles`), Events
(`Event`, `Events`, `getEvent`, `getEvents`), Authors, Poems, Media, Users and fixed
Pages in application code and editor labels. Workshops are event content;
poets are authors with published poems, not a separate account or collection.
Homepage author sections and relationship fields use `authors` too.

Collection slugs and block identifiers are stable data contracts. Public path
segments belong to [routing](routing.md), not UI translations. Historical
migrations retain the names of the schema they originally created.
