---
name: session-retro
description: >
  Retrospect friction from the current agent session — tools, docs, codebase,
  environment, task wording, or agent missteps — and propose prioritized prose
  fixes without editing.
---

# Session Retro

The deliverable is a short friction report with concrete, prioritized
fixes — not applied edits. The goal is to make the codebase, docs, and
instructions easier for the next agent (or the next session) to work in.

## Ground Rules

- Ground each finding in observed session evidence; describe causes without
  blame, including the agent's own missteps.
- Include minor items: a slightly stale doc line, a command that needed one
  retry, wording that took a second read — the small stuff is exactly what
  this retro exists to capture.
- Return proposed prose diffs (which file, which rule, what wording); apply
  edits only after approval.

## Procedure

1. **Sweep the session**: review the transcript and tool results, and record
   each of the six category labels below with an observed event or "none".
2. **Diagnose each finding** as what happened → cause → effort → fix, where
   effort is what the friction cost (retries, tokens, time).
3. **Attach a concrete fix** to every item that has one: a specific file to
   edit, a rule to add to `AGENTS.md`/`CLAUDE.md`, a script to add, a rename,
   a doc line to correct. A finding without an actionable fix goes in "final
   thoughts" instead.

## Friction Categories

- **Tool calls and commands**: failures, retries, permission denials, commands
  that needed non-obvious flags or workarounds, slow or flaky verification
  steps.
- **Docs and instructions**: confusing, stale, contradictory, or missing
  guidance in `AGENTS.md`, `CLAUDE.md`, READMEs, or code comments; rules that
  were easy to misread or that conflicted with the repo's actual state.
- **Codebase navigability**: misleading names, surprising file locations,
  structure that took effort to discover, conventions that had to be inferred
  instead of being written down.
- **Environment**: version mismatches, missing tools, path or config
  surprises, sandbox or permission friction.
- **Task wording**: phrasing in the user's requests that took effort to
  interpret correctly, or where the agent initially guessed wrong.
- **Agent missteps**: wrong turns the agent took that a better doc, rule, or
  guardrail would have prevented.

## Output Contract

Produce a compact report in chat:

1. Findings grouped by category, each with: what happened → cause → effort →
   proposed fix. Fold empty categories into one compact line:
   `No findings in: <categories>`.
2. **Final thoughts**: observations worth raising that have no direct fix.
3. **Recommended next changes**: a ranked shortlist (1–5 items) of the fixes
   with the highest leverage, phrased so the user can approve them one by one.

If a recurring workflow surfaced during the session that would pay off as a
reusable asset, note it in the shortlist as a candidate skill, script, or
instruction-file rule rather than describing it abstractly.
