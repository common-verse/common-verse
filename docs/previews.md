# Draft previews

Configure the same `PREVIEW_SECRET` in the CMS and Astro runtime, and correct
`PUBLIC_SITE_URL` / `PUBLIC_CMS_URL` origins. Open Live Preview and select a mobile,
tablet, desktop, or responsive width. The preview refreshes after autosave, draft
save, and publish. It verifies the CMS message origin and preserves scroll position.
The draft-preview banner must follow the editor's Payload interface language,
independently of the content language being previewed. Direct preview links without
an editor language use English for the banner. The recorded signed-in language checks are in
[translations](translations.md#verification-and-remaining-review).

For local preview, use the same hostname for both applications (for example,
`localhost:3001` and `localhost:4321`). Chromium's local-network protection can
block an iframe when one application uses `127.0.0.1` and the other uses `localhost`.

Save a draft to review changes privately; publish to make them public. The editor,
mutations, and version history require authentication. Anonymous homepage reads
use the published global and exclude populated draft relationships. Preview
requests require the preview secret, use `no-store`, suppress referrers, and emit
`noindex,nofollow`. Treat preview links as credentials, as documented in
[configuration and secrets](configuration.md).

## Language and content contracts

The authorized preview URL carries the editor's interface language.
The draft banner reads the CMS catalog and declares that language and direction.
The website UI follows the preview's content route. Unsupported editor languages,
including Kurmanji, resolve to English.

Collection draft reads use the existing secret-authorized `/preview` endpoints;
fixed globals expose separate `/public` and `/preview` endpoints. Never bypass
publication or secret checks when extending these paths. Routes must use the
shared [public URL mappings](routing.md). The `/preview` endpoints find a record
by `slug` in the slot of the requested locale (`slugField`), or by `id`; a poem
preview finds the poem by its slug, then loads its other versions by ID.
Events, poems and authors use these locale slots. A wrong preview secret
returns 401; without one, drafts stay hidden (404).

Use [testing guidance](testing.md) for authorization, live-preview, and
signed-in editor checks.

The Events listing also supports preview via **Pages → Events page**. Its localized
heading, introduction, and chosen upcoming event use the same protected preview
flow; the listing itself continues to show published event records.
