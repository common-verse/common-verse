# Agent team

How a main agent (the manager) splits feature work across sub-agents and tracks
it on GitHub. The user approves the spec and design before any code is written.

## Roles

| Role            | Delivers                                                              | Skills                                                                          |
| --------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Manager (main)  | Issues, briefs, shared contract, merge, own verification              | `conventional-git`, `verification-before-completion`, `requesting-code-review`  |
| Spec            | User stories with testable acceptance criteria                        | `user-stories`                                                                  |
| Designer        | Flow, every screen state, layout from existing components, a11y       | `frontend-design`, `apple-design`, `web-design-guidelines`, `web-accessibility` |
| Developer       | Code and tests in one app (`apps/cms` or `apps/web`)                  | per app, see below                                                              |
| Code review     | Bugs, repo rules, simplicity                                          | `requesting-code-review` (its `code-reviewer.md` template)                      |
| Security review | Access, private data, secrets; only when the feature touches them     | `security-audit`                                                                |
| Design QA       | Built flow against the design, WCAG 2.2, RTL, 375 px                  | `web-accessibility`, `web-design-guidelines`                                    |
| QA              | Every acceptance criterion on the [real stack](testing.md#real-stack) | `test-scenarios`, `playwright-cli`, `verification-before-completion`            |

Developer skills per app, plus `ponytail`, `vitest`, `receiving-code-review` and
`verification-before-completion` for both:

- `apps/cms`: `payload`.
- `apps/web`: `svelte-code-writer`, `shadcn-svelte`; Astro APIs come from the
  `astro-docs` MCP server (`search_astro_docs`), there is no Astro skill.

Feature docs add their own skills and checks, for example [shop](shop.md#agent-team).
`ponytail` lives in the user's `~/.claude/skills`, so Codex and other contributors
do not have it.

## GitHub workflow

Work is tracked on the project board of `common-verse/common-verse`.

1. The manager creates a milestone per deliverable and one issue per reviewable
   change; the spec refines their acceptance criteria.
2. Cards move Backlog → Ready → In Progress → In Review → Done. Whoever starts or
   hands over a step moves the card.
3. Branch from `origin/dev`: `<type>/cv-<issue>-<slug>`. Commits:
   `<type>(cv-<issue>): <summary>` (see `conventional-git`).
4. One pull request per issue into `dev`, with `Closes #<issue>` in the body.

## Gates

1. Spec and design are approved by the user before coding starts.
2. Developers run `pnpm check` and the affected tests before reporting done.
3. Reviewers get the diff and the acceptance criteria, never the developer's
   summary.
4. Failures go back to the developer who wrote the code.
5. The manager re-runs the checks before reporting to the user. Commits, pushes,
   and pull requests wait for the user's go.

## Brief checklist

Every brief names:

1. The issue, its goal and acceptance criteria.
2. The files or area in scope, and what is out of scope.
3. The docs and skills to read first.
4. The shared contract to keep (types in `@poetry/types`, CMS responses, message
   keys).
5. The report format below.

## Report format

1. **Done**: what now works, with the command or URL that shows it.
2. **Checks**: commands run and their result.
3. **Not checked**: anything not verified, and why.
4. **Open**: decisions for the manager or the user, at most five.
