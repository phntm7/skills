---
name: workflow-audit
description: >
  Use when analyzing recent coding-agent histories for repeated manual work; it
  identifies strong candidates for skills, subagents, commands, automations, or instruction updates.
---

# Workflow Audit

Use this skill to inspect local agent session history, memory, and existing
assets, then recommend (or create) the smallest reusable artifact for repeated
workflows. The goal is leverage, not bulk: skip one-offs and existing coverage,
package only what will materially help next time.

## Default Mode

Default to **user-in-the-loop**. Produce a shortlist and recommendations
first; do not edit files until the user approves. Switch modes only when the
user explicitly says so:

- `fully automatic` — scan, shortlist, then create or extend only
  high-confidence missing **project-local** assets (files under the project
  root: `./.claude/`, `./.codex/`, `./.agents/`, `./.opencode/`, `./.factory/`,
  `./.pi/`, project `AGENTS.md`/`CLAUDE.md`, project skills/commands/agents).
- `user-in-the-loop` — scan, shortlist, recommend. Edit only after approval.
- `recommendations only` — stop after the shortlist and final report.

Writes to user-level or global assets (`~/.codex/`, `~/.claude/`,
`~/.config/opencode/`, `~/.factory/`, `~/.pi/`, global instruction files,
globally installed skills/commands) always require explicit approval, even in
fully automatic mode, unless the user pre-authorized global writes in this
session.

Creating or modifying scheduled, background, or external automations (cron,
LaunchAgents, GitHub Actions, calendar/reminder hooks, Linear automations)
always requires explicit approval, even in fully automatic mode, unless the
user pre-authorized automation creation in this session.

## Agent Scope

If the user lists agents, scan only those. Otherwise default to **Codex and
Claude Code**.

Honor any history scope the user provides (date range, project vs global).
Otherwise assume **project scope** and the **last 30 days**, or all available
history if less exists.

Codex history is global and date-organized, not project-namespaced. For Codex
project scope, filter session records by `cwd`, workspace, repo, or worktree
metadata.

## Project Scope Matching

Determine the current project root from: current working directory, Git root,
repo name, package/workspace metadata, and remote origin slug.

Include a session as project-relevant when any of these match:

- recorded `cwd`, workspace root, or repo path is inside the project root;
- it references a Git worktree whose common repo, remote origin, or repo slug
  matches the project;
- it uses a temporary/worktree path containing the repo slug (for example
  `~/.t3/worktrees/<repo-slug>/...`, `.worktrees/<repo-slug>/...`,
  `/tmp/.../<repo-slug>/...`, or platform temp equivalents) **and** at least
  one other signal confirms relevance;
- metadata, branch name, file paths, or session summary clearly ties it to
  this project.

For paths outside the project root, require **two** relevance signals unless
Git metadata directly proves the same repo. Exclude ambiguous same-name
projects when remote, package, or workspace evidence conflicts.

## Required Checks

Always check, for each selected agent:

- recent session/history files;
- memory/instruction files when present;
- existing local skills, commands, custom agents/subagents/droids;
- project and global `AGENTS.md`/`CLAUDE.md` guidance;
- skills available in the current environment, especially skill creation,
  AGENTS.md/CLAUDE.md maintenance, prompt-craft, documentation edits, and
  `skills-manage` for inventorying installed skills via the `skills` CLI.

Use those skills and the project's existing patterns when drafting or editing
assets. For exact paths and history shapes, load
[references/agent-locations.md](references/agent-locations.md).

## Optional Checks

Inspect only when clearly available and safe:

- Chronicle or other screen/activity history (discovery only);
- MCP memory tools or plugin-provided memory systems;
- cloud-only or synced histories accessible through approved tools;
- existing automations in local app configs, cron, LaunchAgents, GitHub
  Actions, Linear, calendar/reminders, or other configured systems.

If an optional source is unavailable, inaccessible, disabled, or too broad to
inspect safely, note the limitation and continue.

## Transcript Parsing Rules

Do not classify workflows by raw keyword counts across full transcripts. Count
repeated workflows at the session/task level, not by repeated terms inside a
single transcript.

Prioritize:

- user prompts;
- session metadata;
- assistant task and final summaries;
- compacted summaries;
- tool-call intent, filenames, commands, and changed files;
- memory summaries and durable entries.

De-emphasize or ignore:

- injected `AGENTS.md`/`CLAUDE.md` text;
- skill listings;
- copied docs and pasted prompts;
- raw tool output, dependency logs, stack traces;
- repeated boilerplate and quoted previous summaries.

## Existing Coverage

Before recommending a new asset, search **specific asset and config
locations**, not whole agent home directories. Treat broader roots only as
discovery boundaries to enumerate the locations below; do not recursively
read transcripts, caches, or logs under them.

Project:

- `AGENTS.md`, `CLAUDE.md`, `AGENTS.override.md`, `CLAUDE.local.md`;
- `.claude/skills/`, `.claude/commands/`, `.claude/agents/`,
  `.claude/rules/`, `.claude-plugin/`;
- `.codex/skills/`, `.codex/commands/`, `.codex-plugin/`;
- `.agents/skills/`, `.agents/plugins/`;
- `.opencode/agent/`, `.opencode/commands/`, `opencode.json(c)`;
- `.factory/droids/`, `.factory/skills/`, `.factory/commands/`,
  `.factory/mcp.json`, `.factory/config.json`, `.factory/settings.json`;
- `.pi/settings.json`.

Global (enumerate listed subdirs only; do not crawl the parents):

- `~/.claude/CLAUDE.md`, `~/.claude/skills/`, `~/.claude/commands/`,
  `~/.claude/agents/`, `~/.claude/plugins/`;
- `$CODEX_HOME/AGENTS.md`, `$CODEX_HOME/skills/`, `$CODEX_HOME/commands/`,
  `$CODEX_HOME/automations/`;
- `~/.agents/skills/`;
- `~/.config/opencode/AGENTS.md`, `~/.config/opencode/agent/`,
  `~/.config/opencode/commands/`;
- `~/.factory/AGENTS.md`, `~/.factory/droids/`, `~/.factory/skills/`,
  `~/.factory/commands/`, `~/.factory/mcp.json`, `~/.factory/settings.json`;
- `~/.pi/agent/` extension and skill manifests.

External automation surfaces (inspect only when relevant):

- cron, LaunchAgents/LaunchDaemons, `.github/workflows/`, task runners,
  configured reminder/calendar tools, Linear automations.

Use `skills-manage` (the `skills` CLI wrapper) when an inventory of installed
skills across agents is helpful — it avoids hand-crawling the directories
above.

Include a short "searched locations" note in the final report.

## Confidence

Act only on **high confidence** in fully automatic mode. Recommend
**medium confidence** candidates. Mark **low confidence** as needing more
evidence.

- High: 3+ relevant sessions across 2+ dates, OR repeated across 2+ agents,
  OR strong memory plus session evidence of a stable recurring workflow.
- Medium: 2 relevant sessions, OR 1 large costly workflow with clear evidence
  of recurrence, OR strong notes/memory but limited transcript evidence.
- Low: 1 occurrence; weak project match; unclear procedure; mostly inferred
  from noisy transcript text.

A candidate qualifies for action only when it:

- occurred at least twice, or is clearly likely to recur and costly to repeat;
- has stable inputs, a repeatable procedure, and a clear output or stopping
  condition;
- would materially improve speed, quality, consistency, or reliability;
- is not already adequately covered.

## Packaging Decision

Choose the smallest appropriate form:

- **Skill** — reusable workflow, checklist, or playbook.
- **Subagent / custom agent / droid** — bounded specialist role or
  investigation task suitable for delegation.
- **Command** — user-invoked workflow with stable arguments.
- **Automation** — scheduled or recurring check, report, reminder, or monitor.
- **Extend existing** — improve an existing asset rather than duplicating it.
- **Memory/instruction update** — stable preference, project convention, or
  known pitfall.
- **Skip** — one-off, ambiguous, sensitive, already covered, or poorly
  evidenced.

Prefer portable assets. Use agent-specific formats only when the workflow
genuinely depends on that runtime.

## Privacy

Treat local session and memory files as sensitive plaintext.

Never quote or expose:

- secrets, tokens, keys, cookies, credentials, or private URLs;
- private message contents unrelated to the workflow;
- sensitive customer, personal, or proprietary details;
- large raw transcript excerpts.

Summarize sensitive evidence abstractly, for example: "two sessions involved
repeated release-note cleanup for the same repo," without revealing private
content.

## Workflow

1. Resolve mode, selected agents, date range, and project/global scope from
   the user's request. If unspecified, apply the defaults above and state
   them in the output. Ask only when scope is genuinely ambiguous or when a
   side effect would require approval that is not yet given.
2. Read applicable `AGENTS.md`/`CLAUDE.md` and relevant project patterns.
3. Use available skills for prompt composition, skill creation,
   instruction-file maintenance, and asset edits.
4. Locate required evidence sources using
   [references/agent-locations.md](references/agent-locations.md). Note which
   optional sources are present.
5. Build a compact evidence index using the transcript parsing rules. Start
   from metadata, user prompts, and summaries (compacted, task, and final).
   When summaries are absent, too thin, or ambiguous, fall back to bounded
   message windows or excerpts — only around the candidate signals and only
   for candidate verification, not for bulk reading. Never load full
   transcripts.
6. Identify repeated candidate workflows across coding, research, writing,
   planning, communication, operations, analysis, personal administration,
   and agent setup/maintenance.
7. Check existing coverage before recommending anything new.
8. Produce the shortlist (format below).
9. Branch on mode:
   - `recommendations only` → stop after the shortlist and final report;
   - `user-in-the-loop` → request approval before any edit;
   - `fully automatic` → create or extend only high-confidence missing local
     assets, using related skills (`skill-create`, `agents-md-maintain`,
     `prompt-craft`).
10. Verify any created or modified asset is narrow, practical, source-aware,
    non-duplicative, and easy to validate.

## Output Contract

First, a compact shortlist. One row per candidate:

```markdown
- **Workflow**: <short label>
  - Agents: <codex|claude-code|...>
  - Evidence: <count, dates, abstract summary>
  - Confidence: <high|medium|low>
  - Existing coverage: <none | path/name>
  - Recommended form: <skill|subagent|command|automation|memory update|extend X|skip>
  - Rationale: <why it is or is not worth packaging>
```

Then proceed according to mode.

Finish with a final report:

- mode used;
- agents scanned;
- date range;
- project/global scope;
- searched locations;
- what was created or extended (if anything);
- what was deliberately skipped;
- what needs more evidence;
- source limitations: missing histories, disabled memories, inaccessible
  plugins, cloud-only gaps.

## Examples

Good triggers:

- "Look at my Codex and Claude Code history for this repo and tell me what I
  should turn into a skill."
- "Audit my recent agent workflows. What's worth automating?"
- "Find repeated workflows across my Codex sessions from the last month."
- "Recommendations only — what skills am I missing?"

Near miss:

- "Create a skill for X." → Use `skill-create` directly.
- "Update CLAUDE.md." → Use `agents-md-maintain`.
- "Summarize what I did yesterday." → Not an audit; this skill is about
  recurring patterns, not single-session recall.

## Related Skills

- `skill-create` — when packaging a candidate as a new skill.
- `agents-md-maintain` — when the right form is a memory/instruction update.
- `prompt-craft` — when writing trigger descriptions, command prompts, or
  subagent system prompts for created assets.
- `skills-manage` — when inventorying installed skills or checking
  install-state across agents via the `skills` CLI.
