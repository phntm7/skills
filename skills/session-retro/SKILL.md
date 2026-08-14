---
name: session-retro
description: >
  Use when retrospecting on concrete friction from the current session; it turns
  tool failures, confusing instructions, and environment surprises into actionable improvements.
---

# Session Retro

Conduct an honest retrospective of the current session from the agent's point
of view. The deliverable is a short friction report with concrete, prioritized
fixes — not applied edits. The goal is to make the codebase, docs, and
instructions easier for the next agent (or the next session) to work in.

## Ground Rules

- **Only report friction that actually happened this session.** Do not invent
  plausible-sounding issues to appear thorough. "Nothing notable" is a valid
  answer for a category, and a short honest retro beats a padded one.
- **Include minor items.** Things too small to mention mid-task — a doc line
  that was slightly stale, a command that needed one retry, wording that took
  a second read — are exactly what this retro exists to capture.
- **No blame framing.** Describe what slowed the work down and how to remove
  it, whether the cause was the repo, the tooling, the instructions, or the
  agent's own missteps. Own the agent-side mistakes plainly.
- **Report first, edit only on approval.** Propose changes as diffs-in-prose
  (which file, which rule, what wording); apply them only if the user asks.

## Procedure

1. **Sweep the session** for friction in each category below. Re-read your own
   tool-call history mentally; do not skip categories because the session felt
   smooth.
2. **Diagnose each item**: what happened, what caused it, how much effort it
   cost.
3. **Attach a concrete fix** to every item that has one: a specific file to
   edit, a rule to add to `AGENTS.md`/`CLAUDE.md`, a script to add, a rename,
   a doc line to correct. A finding without an actionable fix goes in "final
   thoughts" instead.
4. **Prioritize**: rank the fixes by leverage for future sessions, and say
   which ones you would apply first.

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

1. Findings grouped by category, each with: what happened → cause → proposed
   fix. Skip categories with nothing to report, or fold them into one line.
2. **Final thoughts**: observations worth raising that have no direct fix.
3. **Recommended next changes**: a ranked shortlist (1–5 items) of the fixes
   with the highest leverage, phrased so the user can approve them one by one.

If a recurring workflow surfaced during the session that would pay off as a
reusable asset, note it in the shortlist as a candidate skill, script, or
instruction-file rule rather than describing it abstractly.
