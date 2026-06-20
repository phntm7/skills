# Repo conventions to capture

At session start, learn the target repo's operating facts from `AGENTS.md`, `CONTEXT.md`, `README.md`, and the codebase. Thread the captured facts into every implementer prompt, reviewer prompt, and fix-cycle prompt that uses the templates in [agent-prompts.md](agent-prompts.md).

Never hardcode one repo's facts as universal. Capture the local rule, state where it applies, and tell agents exactly how to adapt their command, branch, migration, commit, and secret-handling behavior for this repo.

Keep the captured facts in a compact session note and paste only the relevant facts into each prompt:

```text
Repo facts for this task:
- CI:
- Test/typecheck/lint:
- Special test modes:
- Migration scheme:
- Branch naming:
- Commit convention:
- Never commit:
- Secret discipline:
```

## Capture checklist

- **CI presence** — Capture whether the repo has GitHub Actions CI. Use it in merge checks and reviewer instructions. If no GitHub Actions CI exists, `statusCheckRollup` is always `[]`; treat that as normal and require implementers/reviewers to run the repo test command themselves with force, not from cache.
- **Test/typecheck/lint command** — Capture the single command agents run before declaring done. Use it in implementer, reviewer, and fix-cycle prompts; reviewers run it independently with force, not from cache.
- **Special test modes** — Capture environment variables, service requirements, and alternate commands for database, integration, browser, or external-service tests. Use them when an issue touches that subsystem.
- **Migration scheme** — Capture the migration numbering convention, how parallel branches choose a safe next migration number, and which generated metadata file commonly collides during conflict resolution. Use it in implementer prompts for schema work and in merge-conflict fix cycles.
- **Branch naming convention** — Capture the exact branch prefix/style the repo expects. Use it when choosing `worktreeName`, branch names, PR titles, and fix-cycle branches.
- **Commit convention** — Capture the required commit message format. Use it in implementer and fix-cycle prompts before agents push PR branches.
- **Untracked-in-worktree files** — Capture local files that appear in worktrees but must never be committed. Use it in every prompt that asks an agent to inspect or commit changes.
- **Secret discipline list** — Capture repo-specific secret-bearing artifacts and include the standing rule: never persist cookies, proxy credentials, solver tokens, request headers, or secret-bearing URLs anywhere in the codebase. Use it in implementer, reviewer, and fix-cycle prompts whenever scraping, auth, proxying, or request capture is in scope.

## Example: property-parsing-pt

Use this as a concrete instance to adapt, not as universal guidance for other repos:

```text
- No GitHub Actions CI — `statusCheckRollup` is always `[]`, this is normal
- pnpm monorepo + Turborepo; test command: `pnpm turbo run test typecheck lint`
- For db tests: `REQUIRE_POSTGIS=1 pnpm turbo run test --force`
- Migrations: drizzle, numbered sequentially (0017, 0018, ...). Parallel branches pick the next free number after checking what exists; journal collision = merge conflict on `_journal.json`
- Branch naming: full git-flow (`feature/`, `bugfix/`) — never abbreviate to `feat/`
- Commits: Conventional Commits (`feat:`, `fix:`, `refactor:`, etc.)
- `paseo.json` is always untracked in worktrees — do not commit it
- Secret discipline: never persist cookies, proxy credentials, solver tokens, request headers, or secret-bearing URLs anywhere in the codebase
```

## Phase-end quota check

After each phase completes, meaning all PRs in that phase are merged, run the operator's quota-check command. The path is environment-specific; use the operator-provided command, for example:

```bash
/path/to/check-omniroute-limits
```

Report these four values before dispatching the next phase:

- codex session
- codex weekly
- claude session
- claude weekly

Watch codex session usage closely when it approaches 100%; it resets on a rolling 5h window. If a needed implementer or reviewer hits quota mid-work, do not spin in place. Schedule the retry after the reset time with `schedule_prompt`, include the blocked task or PR number, and resume from the latest Paseo agent state when the scheduled prompt fires.
