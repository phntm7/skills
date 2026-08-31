# Duplication Review

Use this reference for the **Duplication** check. It is tool-assisted and judgment-mandatory: a clone-detection CLI enumerates candidates; every finding still comes from you reading both sides. The tool is a scout, not a reviewer.

This is a review-only task. Flag real duplication, name the landing spot for the shared code, and do not modify the code. Use the Blocker/Major/Minor/Nit scale from `SKILL.md` and the findings schema in [report-format.md](report-format.md).

## Tool ladder

1. **dupehound** (primary — function-level, similarity-aware, clustered):
   ```bash
   dupehound scan <path> --json     # machine-readable clusters
   dupehound scan <path> --explain <N>   # diff a cluster's copies against the representative
   ```
2. **jscpd** (complement — token-exact, sees what function-scoping misses: duplicated `interface`/type declarations, config files, top-level blocks):
   ```bash
   jscpd <paths> --min-tokens 27 --reporters json --output <tmpdir> --silent
   ```
   jscpd output is high-volume. Filter before triage: cross-file pairs only, ≥15 lines, non-test. Run it on tree scope, or when the diff touches types/config that dupehound cannot cluster.
3. **Neither installed:** skip the check and say so in the review. Do not hand-roll a grep substitute. Do not install tools mid-review; suggest installation to the user instead — instructions live in each tool's README: dupehound at https://github.com/Rafaelpta/dupehound, jscpd at https://github.com/kucherenko/jscpd.

If you cannot execute a CLI (no bash tool), request the scan JSON from the orchestrator via hub, or record the check as skipped.

## Scope rule

- **Diff review** — run the scan, then keep only clusters that touch changed files: the diff either introduced the duplication or grew an existing cluster. Everything else is pre-existing background, out of scope.
- **Tree review** — full scan; triage the top clusters by deletable lines, plus a filtered jscpd pass for non-function duplication.

## Triage protocol

Candidates are not findings. For each surviving cluster:

1. **Discard mechanical false positives first:**
   - Same-file pairs where a factory function overlaps its own inner closure (nesting artifacts — the ranges overlap in one file).
   - Generated files, vendored code, lockfiles.
   - Test-only clusters: deprioritize, don't zero — copy-pasted test setup is a smell, not a Blocker.
2. **Verify against source** — read both sides (or `--explain <N>`) before the candidate becomes a finding. The bar in [verification.md](verification.md) applies: never report an unverified cluster.
3. **Call out intentional copies explicitly.** Some duplication is forced by module boundaries (a package that must not import another re-declares a small helper). Decide and record: either name the shared home that respects the boundary, or accept the copy as intentional so a third copy doesn't appear silently later.

## Severity mapping

- **Behavioral-drift duplication** — the same logic maintained twice where divergence changes behavior (config resolvers, error paths, retry/pagination policy, auth checks duplicated across apps or services): **Major**. If the duplicated logic sits on a risk surface and the copies have *already* drifted, the drift itself is a correctness finding — escalate.
- **Structural boilerplate families** — N near-identical tool wrappers, route loaders, or job factories where a fix in one silently misses the others: **Major** when N ≥ 3 or drift risk is concrete, else **Minor**.
- **Type/interface duplication across a boundary** — re-declared shapes that can drift from the source of truth: **Minor** to **Major** by drift risk.
- **Small mechanical helper copies** (`formatBytes`, flag parsers, extension extractors): **Minor**, grouped into one finding per family.

## Remedy rule

Every duplication finding names the landing spot: a shared helper in the deepest module **both sides already depend on**, respecting the repository's dependency/boundary rules. Never propose an import that violates a documented boundary — if no legal home exists, say so and mark the copy intentional. Parameterize the real deltas (the variant fields, the per-item formatter) instead of forcing copies identical.

Report the payoff in the finding: copies, similarity, and deletable lines ("7 copies, 100% similar, ~123 deletable lines") — the scan gives you all three.
