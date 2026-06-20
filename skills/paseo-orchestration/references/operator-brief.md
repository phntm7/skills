# The operator brief

The operator brief is a chat message that carries every repo-specific fact the orchestrator needs. The orchestrator forwards the per-agent contract into spawns, reads only the task files the brief points to, and never invents repo facts.

Use this reference with [SKILL.md](../SKILL.md) for fixed Paseo mechanics and [agent-prompts.md](agent-prompts.md) for thin spawn skeletons. Repo facts come from the brief or the files it names; fixed Paseo mechanics come from the skill.

## What a complete brief provides

A complete brief supplies these fields. The section names below mirror the example, but the fields are generic; use the operator's actual labels.

- **Where task details live**: path or glob for task files, plus how to read status, build instructions, acceptance criteria, and blockers. Also name the authority for what is already built when task files and roadmap/status disagree. Used for dispatch scoping, spawn task pointers, skip decisions, and acceptance gating.
- **Scope**: exact tasks to implement and exact tasks to skip. Used to decide which agents to spawn and which tasks are already out of scope.
- **Order, waves, and dependencies**: which tasks can run now, which wait for another PR to merge, and any phase boundaries. Used for dispatch timing and dependency-safe merge flow.
- **Merge-serialization groups**: conflict-prone shared files or subsystems and the tasks that touch them. Used to allow parallel development while merging those PRs one at a time.
- **Per-agent contract to forward verbatim**: branch naming, commit rules, the verify command that defines done, dependency/version rules, config-sync rules, and repo-specific gotchas. Used directly in spawn assembly; do not summarize or reinterpret it.
- **Required skills**: any skills spawned agents must verify and follow before work starts. Used in implementer and reviewer spawn prompts.
- **Quota-check command**: the environment-specific command for checking agent limits. Used at phase end and when scheduling quota recovery.

## Ask, don't guess

If any dispatch-critical fact is missing or ambiguous, ask the operator before dispatching agents:

- scope: what to implement and what to skip;
- where task details live and how to read status, acceptance criteria, and blockers;
- task order, waves, dependencies, or merge-serialization groups;
- branch, commit, verify, dependency, or config-sync conventions;
- required skills.

Never assume a repo's structure, commands, or status semantics. The fixed Paseo mechanics in [SKILL.md](../SKILL.md) are applied without asking because they are invariant orchestration rules, not repo facts.

## Reading task files generically

The brief names the task path or glob and the sections or fields to read. Thread those exact instructions into the spawn's task pointer so each agent knows where to find its build details, acceptance criteria, status, and blockers.

The example below uses `Status:` plus `## What to build`, `## Acceptance criteria`, and `## Blocked by`. Other repos may use different names, frontmatter, issue trackers, or status values. Use whatever the brief specifies. If the brief does not specify sections or status semantics, ask before dispatching.

## Example brief

The fenced brief below is one concrete example to learn the shape from, not universal truth. Adapt the field model to the operator's actual brief.

```markdown
# Orchestrator brief — property-parsing-pt implementation

## Where task details live
- Per task: `.scratch/<feature>/issues/<NN>-*.md` -> read `## What to build` + `## Acceptance criteria` (= definition of done) + `## Blocked by`.
- Authority on what's already built: `docs/implementation-roadmap-2026-06-20.md`. The roadmap wins over any issue's `Status:` line.
- `Status:` line: `done` = skip; `ready-for-agent` = implement.

## In scope (spawn agents for these)
- `production-hardening/issues/` 01-10 (all `ready-for-agent`, no HITL).
- `dashboard/issues/` 08, 09, 10, 11, 12.

## Skip - already done
- `dashboard/issues/01-07` (Phase 1 shipped).
- `unattended-production-readiness/issues/01-06`.
- `lisbon-scale-test/*`, `proxy-and-geocoding-redesign/*`.

## Order (only 2 real dependencies)
- Wave 1 - all parallel: PH-01, PH-03, PH-04, PH-05, PH-06, PH-07, PH-08, PH-09, PH-10, DASH-08, DASH-09, DASH-11, DASH-12.
- Wave 2 - after their dep merges: PH-02 (needs PH-01); DASH-10 (needs PH-08).

## Merge-serialize these (parallel dev is fine; integrate one-at-a-time to avoid conflicts)
- `compose.yml` / `.github/workflows/deploy.yml`: PH-04, PH-05, PH-10.
- `packages/db/src/repository.ts` + new migrations: PH-01, PH-02, PH-08 (give migrations distinct sequence numbers).
- Worker runtime + lane-lease code: PH-03, PH-04, PH-09.

## Per-agent contract (include in every spawn)
- Implement the issue to its `## Acceptance criteria`; honor `## Blocked by`.
- Branch `feature/<slug>` - full git-flow prefix, never `feat/`. One branch per issue.
- Conventional Commits. commit-msg hook caps header <=100 / body lines <=100 -> use `printf '%s' "$MSG" | git commit -F -` for multi-line bodies.
- Hooks auto-run (pre-commit `ultracite fix`, pre-push `pnpm verify:fast`).
- Definition of done before handoff: `pnpm verify` green (use `pnpm ai:*` variants for parseable output).
- Rules: no barrel files (import from defining module); latest dep versions via `pnpm add`; keep configs in sync per `AGENTS.md` when touching compose/CI/package surfaces.
```

## Phase-end quota check

After all PRs in a phase merge, run the operator-provided quota-check command. The path is environment-specific, for example `/path/to/check-omniroute-limits`; do not invent it when the brief omits it.

Report these values after the command runs:

- codex session;
- codex weekly;
- claude session;
- claude weekly.

Codex session quota resets on a rolling 5h window. If a needed agent hits quota mid-work, schedule a retry via `schedule_prompt` after the reset time. Include the blocked PR or task, the quota reset time, and instructions to resume from the latest Paseo agent state.
