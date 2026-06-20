---
name: deep-code-review
description: Run an in-depth, full-scale code review of a PR or large change set, covering correctness, architecture, simplicity, readability, naming, types, tests, security, and performance. Use when a large refactor or feature has been implemented and needs a rigorous review before merge, when asked to review a PR in depth, or for a thorough/strict/thermonuclear maintainability audit. Fans review work out to subagents for medium and large diffs. Review-only: produces prioritized, PR-comment-ready findings, never edits code.
---

# Deep Code Review

A rigorous, full-scale review for substantial changes — large refactors, new features, medium/large PRs. The job is to find what matters and say it clearly: correctness bugs, structural regressions, missed simplifications, and unreadable code. Be ambitious about structure and demanding about quality, without drowning the signal in nits.

**This skill is review-only.** It investigates and reports. It never edits code, and it does not post to the PR — the caller does that with the findings it produces.

## When to use

- A large refactor or feature landed and needs a deep review before merge.
- "Review PR `<url>` in depth" / "do a full review of this branch".
- An especially strict maintainability / abstraction-quality audit is wanted.

Not for trivial diffs (a few lines, a config bump, a typo). Those don't need the machinery — review them inline.

## The five steps

```
1. Scope    → resolve the change set, read the diff + surrounding context
2. Plan     → pick the fan-out strategy from the diff size
3. Review   → apply the lenses (yourself, or via read-only subagents)
4. Synthesize → merge, dedupe, adjudicate conflicts, prioritize
5. Deliver  → prioritized findings + a verdict against the approval bar
```

### 1. Scope the change set

Resolve what to review, in this order of preference:

- **PR URL or number** — read it with `pr://<N>` for the description and discussion, and `pr://<N>/diff/all` for the full diff (or `pr://<N>/diff` to list files first on a large PR).
- **Branch** — `git diff <base>...HEAD` against the merge base (default base `main`/`master`; confirm if ambiguous).
- **Explicit range** — whatever the user names.

Then **read past the diff**. A diff-only review misses integration bugs.

- Read each changed file, not just the hunks — context around the change matters.
- For changed exported symbols, find the callers (`lsp references`) and check they still hold.
- Read the immediate collaborators of changed modules.

**Classify the change** before reviewing — this drives Step 2:

- **Size**: files touched, net lines added/removed.
- **Areas / modules**: which subsystems the diff spans.
- **Languages**: per-language conventions apply (see `references/readability-naming.md`).
- **Risk surfaces**: auth, money, persistence/migrations, concurrency, public API/contracts, anything destructive. These get the harshest scrutiny.

### 2. Plan the fan-out

Subagents are the point for anything non-trivial. Match the strategy to the diff:

| Diff size | Strategy |
|---|---|
| **Small** (≤ ~5 files, focused) | Single pass yourself, all lenses. No fan-out. |
| **Medium** (~5–20 files) | Fan out **one subagent per lens** over the whole diff. |
| **Large** (> ~20 files, or multiple subsystems) | **Partition by area/module first**, then review each partition across the lenses (one subagent per partition, each running all lenses; or a lens × partition grid if the PR is huge). |

Spawn review subagents with `task` (the `explore` agent for pure investigation, or `reviewer` / `task` when they should reason hard). They are **read-only**: investigate and report findings in the schema below. They MUST NOT edit code, and MUST NOT run project-wide builds, tests, linters, or formatters — this is a review, nothing is being changed.

Give every subagent: the diff slice it owns, the relevant reference doc(s) for its lens, the **severity scale** and the **findings schema** (below), and the instruction to return only high-conviction findings.

### 3. The review lenses

Eight lenses. Each has a home reference doc — load it when you (or a subagent) apply that lens. Don't apply every lens with equal weight; weight by what the diff actually touches and by risk surface.

1. **Correctness & edge cases** — bugs, broken invariants, off-by-one, null/empty/error paths, race conditions, missed cases. The diff must do what it claims.
2. **Architecture & depth** — `references/architecture.md`. Deep vs shallow modules, seams and adapters, the deletion test, leaked boundaries, logic in the wrong layer.
3. **Simplicity & entropy** — `references/review-rubric.md` + `references/simplicity-mindsets/`. "Code judo" reframings, deletion bias, less total code, spaghetti-conditional growth, file-size explosions.
4. **Readability & naming** — `references/readability-naming.md`. Names that mislead or obscure, magic numbers, unclear booleans, convention drift. The biggest lever on human-readability.
5. **Types & boundaries** — `references/review-rubric.md`. Unnecessary `any`/`unknown`/casts/optionality, ad-hoc object shapes, silent fallbacks papering over unclear invariants.
6. **Tests & coverage** — are the risky branches tested? Tests asserting behavior through an interface, not implementation detail? No mocks where a real test fits? Are deleted-behavior tests removed?
7. **Security** — injection, authz/authn gaps, secret handling, unsafe deserialization, SSRF, trust-boundary crossings introduced by the diff.
8. **Performance & orchestration** — needless allocation/copies, N+1s, avoidable sequential work that should run in parallel, non-atomic updates that can leave half-applied state.

**Vocabulary boundary:** the architecture lens uses the precise terms in `references/architecture.md` exactly — *module, interface, implementation, depth, deep, shallow, seam, adapter, leverage, locality*. Do not substitute "component", "service", or "boundary" there. Every other lens uses plain language — don't force seam/adapter vocabulary onto a naming or bug finding.

The full review rubric — the strict rules, what to flag aggressively, preferred remedies, the approval bar, and the review tone — lives in **`references/review-rubric.md`**. Load it before reviewing. The standards there are the bar; the lenses are how you cover the surface.

### 4. Synthesize

The hard part, and yours alone — never delegate synthesis. From the raw findings:

- **Merge & dedupe** — collapse the same issue reported by multiple lenses at one location into one finding.
- **Adjudicate conflicts** — lenses disagree (e.g. "extract an abstraction" vs "delete this code"). Settle with the deletion test (`references/architecture.md`), the simplicity mindsets, and the approval bar. Record the call; don't ship both.
- **Prioritize** — order by severity, then by risk surface. Lead with structural opportunities and blockers.
- **Cap the nits** — a long list of cosmetic notes buries the real issues. Prefer a few high-conviction findings over an exhaustive nit dump. If there are structural problems, nits wait.

### 5. Deliver

Default output: **prioritized findings as your response**, formatted per `references/report-format.md` — PR-comment-ready markdown (severity-tagged, `path:line` anchored, with a concrete remedy each), led by a one-paragraph summary and a **verdict** against the approval bar (`Approve` / `Approve with nits` / `Request changes`).

Do **not** write a report file or generate the HTML report by default. Only when asked:

- "write the review to a file" → markdown report (`references/report-format.md`).
- architecture-heavy review where visuals help → optional **HTML report mode** (`references/report-format.md`).

Posting findings to the PR is the caller's job, not this skill's. Produce findings clean enough to paste directly.

## Severity scale

Used by every lens, every finding, and the verdict.

- **Blocker** — must fix before merge. Correctness bug, security hole, data loss, broken contract, or a structural regression that fails the approval bar.
- **Major** — should fix. A real maintainability/design problem: spaghetti growth, a shallow module where a deep one belongs, a leaked boundary, a file-size explosion, an untested risky path, a missed simplification that removes real complexity.
- **Minor** — recommended. Localized clarity, naming, or type issue.
- **Nit** — optional, preference-level. Don't flood; group or omit when bigger issues exist.

## Findings schema

Every finding, from every lens, in this shape (full format and examples in `references/report-format.md`):

- **severity** — Blocker / Major / Minor / Nit
- **lens** — which lens found it
- **location** — `path:line` or range
- **problem** — what's wrong, 1–2 sentences
- **why** — the impact / why it matters
- **remedy** — the concrete fix, with a short code or diff sketch when it helps

## References

- `references/review-rubric.md` — the strict review standards, flag list, remedies, approval bar, tone.
- `references/architecture.md` — deep/shallow modules, seams, adapters, deletion test, testing strategy, vocabulary.
- `references/readability-naming.md` — naming conventions and readability patterns by language.
- `references/simplicity-mindsets/` — philosophical grounding for the simplicity lens; load when simplicity is the crux of a finding.
- `references/report-format.md` — findings format, verdict, optional written + HTML report modes.
