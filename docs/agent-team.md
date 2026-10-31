# Agent team

How a main agent (the manager) splits feature work across sub-agents. The user
approves the spec and design before any code is written.

## Roles

| Role             | Delivers                                                                   | Skills                                                                                                                 |
| ---------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Spec             | User stories with testable acceptance criteria                             | `user-stories`                                                                                                         |
| UX/UI designer   | Flow, every screen state, layout from existing components, a11y per screen | `frontend-design`, `apple-design`, `web-design-guidelines`, `web-accessibility`                                        |
| Manager (main)   | Briefs, shared contract, merge, own verification                           | `verification-before-completion`, `requesting-code-review`                                                             |
| CMS developer    | Code and tests in `apps/cms`                                               | `ponytail`, `payload`, `stripe-best-practices`, `vitest`, `receiving-code-review`, `verification-before-completion`    |
| Web developer    | Code and tests in `apps/web`                                               | `ponytail`, `svelte-code-writer`, `shadcn-svelte`, `vitest`, `receiving-code-review`, `verification-before-completion` |
| Security review  | Money, access, keys                                                        | `security-audit`, `stripe-best-practices`                                                                              |
| Code review      | Bugs, repo rules, simplicity                                               | `requesting-code-review` (its `code-reviewer.md` template)                                                             |
| Design + a11y QA | Built flow against the design, WCAG 2.2, RTL, 375 px                       | `web-accessibility`, `web-design-guidelines`                                                                           |
| QA               | Every acceptance criterion on the real CMS with Stripe test mode           | `test-scenarios`, `playwright-cli`, `verification-before-completion`                                                   |

- `ponytail` lives in the user's `~/.claude/skills`, not in `.agents/skills`, so
  Codex and other contributors do not have it.
- `stripe-best-practices` yields to the project overrides in [skills](skills.md):
  PaymentIntents with the Payment Element and the pinned SDK.
- There is no Astro skill: the web developer looks up Astro APIs with the
  `astro-docs` MCP server (`search_astro_docs`).
- The designer takes product specifics from the brief and the topic docs, for
  example the checkout flow and legal duties in [shop](shop.md).
- QA runs the [real stack](testing.md#real-stack) checks, not only the mock CMS.

## Gates

1. Spec and design are approved by the user before coding starts.
2. Developers run `pnpm check` and the affected tests before reporting done.
3. Reviewers get the diff and the acceptance criteria, never the developer's
   summary.
4. Failures go back to the developer who wrote the code.
5. The manager re-runs the checks before reporting to the user. Commits, pushes,
   and merge requests wait for the user's go.

## Brief checklist

Every brief to a sub-agent names:

1. The goal and the acceptance criteria it must meet.
2. The files or area in scope, and what is out of scope.
3. The docs and skills to read first.
4. The shared contract it must keep (types in `@poetry/types`, CMS responses,
   message keys).
5. What to report back (format below).

## Report format

1. **Done**: what now works, with the command or URL that shows it.
2. **Checks**: commands run and their result.
3. **Not checked**: anything not verified, and why.
4. **Open**: decisions for the manager or the user, at most five.
