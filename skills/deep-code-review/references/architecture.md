# Architecture & Depth

Use this reference for the **Architecture & depth** lens when reviewing a diff or PR-sized change set.

This skill is review-only. Flag structural problems, push for deeper shapes, and recommend concrete rewrites. Do not edit code. Do not post to the PR.

Findings use the severity scale and schema from `SKILL.md` and [report-format.md](report-format.md). For architecture-heavy visuals, use the optional HTML report mode in [report-format.md](report-format.md); do not duplicate it here.

If the project has a domain glossary or ADRs, use their names and do not re-litigate settled decisions.

## Vocabulary boundary

This strict vocabulary applies to the architecture lens only. Use these words exactly in architecture findings. Other lenses may use plain language.

**module** — Anything with an interface and an implementation. Scale-agnostic: a function, class, package, or tier-spanning slice can all be a module. Avoid these substitutes: component, service, unit.

**interface** — Everything a caller must know to use the module correctly: type shape, invariants, ordering constraints, error modes, required configuration, and performance characteristics. Avoid these substitutes: API, signature. They are too narrow.

**implementation** — What is inside a module: its body of code. Distinct from adapter. A small adapter can have a large implementation. A large adapter can have a small implementation.

**depth** — Leverage at the interface: the amount of behaviour a caller or test can exercise per unit of interface they must learn. Depth is a property of the interface, not the implementation.

**deep** — A module is deep when a large amount of behaviour sits behind a small interface. Deep does not mean large, clever, abstract, or hard to understand.

**shallow** — A module is shallow when the interface is nearly as complex as the implementation. Shallow modules often pass through parameters, expose internal sequencing, or force callers to coordinate behaviour themselves.

**seam** — A place where behaviour can be altered without editing in that place. The seam is the location where a module's interface lives. Avoid this substitute: boundary. Boundary is overloaded, especially with DDD bounded context.

**adapter** — A concrete thing that satisfies an interface at a seam. Adapter describes a role, not substance. Use adapter when the seam is the topic. Use implementation otherwise.

**leverage** — What callers get from depth: more capability per unit of interface they must learn. One implementation pays back across N callers and M tests.

**locality** — What maintainers get from depth: change, bugs, knowledge, and verification concentrate in one place instead of spreading across callers.

## Key principles
- Depth is a property of the interface, not the implementation.
- Deletion test: delete the module; if complexity vanishes it was a pass-through, if it reappears across N callers it earned its keep.
- The interface is the test surface.
- One adapter = hypothetical seam. Two adapters = real seam.

## Core review questions

Review the change set, not an imagined whole-codebase refactor. Read surrounding context only as needed to judge the changed modules and their callers.

Ask:

- Did the PR add or modify a shallow module where a deep one belongs?
- Did it leak behaviour across a seam, making callers know too much?
- Did it extract a pure function for testability while the real bugs still live in how that function is called?
- Did it add pass-through modules, pass-through parameters, or one-method wrappers with no leverage?
- Did it move complexity out of one file only to spread it across N callers?
- Did it expose internal seams through the external interface just so tests can reach them?
- Did new tests couple to implementation details instead of testing through the interface?

Use architecture findings for changed code. Do not demand a rewrite of untouched architecture unless the diff depends on it or worsens it.

## The deletion test

Apply this to anything the PR adds that looks like a pass-through.

Imagine deleting the module:

- If complexity vanishes, the module was not hiding anything. It was a pass-through.
- If complexity reappears across N callers, the module was earning its keep.

Use the result to judge whether the issue is a `Blocker`, `Major`, `Minor`, or `Nit`; definitions live in `SKILL.md`, and rendering lives in [report-format.md](report-format.md).

## Interface as test surface

The interface is the test surface. Callers and tests should cross the same seam.

Flag tests that:

- Reach past the interface into internal implementation state.
- Assert sequencing that callers should not know.
- Mock a helper only because the extracted helper is shallow.
- Test a pure function while leaving the real orchestration untested.
- Break whenever the implementation changes but behaviour does not.

Push for tests that assert observable outcomes through the changed module's interface. Good tests should survive internal refactors.

## Dependency categories

When the diff deepens, splits, or introduces a seam, classify the dependencies. The category determines how the deepened module is tested across its seam.

### 1. In-process

Pure computation, in-memory state, no I/O.

- Always a candidate for deeper locality.
- No adapter is needed; tests should call the deepened interface directly.
- Flag needless seams that only add indirection.

### 2. Local-substitutable

Dependencies with local test stand-ins: embedded database, in-memory filesystem, local queue, fake clock, test container.

- Test the deepened module with the stand-in in the test suite.
- The seam is usually internal to the implementation.
- Do not expose a port at the external interface only for tests.

### 3. Remote-but-owned ports & adapters

Owned systems across a network: internal HTTP endpoints, gRPC endpoints, queues, worker calls.

- Put a port at the seam only when behaviour truly varies across it.
- The deep module owns the logic.
- Production uses a transport adapter.
- Tests use an in-memory adapter.
- Flag domain orchestration in transport code or callers coordinating remote details.

Recommendation shape:

> Define a port at the seam, use an HTTP/gRPC/queue adapter in production and an in-memory adapter in tests, so the logic sits in one deep module even though transport crosses a network.

### 4. True-external mock

Third-party systems the project does not control: payments, SMS, email, identity, vendor integrations.

- The external dependency enters through an injected port.
- Tests provide a mock adapter.
- The module should own vendor-specific error translation, retries, and invariants when those rules affect callers.
- Flag vendor details leaking into unrelated callers.

## Seam discipline

A seam is a design decision. Do not add one because a test wants a handle.

Rules:

- One adapter = hypothetical seam. Two adapters = real seam.
- A single-adapter seam is usually indirection, not architecture.
- Internal seams can exist inside a deep module for its implementation and its own tests.
- External seams should stay small and stable.
- Do not expose internal seams through the interface.
- Do not layer a new seam on top of an old shallow seam when the old one should be replaced.
- Prefer replace over layer when a PR deepens a module.

Flag diffs that keep the old shallow module, add a deeper module beside it, and make callers bounce through both. That usually preserves the old complexity and adds another interface to learn.

## Testing strategy: replace, don't layer

When a diff deepens a module, the tests should move with the seam.

Push for:

- New tests at the deepened interface.
- Deleting old shallow-module unit tests once the deeper interface covers the behaviour.
- Assertions on observable outcomes, not internal state.
- Tests that describe behaviour and survive internal refactors.
- The smallest necessary adapter for the dependency category.

Flag:

- Layered tests that keep old shallow unit tests and add new integration tests without deleting obsolete coverage.
- Mocks that recreate the implementation's sequencing.
- Tests that only prove a helper was called.
- Test-only interface expansion.
- A pure-function extraction where the risky call ordering remains untested.

A good architecture finding ties the testing issue to locality: the bug risk lives where callers coordinate behaviour, not inside the extracted helper.

## Optional deep-dive: design it twice

Use this only when recommending a structural rewrite and the best interface is not obvious.

Pattern:

1. Frame the changed module, current seam, dependency category, and constraints.
2. Spawn 3+ read-only subagents in parallel.
3. Give each subagent a different constraint and ask for a radically different interface:
   - Minimize the interface: 1–3 entry points, maximum leverage per entry point.
   - Maximize flexibility: support likely extension points.
   - Optimize for the common caller: make the default path trivial.
   - If relevant, design around ports & adapters for cross-seam dependencies.
4. Compare the designs by depth, locality, and seam placement.
5. Give an opinionated pick or hybrid. Do not present a neutral menu.

Keep this as a review aid. The delivered output is still findings in the schema from [report-format.md](report-format.md), plus an optional structural opportunity when the rewrite is larger than one PR comment.
