# Correctness & Risk

Backs three lenses: **Correctness & edge cases**, **Tests & coverage**, and **Performance & orchestration**. These are checklists, not essays — every competent agent already reviews for them, so this doc exists to keep the bar high and consistent, not to teach the basics. Use the **Blocker / Major / Minor / Nit** scale from `SKILL.md` and the findings schema in [report-format.md](report-format.md).

Weight by risk surface. Auth, money, persistence/migrations, concurrency, public contracts, and destructive operations get the harshest scrutiny; a defect there outranks any structural nit. Stay high-conviction — don't pad the review with speculative edge cases or perf micro-nits.

## Correctness & edge cases

- Boundary inputs: empty / null / undefined, zero, negative, max / overflow, single element, very large.
- Off-by-one, inclusive vs exclusive ranges, fencepost errors.
- Error paths: are errors caught, propagated, or silently swallowed? What happens on partial failure?
- Invariants: does the change preserve the invariants the surrounding code assumes (across fields, not just per field)?
- Concurrency: shared mutable state, races, double-submit, idempotency, assumed ordering.
- Time / locale / encoding: timezones, DST, clock skew, charset, float precision for money.
- Resource lifecycle: leaks, unclosed handles, unbounded growth.
- Intent vs diff: does the change actually do what the PR description claims, with nothing extra?

Severity: a real defect on a reachable path is usually Blocker or Major; a theoretical edge with no live caller is Minor.

## Tests & coverage

- Are the changed and risky branches tested, or only the happy path?
- Tests assert observable behavior through the interface, not implementation internals (see [architecture.md](architecture.md)).
- No mocks where a real, cheap test fits; a mock must not re-encode the implementation's own sequencing.
- New behavior gets new tests; removed or changed behavior gets its old tests deleted or updated — no stale coverage left behind.
- Tests are deterministic: no reliance on wall-clock, ordering, or live network.
- Proportion: don't demand tests for trivial config/string changes; do demand them for logic on a risk surface.

Severity: untested logic on a risk surface is Major; a missing test for a minor pure helper is Minor.

### Useless tests — flag for deletion

A test earns its place only if it can fail on a plausible bug. For each test the diff adds, ask: which plausible bug would make this fail? No answer → flag it. Tests are code: the slop lens in [slop.md](slop.md) applies to them. "Delete this test" is a first-class finding.

A good test reads like a specification: "user can checkout with valid cart" tells you exactly what capability exists. It verifies behavior through public interfaces, not implementation details, and survives refactors because it doesn't care about internal structure.

| Pattern | The tell |
|---|---|
| Coverage padding | Exercises lines but asserts nothing meaningful: `expect(result).toBeDefined()`, no-throw on the happy path, unreviewed snapshot dumps. |
| Existence tests | Asserts the functionality is present, not correct: renders-without-crashing, "is a function", config constant equals itself. |
| Tautological | The assertion recomputes the expected value the way the code does (`expect(add(a, b)).toBe(a + b)`, a snapshot derived by hand the same way, a constant asserted equal to itself), so it passes by construction and can never disagree with the code. Expected values must come from an independent source of truth: a known-good literal, a worked example, the spec. |
| Mock theater | Mocks internal collaborators and asserts call counts/order; the test verifies the mock, not the code. Mock at system boundaries only: external APIs, time/randomness, sometimes databases/filesystem. Don't mock: your own classes/modules, internal collaborators, anything you control. |
| Implementation-coupled | The tell: the test breaks when you refactor but behavior hasn't changed. Verifies through a side channel (querying the database instead of using the interface). |
| Bad-test economics | Prefer no new test over a bad test. A bad test is one that mostly tests mocks, encodes current implementation details, depends on timing or unrelated global state, needs expensive infrastructure for a small fix, or would be deleted immediately after proving the fix. |
| Weakened assertions | The diff loosens or deletes an existing assertion so the implementation passes. Do not change tests merely to match a wrong implementation. Do not weaken existing assertions unless the expected behavior has genuinely changed and the reason is clear. |
| Unrelated coverage churn | Bulk tests bolted onto a fix "for coverage". Horizontal slicing: bulk tests verify *imagined* behavior: you test the *shape* of things rather than user-facing behavior, the tests go insensitive to real changes, and you commit to test structure before understanding the implementation. |

Severity: weakened or deleted assertions on a risk surface → Blocker. Mock theater or tautology guarding a risky path → Major (the path is effectively untested while coverage claims otherwise — worse than no test). Padding and existence tests → Minor, grouped.

## Security

The security lens moved to [security.md](security.md).

Quick secret/injection sanity checks remain part of correctness when the security lens isn't routed.

## Performance & orchestration

- Algorithmic: avoidable O(n²), N+1 queries/calls, work repeated inside hot loops, recomputation that could be hoisted.
- Allocation: needless copies or allocations, large in-memory buffers, unbounded collections.
- I/O: missing batching or pagination, chatty round-trips, missing caching where it clearly pays.
- Orchestration: independent work serialized for no reason (could run in parallel); conversely, over-parallelizing trivial work.
- Atomicity: related updates that can leave half-applied state; missing transaction boundaries.

Severity: a regression in complexity class on a hot path, or a non-atomic update on a risk surface, is Major or higher. Don't chase micro-optimizations.
