# Correctness & Risk

Backs four lenses: **Correctness & edge cases**, **Tests & coverage**, **Security**, and **Performance & orchestration**. These are checklists, not essays — every competent agent already reviews for them, so this doc exists to keep the bar high and consistent, not to teach the basics. Use the **Blocker / Major / Minor / Nit** scale from `SKILL.md` and the findings schema in [report-format.md](report-format.md).

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

## Security

- Trust boundaries: injection (SQL / command / template / path), unsafe deserialization, SSRF, XXE.
- AuthN / AuthZ: is every new path access-controlled, with the privilege check derived from verified identity — never from client-supplied data?
- Secrets: no hardcoded credentials or tokens; not written to logs; not leaked in responses or errors.
- Output handling: correct encoding / escaping; no XSS; no sensitive data in logs.
- Crypto / randomness: no homegrown crypto, no weak RNG for security-sensitive values, constant-time compare where it matters.
- Dependencies: new dependencies are warranted and not on known-vulnerable versions.

Severity: an exploitable hole or an authz gap on a reachable path is a Blocker.

## Performance & orchestration

- Algorithmic: avoidable O(n²), N+1 queries/calls, work repeated inside hot loops, recomputation that could be hoisted.
- Allocation: needless copies or allocations, large in-memory buffers, unbounded collections.
- I/O: missing batching or pagination, chatty round-trips, missing caching where it clearly pays.
- Orchestration: independent work serialized for no reason (could run in parallel); conversely, over-parallelizing trivial work.
- Atomicity: related updates that can leave half-applied state; missing transaction boundaries.

Severity: a regression in complexity class on a hot path, or a non-atomic update on a risk surface, is Major or higher. Don't chase micro-optimizations.
