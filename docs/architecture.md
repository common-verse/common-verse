# Architecture

Prefer a direct implementation inside the owning layer. Add shared packages only
when they remove demonstrated duplication. Do not add another public frontend,
CMS, database, commerce backend, or general-purpose UI library without a concrete
missing capability and an architecture review. Use Payload migrations rather than
hand-written application tables.

Astro owns public pages and locale URLs, layouts, metadata, server
rendering, and Payload integration. Render useful HTML on the server. Reuse Svelte
components directly from Astro, including noninteractive components; hydrate only
components that need browser state or events. Avoid `client:only`, broad
`client:load`, and SPA routing.

Validate route parameters with `@poetry/i18n`. Fetch published Payload content
server-side. Preview URLs may request drafts only after verifying the preview
secret. Consider metadata, locale alternates, direction, empty/error behavior, and
keyboard behavior when adding pages. The bookshop uses Payload's ecommerce plugin
with Stripe and guest checkout; see [shop](shop.md).

## Shared contracts

The public site uses Astro and Svelte; Next.js and React run the Payload CMS.
`@poetry/i18n` shares locale metadata and route identities between them.
`@poetry/types` defines the content interfaces consumed by the website;
`@poetry/cms-ui` contains custom editor UI messages.

Editorial schemas and access controls live in Payload. PostgreSQL is configured
through its database adapter. See [editorial models](editorial-models.md),
[migrations](migrations.md), and [draft previews](previews.md) for their contracts.

UI uses project-owned shadcn-svelte components and Bits UI, with semantic theme
tokens. See [UI components](ui-components.md) and [design tokens](design-tokens.md).
Do not add a second general-purpose component framework.
