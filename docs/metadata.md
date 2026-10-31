# Metadata and sharing

Each indexable page needs a stable localized canonical URL, useful title and
description, alternates for actually routable language versions, and `x-default`
where appropriate. Keep document language and direction aligned with the route.
Support editor-provided Open Graph images and suitable Twitter card metadata.
Preview and intentionally hidden content must emit `noindex,nofollow`.

Add structured data only when enough accurate fields exist; do not invent missing
facts. Automated social-image generation remains deferred until the base metadata
workflow is proven.

The fixed-page meta-description is for search results and link previews, not the
visible article text. Editors can supply it separately from the page content.

Event metadata derives from the title, description, and cover image. Events have
no separate SEO fields. Their structured data uses the date/time and location;
prices and end dates are not part of the event model.

Book pages emit schema.org `Book` data from the product fields that exist, with
an `Offer` only when a price is set. Cart, checkout, and order confirmation pages
are personal: they emit `noindex,nofollow`, no language alternates, and
`Cache-Control: no-store`.

Use `apps/web/src/layouts/BaseLayout.astro` for document metadata. Resolve URLs
through `@poetry/i18n` as described in [routing](routing.md).
See [draft previews](previews.md) for preview authorization and response headers.
