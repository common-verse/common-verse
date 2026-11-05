# Agents

This app runs Payload CMS on Next.js with React admin components and PostgreSQL.
Apply the [root guide](../../AGENTS.md) alongside these rules.

## Editorial models and access

- Use the `payload` skill and existing model, access, and preview helpers.
  Extend Payload's native controls before replacing them.
- Home and the five informational pages use globals, not arbitrary page records.
  Legacy Pages are hidden from navigation; preserve their records and
  existing public behavior.
- Preserve poem originals, optional per-locale translations, and translator credits.
  Do not require a translation for every site locale or turn UI labels into content.
- Before changing roles or account access, read
  [accounts and permissions](../../docs/accounts-and-permissions.md).
  Reuse `src/collections/access.ts`; preserve the last-administrator safeguards.
- Existing secret-authorized preview and public-global endpoints deliberately
  use `overrideAccess: true`; preserve their authorization and publication checks.
  Do not copy that bypass into user-authorized operations.
- Follow [migration guidance](../../docs/migrations.md) for persisted schema changes;
  preserve historical migration names and existing stored identifiers.

## Languages and generated files

- Use `label()` and `message()` from `@poetry/cms-ui` for custom editor UI.
  Edit that package's JSON catalogs; retain Payload's built-in translation packs.
  The editor's interface language is independent of the content being edited.
- Keep editorial fallback disabled. Reuse `contentFields` and native field controls
  so validation, editing behavior, and each field's content direction remain intact.
- Regenerate Payload types after schema changes when needed; do not hand-edit
  `src/payload-types.ts` or the generated admin import map.

## Verification

- Use `pnpm --filter @poetry/cms check` for CMS code changes and
  `pnpm --filter @poetry/cms test <file>` for affected model/helper tests.
  Use `pnpm --filter @poetry/cms build` for Next.js integration or build changes.
- Verify migrations and changes to database queries or transaction behavior against
  real PostgreSQL. Run the access/preview tests when changing their protections;
  check signed-in admin workflows when changing editor behavior.
- Seeds live in `scripts/seed`, separate from runtime source. Preserve environment
  guards, transactional rollback, and repeat-run behavior when changing them.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
