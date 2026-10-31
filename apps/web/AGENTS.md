# Agents

This app renders the public website with Astro and Svelte 5. Apply the
[root guide](../../AGENTS.md) alongside these rules.

## Rendering and data

- Use Astro for pages, layouts, route handling, and server-side data fetching;
  use Svelte for reusable UI and interactive components, without SvelteKit loaders.
- Svelte components can render from Astro without browser JavaScript. Add a
  `client:*` directive only when browser events or state require hydration;
  preserve useful server-rendered HTML and avoid `client:only`.
- Use the `svelte-code-writer` skill for `.svelte` and `.svelte.ts/.js` work.
- Keep CMS requests in `src/lib/cms.ts`. Public pages use published content;
  draft requests go through the existing authorized preview endpoints.
  Preserve the distinction between missing records and failed requests.
- Keep web runtime code independent of CMS application imports. Payload
  relationships can be IDs, populated objects, or missing values.

## Locales, routes, and previews

- Validate route locales with `isLocale`; use `localizedPath` and central locale
  metadata from `@poetry/i18n`, rather than constructing locale URLs or direction
  checks in components. `src/middleware.ts` resolves canonical public paths.
- Before changing URL conventions, language switching, or fallback behavior, read
  [translations](../../docs/translations.md) and [routing](../../docs/routing.md).
- Edit UI messages in `messages/{locale}.json` and pass the explicit locale to
  Paraglide messages during rendering. Do not mutate a global locale per request
  or edit generated files in `src/paraglide`.
- Missing editorial translations must remain missing. Only About, Contact,
  Privacy, Legal Notice, and Terms fall back to a complete English page. Preserve poem
  originals and their optional explicit translations independently of UI locale.
- Set `lang` and `dir` on content whose language differs from the surrounding UI.
  Reuse `contentDirection` for editorial languages outside the configured locales.
- Reuse `BaseLayout.astro` for metadata, canonical URLs, alternates, and preview
  behavior. Alternates must represent pages that can actually be served.
- Verify preview secrets at runtime with `astro:env/server` before fetching drafts.
  Preserve preview `noindex`, `no-store`, and `no-referrer` behavior, and keep the
  editor's banner language independent of the public content locale. Setup details
  are in [draft previews](../../docs/previews.md).

## UI and styling

- Reuse `src/lib/components/ui` and `src/lib/components/sections` before adding
  components. Import UI primitives from their folder barrels. Read
  [UI components](../../docs/ui-components.md) for project APIs and composition.
- Use `shadcn-svelte` for component work and `web-accessibility` for interaction
  behavior. Reuse the project's Bits UI primitives for managed focus.
- Theme tokens live in `src/styles/token.css`, imported by `global.css`.
  Use semantic tokens instead of literal component colors or separate dark-mode
  overrides. Read [design tokens](../../docs/design-tokens.md) before theme changes.
- Use logical CSS properties for directional layouts. Component heading levels
  describe document structure independently of their visual size.
- Reuse `safeHref` for editor-authored URLs and the existing media helpers for
  images and credits. Do not render unchecked editorial links directly.

## Checking web changes

- Use `pnpm --filter @poetry/web check` for web code changes and
  `pnpm --filter @poetry/web test <file>` for affected logic tests.
  Use `pnpm --filter @poetry/web build` when changing rendering or build behavior.
  Run component CLI commands from `apps/web` to use its `components.json`.
- Keep logic tests beside the code in `src/lib`; browser tests and the mock CMS
  fixtures live at the root in `tests/e2e` and `tests/fixtures`.
  Update fixtures when changing the CMS response contract.
- For changed layouts or interactions, check German or English and Arabic or
  Persian, with a narrow viewport and keyboard input for changed controls.
  For theme changes, also verify Light, Dark, System, and rendering without JavaScript.
- Run affected browser tests from the root with
  `pnpm test:e2e tests/e2e/<file>.spec.ts`; stop development servers first.
  The suite starts a built web server and mock CMS, not real PostgreSQL.
