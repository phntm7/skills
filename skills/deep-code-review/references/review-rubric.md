# Review rubric
Use this as the spine for a strict review of a diff or change set.
Treat this as a review-only task. Flag problems, push for better structure, recommend concrete remedies. Do not modify the code; leave delivery of the findings to the caller.
The job is not to prove the code works. The job is to decide whether the change leaves the codebase better, simpler, and easier to maintain.

## Core mandate
Be ambitious about structural simplification. Do not stop at local cleanup. Search for code-judo moves: reframings that preserve behavior while making the implementation smaller, more direct, and more inevitable.
Look for changes that delete whole branches, helpers, modes, conditionals, wrappers, or layers. Prefer deleting complexity over rearranging it.
When the diff touches module shape, ownership, seams, or layers, use the vocabulary in [architecture.md](architecture.md). When the strongest finding is deletion bias or simplicity over convenience, ground the call in [simplicity-mindsets/](simplicity-mindsets/).

## Severity mapping
Use the severity scale from `SKILL.md`: **Blocker / Major / Minor / Nit**. Use the findings schema and report rendering in [report-format.md](report-format.md).
- **Blocker** — correctness, security, data loss, broken contracts, or a structural regression severe enough to fail the approval bar.
- **Major** — real maintainability or design problems: spaghetti growth, file-size explosion, boundary leaks, missed high-value simplification, wrong layer, shallow abstraction, type-boundary muddiness.
- **Minor** — localized clarity, naming, type, or decomposition issue with limited blast radius.
- **Nit** — cosmetic or preference-level. Group or omit nits when larger issues exist.
Presumptive request-changes items are not automatically **Blocker**. Most are **Major** unless they also create correctness, security, contract, or severe structural risk.

## Non-negotiable standards
### 1. Structural simplification is the bar
- Ask whether the change can be reframed so fewer concepts exist at all.
- Prefer the implementation that feels inevitable in hindsight.
- Push hard when a code-judo move can delete complexity rather than move it.

### 2. Files crossing roughly 1000 lines are a strong smell
- If the diff pushes a file from below ~1000 lines to above ~1000 lines, scrutinize it.
- Ask whether helpers, submodules, or local abstractions should be extracted first.
- Waive this only when the structure is compelling and still easy to scan.

### 3. Do not allow random spaghetti growth
- Be suspicious of ad-hoc conditionals inserted into unrelated paths.
- Treat scattered special cases as design problems, not style nits.
- Push feature logic into the right abstraction, model, helper, state machine, policy, or module.
- Flag changes that make surrounding code harder to reason about even when behavior is correct.

### 4. Clean the design; do not rubber-stamp working code
- Working code can still be a bad change.
- If behavior can stay the same while structure gets meaningfully cleaner, push for that.
- Prefer removing moving pieces over spreading the same complexity across more files.

### 5. Prefer direct, boring, maintainable code
- Flag hacky, brittle, magical, or overly generic behavior.
- Be skeptical of mechanisms that hide simple data-shape assumptions.
- Challenge thin abstractions, identity wrappers, and pass-through helpers that add indirection without leverage.

### 6. Push on type and boundary cleanliness
- Question unnecessary `any`, `unknown`, casts, optionality, and loose object shapes.
- Prefer explicit typed models and shared contracts.
- Treat silent fallbacks as suspicious when they paper over unclear invariants.
- Ask whether the boundary can be made explicit so control flow gets simpler.

### 7. Keep logic in the canonical layer
- Flag feature logic leaking into shared paths and implementation details leaking through APIs.
- Prefer existing canonical helpers over bespoke one-offs.
- Push code toward the package, module, service, or layer that already owns the concept.

### 8. Treat needless orchestration as a design smell
- If independent work is serialized for no reason, ask whether parallel execution would be simpler.
- If related updates can leave half-applied state, push for a more atomic structure.
- Do not chase micro-optimizations. Do flag orchestration that makes the implementation brittle.

## Primary review questions
For every meaningful diff hunk, ask:
- Is there a code-judo move that would make this dramatically simpler?
- Can the change be reframed so fewer concepts, branches, or helper layers are needed?
- Does this improve or worsen the local architecture?
- Did the diff add branching complexity where a better abstraction should exist?
- Did a previously cohesive module become more coupled, more stateful, or harder to scan?
- Is this logic living in the right file and layer?
- Did this change enlarge a file or component past a healthy size boundary?
- Are repeated conditionals signaling a missing model or helper?
- Is the implementation direct and legible, or does it rely on special cases and incidental control flow?
- Is this abstraction earning its keep, or is it just a wrapper?
- Did the diff introduce casts, optionality, or ad-hoc object shapes that obscure the real invariant?
- Is this logic in the canonical layer, or did the diff leak details across a boundary?
- Is this orchestration more sequential or less atomic than it needs to be?

## What to flag aggressively
Escalate findings when the diff introduces or preserves:
- A complicated implementation where a cleaner reframing could delete whole categories of complexity.
- A refactor that moves code around but does not reduce concepts a reader must hold.
- A file crossing ~1000 lines because of the PR, especially when new code could be split out.
- New conditionals bolted onto unrelated code paths.
- One-off booleans, nullable modes, or flags that complicate existing control flow.
- Feature-specific logic leaking into general-purpose modules.
- Generic magic handling that hides simple structure.
- Thin wrappers or identity abstractions that add indirection without simplifying anything.
- Unnecessary casts, `any`, `unknown`, or optional params that muddy the real contract.
- Copy-pasted logic instead of reused or extracted helpers.
- Narrow edge-case handling dropped into an already busy function.
- Refactors that pass tests while making the code less modular or less readable.
- Temporary branching that is likely to become permanent debt.
- Bespoke helpers where the codebase already has a canonical utility.
- Logic added in the wrong layer, package, or module.
- Sequential async flow where independent work could stay clearer in parallel.
- Partial-update logic that leaves state less atomic than necessary.

## Preferred remedies
Prefer remedies that delete complexity instead of decorating it:
- Delete a whole layer of indirection rather than polishing it.
- Reframe the state model so conditionals disappear instead of getting centralized.
- Change ownership so the feature becomes a natural extension of an existing abstraction.
- Turn special-case logic into a simpler default flow with fewer exceptions.
- Extract a helper or pure function when it removes repeated logic or clarifies ownership.
- Split a large file into focused modules.
- Move feature-specific logic behind a dedicated abstraction.
- Replace condition chains with a typed model or explicit dispatcher.
- Separate orchestration from business logic.
- Collapse duplicate branches into a single clearer flow.
- Delete wrappers that do not clarify the API.
- Reuse the canonical helper instead of introducing a near-duplicate.
- Make type boundaries explicit so control flow gets simpler.
- Move logic to the layer that owns the concept.
- Parallelize independent work when that also simplifies orchestration.
- Restructure related updates into a more atomic flow.
Do not settle for "rename this" when the real issue is structural. Do not settle for a cleaner version of the same messy idea when a simpler idea is plausible.

## Review tone
Be direct, serious, and demanding about quality. Do not be rude. Do not soften major maintainability problems into mild suggestions.
If the diff makes the codebase messier, say so. If it missed a dramatic simplification, say so.
Good phrases:
- `this pushes the file past 1k lines. can we decompose this first?`
- `this adds another special-case branch into an already busy flow. can we move this behind its own abstraction?`
- `this works, but it makes the surrounding code more spaghetti. let's keep the behavior and restructure the implementation.`
- `this feels like feature logic leaking into a shared path. can we isolate it?`
- `this abstraction seems unnecessary. can we keep the direct flow?`
- `why does this need a cast / optional here? can we make the boundary more explicit instead?`
- `this looks like a bespoke helper for something we already have elsewhere. can we reuse the canonical one?`
- `i think there's a code-judo move here that makes this much simpler. can we reframe this so these branches disappear?`
- `this refactor moves complexity around, but doesn't really delete it. is there a way to make the model itself simpler?`

## Output prioritization
Prioritize findings in this order:
1. Structural code-quality regressions.
2. Missed opportunities for dramatic simplification or code-judo restructuring.
3. Spaghetti or branching-complexity increases.
4. Boundary, abstraction, or type-contract problems that make the code harder to reason about.
5. File-size and decomposition concerns.
6. Modularity and abstraction issues.
7. Legibility and maintainability concerns.
Do not flood the review with low-value nits when larger issues exist. A few high-conviction findings beat a long cosmetic list.

## Approval bar / presumptive blockers
Do not approve merely because behavior seems correct.
The change should satisfy all of these:
- No clear structural regression.
- No obvious missed opportunity to make the implementation dramatically simpler when such a path is visible.
- No unjustified file-size explosion.
- No obvious spaghetti growth from special-case branching.
- No hacky or magical abstraction that makes the code harder to reason about.
- No unnecessary wrapper, cast, or optionality churn obscuring the real design.
- No clear architecture-boundary leak or avoidable canonical-helper duplication.
- No missed obvious decomposition that would materially improve maintainability.
Treat these as presumptive request-changes findings unless the author justifies them clearly:
- The PR preserves substantial incidental complexity when a plausible code-judo move would delete it.
- The PR pushes a file from below ~1000 lines to above ~1000 lines.
- The PR adds ad-hoc branching that tangles an existing flow.
- The PR solves a local problem by scattering feature checks across shared code.
- The PR adds an unnecessary abstraction, wrapper, or cast-heavy contract that makes the design more indirect.
- The PR duplicates an existing helper or puts logic in the wrong layer when there is a clear canonical home.
Default most of these to **Major**. Raise to **Blocker** only when the change also risks correctness, security, data loss, a broken contract, or a structural regression severe enough to fail the approval bar.
If the bar is not met, leave explicit, actionable feedback and push for a cleaner decomposition.