# Documentation

Read the topic relevant to your task. These documents hold project decisions and
procedures; agent instructions live in the [root](../AGENTS.md),
[web](../apps/web/AGENTS.md), and [CMS](../apps/cms/AGENTS.md) guides.

## Architecture and content

- [Architecture](architecture.md) — Framework boundaries, shared packages, and implementation scope.
- [Editorial models](editorial-models.md) — Collections, fixed globals, poem originals, and naming contracts.
- [Accounts and permissions](accounts-and-permissions.md) — Current admin/editor access and the planned contributor workflow.
- [Homepage editing](homepage-editing.md) — Homepage controls, section selection, ordering, and visibility.
- [Shop](shop.md) — Book products, orders, guest checkout with Stripe, and known limits.

## Languages and public pages

- [Translations](translations.md) — Separate UI/content catalogs, language choices, fallback, and writing direction.
- [Public routing](routing.md) — Locale URLs, slugs, canonical paths, redirects, and language switching.
- [Draft previews](previews.md) — Live Preview setup, authorization, language behavior, and response protections.
- [Metadata and sharing](metadata.md) — Search indexing, canonical/alternate URLs, social cards, and structured data.

## UI

- [UI components](ui-components.md) — Component APIs, composition, accessibility, RTL, and author portraits.
- [Design tokens](design-tokens.md) — Color, typography, elevation, and Light/Dark/System preferences.

## Development and maintenance

- [Development startup](development.md) — Local startup, ports, dependencies, and platform support.
- [Configuration and secrets](configuration.md) — Environment variables, secret lifecycle, and documentation-tool connections.
- [Demo data](demo-data.md) — Local seeds, optional event photos, and homepage/fixed-page starting content.
- [Migrations and local data](migrations.md) — Existing database upgrades, schema changes, and backups.
- [Testing and verification](testing.md) — Checks by change type, browser setup, and limits of mock-CMS tests.
- [Deployment](deployment.md) — Server, dev environment, images, CI deploy key, and access.
- [Skills](skills.md) — Upstream skill installation, updates, and project overrides.
- [Agent team](agent-team.md) — Sub-agent roles and skills, GitHub board workflow, approval gates, briefs, and reports.

## Research and historical records

These record past evaluations, not current implementation instructions.

- [Architecture milestone review](architecture-review.md) — Original vertical-slice acceptance and recorded checks.
- [UI library research](ui-library-research.md) — Dated library comparison and alternatives to the selected UI stack.
