---
name: skills-manage
description: >
  Use when discovering, installing, removing, updating, running, or scaffolding
  Agent Skills with the `skills` CLI; it applies correct scope, agent targeting,
  telemetry, and lockfile workflows.
---

# Skills Manage

Use this skill to drive the `skills` CLI for installing, removing, listing, searching, updating, running, syncing, or scaffolding Agent Skills. The CLI binary is installed locally; invoke it as `skills`, never `npx skills`.

## Preflight

1. Verify the CLI: `command -v skills && skills --version`.
2. If missing, install with the user's preferred manager and confirm before running. Detect `mise` first (`command -v mise`); if it is available and in active use, install with `mise use -g npm:skills`. Otherwise fall back to a global ecosystem install: `npm i -g skills` (or `pnpm add -g skills`, `bun add -g skills`, `yarn global add skills`).
3. Re-run `skills --version` to confirm. Stop and ask first if install requires sudo or rewrites a global package.
4. For private repos, prefix calls with `DISABLE_TELEMETRY=1`. See [references/telemetry-and-private-repos.md](references/telemetry-and-private-repos.md).

## Command Decision Rules

Pick the smallest command that fits the request.

| User intent | Command |
| --- | --- |
| Show what is installed | `skills list` (project) or `skills ls -g` (global) |
| Filter list by agent | `skills ls -a claude-code` |
| Machine-readable output | `skills ls --json` |
| Search the public catalog | `skills find [query]` |
| Use a skill once without installing | `skills use <source>@<skill>` (prints the prompt; `-a` launches an agent) |
| Install a published package | `skills add <owner>/<repo>` |
| Preview without installing | `skills add <source> --list` |
| Install one named skill | `skills add <source> --skill <name>` |
| Install everything from a repo | `skills add <source> --all` (alias for `--skill '*' --agent '*' -y`) |
| Install to all detected agents | omit `-a` (the CLI auto-detects installed agents) |
| Install to every supported agent | `skills add <source> -a '*'` (writes to all known agents, not only detected ones) |
| Install to specific agents | `skills add <source> -a claude-code codex` |
| Make it global | append `-g` |
| Copy instead of symlink | append `--copy` |
| Remove interactively | `skills remove` |
| Remove a specific skill | `skills remove <name>` (use `-g` for global) |
| Upgrade installed skills | `skills update -g <name>` or `skills update -p <name>`; always pass the scope (see Guardrails) |
| Scaffold a new skill | `skills init <name>` |
| Restore from `skills-lock.json` | `skills experimental_install` |
| Re-sync from `node_modules` | `skills experimental_sync` |

Source forms accepted by `add`:

- GitHub shorthand: `owner/repo`
- Full URL: `https://github.com/owner/repo`
- Subpath into a repo: `https://github.com/owner/repo/tree/main/skills/<name>`
- SSH: `git@github.com:owner/repo.git`
- Local path: `.` or `./relative/path`

## Find a Skill

When the user asks for a skill for some task, or asks whether one exists:

1. Check what is already installed: `skills ls -g --json` and the project's `skills ls --json`.
2. Search the public catalog: `skills find <keywords>` (add `--owner <owner>` to stay within one publisher). Browse https://skills.sh/ for install counts.
3. Before recommending a result, open its source repo and read its `SKILL.md`. Prefer known publishers and widely installed skills; treat unknown authors with few installs with care.
4. Present the skill name, what it does, its source, and the exact `skills add <source> --skill <name>` command. Install only after the user agrees.

## Run a Skill Without Installing

`skills use <source>[@<skill>]` resolves a skill the same way `add` does, writes it to a temporary directory, and prints only the generated prompt to stdout. It adds nothing to your agents or project — use it for a one-off when the user wants a skill's guidance now without installing it.

- Pipe the prompt into an agent: `skills use vercel-labs/agent-skills@web-design-guidelines | claude`
- Or select a skill and launch one supported agent interactively (`claude-code`, `codex`) with `-a`: `skills use vercel-labs/agent-skills --skill web-design-guidelines --agent claude-code`
- `--full-depth` searches nested directories, same as `add`.
- Accepts the same source forms as `add` (shorthand, URL, subpath, SSH, local path).

Prefer `skills use` over `add` when the skill is needed temporarily; reach for `add` only when it should persist for future sessions.

## Scope

- **Project (default for `add`)**: installs under the project's agent-specific dirs (e.g. `.claude/skills/`, `.agents/skills/`). Use when the skill should ship with the repo for teammates.
- **Global (`-g`)**: installs under user-level dirs (e.g. `~/.claude/skills/`, `~/.agents/skills/`). Use for personal tooling that should apply everywhere.

Follow the CLI default (project) unless the user explicitly asks for a personal or machine-wide install, in which case pass `-g`. When intent is ambiguous, ask before defaulting to global — global installs write to shared user-level state.

## Agent Targeting

- Omit `-a` to install to all agents the CLI detects on the system.
- Use `-a` to target specific agents. Multiple agents can be passed: `-a claude-code codex cursor`.
- Use `-a '*'` to force-install to every supported agent regardless of detection.
- Common flag names: `claude-code`, `codex`, `cursor`, `opencode`, `cline`, `windsurf`, `continue`, `gemini-cli`, `warp`, `github-copilot`, `openclaw`. Full matrix in [references/agents-matrix.md](references/agents-matrix.md).

## Examples

```bash
# Audit
skills ls --json | jaq '.[].name'
skills ls -g

# Install a public catalog into Claude Code and Codex globally, no prompts
skills add vercel-labs/agent-skills -g -a claude-code codex -y

# Preview what a repo offers without writing files
skills add owner/repo --list

# Run a skill once without installing (prints the prompt to stdout)
skills use vercel-labs/agent-skills@web-design-guidelines | claude

# Install one skill from a monorepo into the current project
skills add owner/repo --skill frontend-design -a claude-code

# Install this repo's skills as a private user-level install
DISABLE_TELEMETRY=1 skills add git@github.com:phntm7/skills.git \
  --skill '*' -g -a codex -a claude-code -y

# Remove a skill from global scope
skills rm --global frontend-design -y

# Refresh one global skill for chosen agents only: reinstall from its recorded source
DISABLE_TELEMETRY=1 skills add anthropics/skills --skill frontend-design -g -a claude-code codex

# Scaffold a new skill in the current directory
skills init my-skill
```

## Lockfile and Sync

- `skills-lock.json` (project root) pins installed skills for the project. Treat it like `package-lock.json`.
- `skills experimental_install` reads the lockfile and restores skills — use on fresh clones and in CI.
- `skills experimental_sync` re-materializes skills from `node_modules` into agent skill directories. Use after an `npm install`/`pnpm install` brought in skill packages that have not yet been wired into agents.
- Both commands are flagged experimental. Confirm with the user before relying on them in automation.

## Validation After Changes

After install/remove/update, confirm the new state:

```bash
skills list --json
skills ls -g --json
```

Spot-check that the expected skill directory exists for at least one targeted agent, e.g. `test -f ~/.claude/skills/<name>/SKILL.md`.

## Guardrails

- `skills check` is not a dry run: in CLI 1.7.x it dispatches to `update` and rewrites installed skills. There is no read-only update check; compare `skills ls -g --json` with the source repo instead.
- `skills update` cannot target agents: it reinstalls each skill to every agent the CLI detects. A named update without `-g` or `-p` touches both scopes. When agent targeting matters, refresh with `skills add <recorded-source> --skill <name> -g -a <agents>` instead; the source is in `~/.agents/.skill-lock.json` (global) or `skills-lock.json` (project).
- Prefer naming skills and agents explicitly (`--skill <name>`, `-a claude-code codex`). `--all` and `-a '*'` write to every supported agent, including ones that are not installed.
- Never invoke the CLI via `npx`; use `skills` directly. The user has it installed locally and `npx` may resolve a different version or hit the registry unnecessarily.
- Never auto-install global packages or modify PATH without explicit user confirmation. `mise`, `brew`, and global `npm` installs touch shared state.
- Use `-y` only when the user has expressed intent for non-interactive runs. Default to interactive on destructive operations (`remove`, `update`).
- Use `DISABLE_TELEMETRY=1` for any operation against a private repo, or export it from the shell when the user prefers persistent opt-out.
- If `--copy` was used at install time, future `update` runs may not propagate symlink-style fixes; warn the user.
- Do not edit installed skill files in the destination directories when symlinks are in use — edits should land in the source repo and propagate. With `--copy`, destination edits are local-only and `update` will overwrite them.
- When the user wants to author a new skill (not just install one), prefer the `skill-create` skill for the authoring workflow and use `skills init` only as the scaffold step.
- When `skills use` resolves unverified OpenClaw community skills, the CLI refuses unless `--dangerously-accept-openclaw-risks` is passed. Only pass it when the user explicitly accepts running unvetted community skill content.

## Related Skills

- `skill-create` — author or refine SKILL.md contents once scaffolded.
- `prompt-craft` — write the trigger description for a new skill.
- `agents-md-init` / `agents-md-maintain` — manage AGENTS.md/CLAUDE.md instead of installed skills.

## References

- [references/agents-matrix.md](references/agents-matrix.md) — supported agents, their CLI flags, and install paths.
- [references/telemetry-and-private-repos.md](references/telemetry-and-private-repos.md) — telemetry opt-out, private repo auth, SSH/HTTPS choices.

## Sources

- skills CLI docs: https://www.skills.sh/docs/cli
- skills CLI repo: https://github.com/vercel-labs/skills
- Agent Skills Specification: https://agentskills.io/specification
