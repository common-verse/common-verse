# Skills

Upstream skills live in `.agents/skills/`. Their descriptions identify when to use
them. Keep downloaded skills unchanged; maintain project-specific rules in
[`AGENTS.md`](../AGENTS.md) and [topic documentation](README.md).

## Project overrides

Project requirements take precedence over upstream defaults. In Codex, use managed
worktree tools when a new worktree is needed; the `conventional-git` skill's
`.claude/worktrees/` location is not a project requirement.

The shop uses PaymentIntents with the Payment Element because the Payload
ecommerce plugin's Stripe adapter requires them; `stripe-best-practices`'
preference for Checkout Sessions and its latest-SDK default need an architecture
decision first (see [shop](shop.md)). Review and plan paths named by
`requesting-code-review`, such as `docs/superpowers/plans/`, are not project
requirements.

## Installation and updates

Install selected external skills from the repository root:

```sh
npx skills add <owner/repo> --skill <name> -a codex -y
```

If `npx` stops with `EBADDEVENGINES` because the local Node patch version differs
from `devEngines`, run the same command with `pnpm dlx skills` instead.

Do not use `-g` or install entire skill bundles. Review selected upstream updates:

```sh
npx skills update <name> -p
```

Commit `.agents/skills/` and `skills-lock.json` together. Do not edit the lockfile
by hand: it records sources and hashes, while committed skill files preserve the
reviewed contents. Check skill discovery, lockfile consistency, links, and
formatting after changes.
