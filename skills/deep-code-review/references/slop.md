# Slop & Over-Engineering Review

This lens is always on. Hunt complexity that should not exist, especially AI-generated slop; deletion is the preferred remedy. This is a review-only task: flag what to cut, recommend what replaces it, and do not modify the code.

Review diffs for unnecessary complexity. One line per finding: location, what to cut, what replaces it. The diff's best outcome is getting shorter.

## Format

`L<line>: <tag> <what>. <replacement>.`, or `<file>:L<line>: ...` for
multi-file diffs.

Tags:

- `delete:` dead code, unused flexibility, speculative feature. Replacement: nothing.
- `stdlib:` hand-rolled thing the standard library ships. Name the function.
- `native:` dependency or code doing what the platform already does. Name the feature.
- `yagni:` abstraction with one implementation, config nobody sets, layer with one caller.
- `shrink:` same logic, fewer lines. Show the shorter form.

## Anti-hedge examples

WRONG: "This EmailValidator class might be more complex than necessary, have you
considered whether all these validation rules are needed at this stage?"

RIGHT: `L12-38: stdlib: 27-line validator class. "@" in email, 1 line, real validation is the confirmation mail.`

RIGHT: `L4: native: moment.js imported for one format call. Intl.DateTimeFormat, 0 deps.`

RIGHT: `repo.py:L88: yagni: AbstractRepository with one implementation. Inline it until a second one exists.`

RIGHT: `L52-71: delete: retry wrapper around an idempotent local call. Nothing replaces it.`

RIGHT: `L30-44: shrink: manual loop builds dict. dict(zip(keys, values)), 1 line.`

End with the only metric that matters: `net: -<N> lines possible.`
If there is nothing to cut, say `Lean already. Ship.` and stop.

## Boundary

Scope: over-engineering and complexity only. Correctness bugs, security holes,
and performance are explicitly out of scope. Route them to a normal review
pass, not this one. A single smoke test or `assert`-based
self-check is the ponytail minimum, not bloat, never flag it for deletion.
Does not apply the fixes, only lists them.

## Waste taxonomy

Use these CEK Muda categories to find complexity that creates no value.

**1. Overproduction** -- Code written beyond what the task requires
Anti-patterns:
- Speculative features or parameters added "for future flexibility"
- Premature abstractions (interfaces, generics, factories) with only one implementation
- Configuration knobs no caller uses
- Public API surface exposed beyond actual callers
- Helper functions written but never called
NOT waste:
- Abstractions justified by >=2 current call sites (Rule of Three)

**3. Transportation** -- Data moved or reshaped between layers for no value
Anti-patterns:
- DTO <-> entity <-> DTO round-trips where shapes are identical
- Pass-through wrapper methods that only forward arguments
- N+1 query patterns

**4. Over-processing** -- Work the code performs that produces no observable benefit
Anti-patterns:
- Re-validating data already validated at a trusted upstream boundary
- Null/undefined checks on values typed as non-nullable
- Defensive try/catch that re-throws the same error unchanged

**5. Inventory** -- Unfinished or unused code accumulating in the diff
Anti-patterns:
- Dead code: unreachable branches, unused exports, never-called functions
- Commented-out blocks left in place
- Feature flags for fully rolled-out features

**6. Motion** -- Cognitive overhead from how code is organized
Anti-patterns:
- Logic for one feature scattered across many files organized by technical layer
- Helpers placed far from their only caller

## Over-engineering smells

- **Speculative Generality**: abstraction, parameters, or hooks added for needs the spec doesn't have. -> delete it; inline back until a real need shows.
- **Middle Man**: a class or function that mostly just delegates onward. -> cut it, call the real target direct.
- **Mysterious Name**: a function, variable, or type whose name doesn't reveal what it does or holds. -> rename it; if no honest name comes, the design's murky.

**One-implementation interfaces:** One adapter means a hypothetical seam. Apply the deletion test in [architecture.md](architecture.md): imagine deleting the module; if complexity vanishes, it was a pass-through; if it reappears across N callers, it earned its keep.

## Code slop tells

### Boolean-prop or flag explosion

Don't add boolean props like `isThread`, `isEditing`, `isDMThread` to customize
component behavior. Each boolean doubles possible states and creates
unmaintainable conditional logic. Use composition instead.

Apply the same check beyond React: boolean flags on functions, classes, configs,
and command handlers also double possible states and hide distinct variants.
Instead of one component with many boolean props, create explicit variant
components. Each variant composes the pieces it needs. The code documents
itself.

### Generic names and wrappers

- Treat `Manager`, `Helper`, `Utility`, `utils`, and `common` as slop tells unless the name describes a real domain concept; use a domain-specific name.
- Flag pass-through wrappers that only forward arguments; call the real target or keep a deep interface that earns the indirection.
- Flag speculative generics added before a second real type or call site exists; use the concrete current shape until variation is real.

### Reuse-or-justify

**CRITICAL**: Ignoring existing reusable code = designing duplication into the architecture. Every reusable element the code-explorer identified MUST appear in your architecture either as a direct reuse or with an explicit justification for why it was NOT reused.

Ask: did the diff duplicate an existing canonical helper? If yes, reuse the canonical helper. If not, state the concrete reason the existing helper does not fit.

## Prose slop tells

Review comments, documentation, and commit text added or changed in the diff.

### AI-generated tells (flag these)

- Summary-style transitions: never open a paragraph by recapping the last one (`With this setup complete…`, `Now that we've explored…`); pivot straight to the next point (`In practice…`, `The catch is…`)
- Stop-start sentences: don't split one dependent idea into choppy fragments (`Previously this was manual. Now it's automatic. This saves time.` → one sentence); short sentences for emphasis are fine
- Spec-sheet voice: rewrite sentences that read like a system reading a datasheet (`provides`, `is configurable`, `is explicitly labeled`)
- Cold-open paragraphs: a body paragraph whose first sentence works as a standalone heading has no antecedent; carry the prior subject forward (`Because…`, `Once…`)
- Personified artifacts: machines don't perform human-physical actions (`hand the browser a URL` → `the browser fetches the URL`; `the token holds…` → `the token is stored…`)
- Reused framing: the angle must come from this page, not a template (`The question most teams face is whether…`)

### Banned words

- `easy`, `simple`, `quick`: puts pressure on the reader and reads as marketing; replace with concrete description ("one command", "default settings", "most projects don't need this")
- `very`, `just`, `really`: filler; cut or rewrite

Slop findings about tests belong to the useless-test catalog in [correctness-and-risk.md](correctness-and-risk.md). Structural waste is usually **Major**; single-line shrinks are **Nits**. Group related slop findings when they share one remedy.
