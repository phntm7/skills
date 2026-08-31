---
name: deep-code-review
description: >
  Use when a PR, large feature, refactor, or whole codebase needs a rigorous
  review; it routes dynamic checks — correctness, architecture, simplicity,
  naming, tests, security, performance, AI-slop, adversarial — and returns
  prioritized, verified findings. Also triggers on "hostile review",
  "adversarial review", "tear this apart", "security review of this PR",
  "find the slop", "review the codebase", or "what did the AI over-engineer".
---

# Deep Code Review

A rigorous, full-scale review for substantial changes — large refactors, new features, medium/large PRs, or a whole codebase. The job is to find what matters and say it clearly: correctness bugs, security holes, structural regressions, AI-generated slop, useless tests, and missed simplifications, without drowning the signal in nits.

This is a review-only task. Investigate and report — the output is findings, not code changes. Do not modify the code under review. Delivering or posting the findings (to a PR or anywhere else) is the caller's responsibility.

## Two roles

Decide once, at the start:

- **Reviewer (default).** You were spawned to review — you have an assigned scope, or you cannot spawn dedicated reviewer agents. Skip the [orchestrator playbook](#orchestrator-playbook). You do the whole review yourself on your scope.
- **Orchestrator.** You are the top-level agent, you *can* spawn dedicated reviewer agents, **and** the review is big (> ~20 files or multiple subsystems, or a whole codebase) or the user asked you to run one. Partition per the [orchestrator playbook](#orchestrator-playbook), spawn reviewers, and synthesize yourself. You never write findings from delegated summaries — but synthesis, adjudication, and the verdict are yours alone.

When in doubt, you are the Reviewer.

## When to use

- A large refactor or feature needs a deep review before merge.
- "Review PR `<url>` in depth" / "do a full review of this branch" / "review the codebase".
- A hostile/adversarial pass, a security review, or a strict slop/maintainability audit is wanted.

Not for trivial diffs (a few lines, a config bump, a typo) — review those inline.

## The six steps

```
1. Scope      → resolve the change set (or tree), read past the diff
2. Route      → pick which checks run, from the diff's risk profile
3. Review     → apply every routed check yourself; scouts fetch facts only
4. Verify     → prove or drop every Blocker/Major before reporting it
5. Synthesize → merge, dedupe, adjudicate, prioritize
6. Deliver    → prioritized findings + a verdict against the approval bar
```

### 1. Scope

Resolve what to review, in order of preference:

- **PR URL or number** — read its description and full diff with whatever PR tooling the environment provides. On a large PR, list changed files first, then read slices. Read the PR discussion only **after** your independent pass (step 3) — fresh eyes first.
- **Branch** — `git diff <base>...HEAD` against the merge base (default `main`/`master`; confirm if ambiguous).
- **Explicit range** — whatever the user names.
- **Tree scope** — "review the codebase / this module": the scope is a file tree, not a diff. Diff-only rules below don't apply; everything is "pre-existing", so severity comes from impact alone, and the slop and architecture checks carry extra weight.

Then **read past the diff**. A diff-only review misses integration bugs:

- Read each changed file, not just the hunks.
- For changed exported symbols, find the callers (find-references if available, else project-wide search) and check they still hold.
- Read the immediate collaborators of changed modules.

**Classify the change** — this drives step 2: size, areas/modules, languages, and **risk surfaces** (auth, money, persistence/migrations, concurrency, input parsing, secrets, permissions, public contracts, anything destructive). Classify by **risk, not size** — Heartbleed was 2 lines, and a refactor is HIGH risk until proven LOW.

### 2. Route the checks

You decide which checks run — no configuration, no fixed list. Weight by what the change actually touches:

| Check | Reference | Runs when |
|---|---|---|
| Correctness & edge cases | [correctness-and-risk.md](references/correctness-and-risk.md) | always |
| Readability & naming | [readability-naming.md](references/readability-naming.md) | always |
| Slop & over-engineering | [slop.md](references/slop.md) | always |
| Tests & coverage | [correctness-and-risk.md](references/correctness-and-risk.md) | the diff touches logic (not pure docs/config) |
| Architecture & depth | [architecture.md](references/architecture.md) | module shape, ownership, or seams change; or > ~5 files |
| Security | [security.md](references/security.md) | a risk surface is touched — including refactors of one |
| Adversarial | [adversarial.md](references/adversarial.md) | high-risk surface; the user asked for a hostile pass; author confidence looks unearned; or two other checks disagree |
| Performance & orchestration | [correctness-and-risk.md](references/correctness-and-risk.md) | hot paths, loops over I/O, data-volume code |

Load a check's reference when you apply it. The full review standards — flag list, remedies, approval bar, tone — live in [review-rubric.md](references/review-rubric.md); load it before reviewing.

If the caller requested specific modes (e.g. only `security` + `adversarial`), those are the routed set — but when the diff plainly warrants an unrequested check (it touches auth and security wasn't asked for), apply it and say so.

**Vocabulary boundary:** the architecture check uses the precise terms in `architecture.md` exactly — *module, interface, implementation, depth, deep, shallow, seam, adapter, leverage, locality*. Every other check uses plain language.

### 3. Review — the judgment is yours

You — the model reading this skill — apply every routed check yourself, on code you read yourself. Sub-agents, where available, are **scouts**: they may enumerate callers, list changed files, or fetch surrounding context. They never apply a check, never assign a severity, never write a finding. A review whose findings were produced by a cheaper delegate is not your review.

Read everything before forming any opinion:

- Read all relevant files, commits, or plan content fully.
- Identify the stated intent vs. what the code actually does.
- Note any TODOs, skipped error handling, or assumptions baked into the logic.

Then work the routed checks. Scope discipline while reviewing a diff:

- Focus on new code added in the PR (lines starting with `+`), and on issues introduced by this change. Deleted code serves as reference context — don't comment on it.
- Avoid commenting on correct code or unchanged code. A finding's anchor may sit outside the changed lines only when the required repair belongs there.
- Favor precision over recall: report only defects that are likely real in the changed code and its reachable context. A false positive costs reviewer trust.

**Determining what to flag** (severity-asymmetric confidence):

- For clear bugs and security issues, be thorough. Do not skip a genuine problem just because the trigger scenario is narrow.
- For lower-severity concerns, be certain before flagging. If you cannot confidently explain why something is a problem with a concrete scenario, do not flag it.
- Each issue must be discrete and actionable, not a vague concern about the codebase in general.
- Do not speculate that a change might break other code unless you can identify the specific affected code path.
- Do not flag intentional design choices or stylistic preferences unless they introduce a clear defect.
- When confidence is limited but the potential impact is high (data loss, security), report it with an explicit note on what remains uncertain. Otherwise, prefer not reporting over guessing.
- An empty findings list is an acceptable outcome. Never invent issues to fill a review.

### 4. Verify

Before a **Blocker** or **Major** finding may be reported, run it through [verification.md](references/verification.md): restate the claim, trace it end-to-end, argue against it (and against dismissing it), and drop what fails — except protected subjects, which are never dropped on doubt. Minor/Nit findings skip the machinery.

Never present unfinished research: if a finding depends on "whether the backend handles X", go read the backend. Targeted read-only checks are allowed — the specific test covering the path, a scoped typecheck — never mutating commands, never a blanket project-wide pipeline.

### 5. Synthesize

Yours alone — never delegated:

- **Merge & dedupe** — the same issue found by multiple checks at one location becomes one finding.
- **Adjudicate conflicts** — checks disagree ("extract an abstraction" vs "delete this code"): settle with the deletion test (`architecture.md`), the simplicity mindsets, and the approval bar. Record the call.
- **Group only when fixes must land together** — findings that share code, invariants, or root cause; not when merely thematically related.
- **Prioritize** — severity first, then risk surface. Lead with structural opportunities and blockers.
- **Cap the nits** — a few high-conviction findings beat an exhaustive dump. If there are structural problems, nits wait.

### 6. Deliver

Default output: **prioritized findings as your response**, formatted per [report-format.md](references/report-format.md) — severity-tagged, `path:line`-anchored, each with a concrete remedy, written to the **outsider contract** (understandable without knowing the repo), led by a one-paragraph summary and a **verdict** (`Approve` / `Approve with nits` / `Request changes`). Hostile mode uses the VERDICT variant in the same doc.

Write a report file or HTML only when explicitly asked (see `report-format.md`).

## Orchestrator playbook

Only for the Orchestrator role. Every spawned reviewer is a full Reviewer over its slice — give each one the scope (diff slice, area, or file list), the routed/requested modes, the base revision, the spec or acceptance criteria, the severity scale, and the findings schema.

| Situation | Split |
|---|---|
| ≤ ~20 files, high stakes | **Cross-family duplicates**: two reviewers, both comprehensive over the whole diff; adjudicate disagreements yourself |
| > ~20 files or multiple subsystems | **By area**: one reviewer per subsystem, each running *all* routed checks on its area |
| Heavy special passes warranted | **By mode, sparingly**: a dedicated adversarial- or security-only reviewer *in addition to* per-area comprehensive coverage, never instead of it |
| Big and high-stakes | Area partition × two families per risky area |

Prefer the area split: a reviewer that runs all checks on one slice keeps cross-check insight ("the naming bug *is* the security bug"). Reviewers are leaves — they never re-delegate any part of the review. Two reviewers independently flagging the same location is the strongest confidence signal available; treat it as confirmed. Synthesis (step 5), verification of disputed findings, and the verdict remain yours.

## Severity scale

Used by every check, every finding, and the verdict.

- **Blocker** — must fix before merge. Correctness bug, security hole, data loss, broken contract, or a structural regression that fails the approval bar.
- **Major** — should fix. A real maintainability/design problem: spaghetti growth, a shallow module where a deep one belongs, a leaked boundary, an untested risky path, a useless test masking one, a missed simplification that removes real complexity.
- **Minor** — recommended. Localized clarity, naming, or type issue.
- **Nit** — optional, preference-level. Group or omit when bigger issues exist.

## Findings schema

Every finding, from every check, in this shape (rendering and the outsider contract in [report-format.md](references/report-format.md)):

- **severity** — Blocker / Major / Minor / Nit
- **check** — which check found it
- **location** — `path:line` or range
- **problem** — what's wrong, 1–2 sentences, with the concrete trigger scenario
- **why** — the impact, 1–2 sentences
- **remedy** — the concrete fix, with a short code or diff sketch when it helps

Write every finding for an outsider: a competent engineer who has never opened this repo — or a fresh implementer agent with no session history — must understand where the problem is, what causes it, and how to fix it from the finding alone.

## References

- `references/review-rubric.md` — the strict review standards, flag list, remedies, approval bar, tone.
- `references/correctness-and-risk.md` — correctness, tests (incl. useless-test catalog), performance.
- `references/security.md` — risk triage, escalation triggers, attacker modeling, blast radius, variant hunt.
- `references/adversarial.md` — hostile persona, attack-surface inventory, falsification moves, catch-all sweep.
- `references/slop.md` — over-engineering tags, waste taxonomy, AI-slop tells for code and prose.
- `references/verification.md` — claim restatement, devil's advocate, self-filter; applied in step 4.
- `references/architecture.md` — deep/shallow modules, seams, adapters, deletion test, vocabulary.
- `references/readability-naming.md` — naming conventions and readability patterns by language.
- `references/simplicity-mindsets/` — philosophical grounding for simplicity findings.
- `references/report-format.md` — outsider contract, findings rendering, verdict, report modes.
