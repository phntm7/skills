# Personal Skills Repository

This repo is a private collection of personal agent skills. Keep `skills/` as the canonical source tree so the same skill folders can be consumed by Codex, Claude Code, and the `skills` CLI.

## Canonical Layout

```text
skills/
  <skill-name>/
    SKILL.md
    references/   # optional, detailed docs loaded on demand
    scripts/      # optional, executable helpers
    assets/       # optional, templates or static resources
    agents/       # optional, platform UI/dependency metadata
```

Each skill must have a `SKILL.md` with YAML frontmatter and Markdown instructions:

```yaml
---
name: <kebab-case-name>
description: What the skill does and when to use it.
---
```

Portable requirements:

- `name` is required for Codex and the Agent Skills spec. Use lowercase letters, numbers, and hyphens; keep it under 64 characters; avoid leading/trailing hyphens and repeated hyphens; match the parent directory name.
- `description` is required, non-empty, and should stay under 1024 characters. Front-load trigger words because tools use the description for automatic skill selection.
- Keep `SKILL.md` focused. Move long reference material into files linked from `SKILL.md`.
- Use optional frontmatter such as `compatibility`, `metadata`, and `allowed-tools` sparingly because agent support varies.
- Prefer portable fields first. Platform-specific fields such as Claude Code `context`, `agent`, `disable-model-invocation`, and `user-invocable` should be added only when the skill intentionally needs that runtime behavior.
- Use `references/` for long context, `scripts/` for deterministic helpers, `assets/` for reusable templates/static files, and `agents/openai.yaml` for Codex-specific interface metadata.

## Codex

Codex can read direct skills and plugin-packaged skills.

- Current Codex interface metadata lives at `skills/<skill>/agents/openai.yaml`; keep `default_prompt` examples aligned with actual skill names.
- Direct repo-scoped Codex skills normally live under `.agents/skills`, but this repo keeps `skills/` as canonical and uses plugin/installer metadata for distribution.
- Direct personal skills can be installed into user-level skill locations with `$skill-installer` or the `skills` CLI.
- Codex plugin packaging uses `.codex-plugin/plugin.json`; this repo's manifest points Codex at `./skills/`.
- The repo-level Codex marketplace at `.agents/plugins/marketplace.json` exposes this repo as a local/Git-backed private plugin catalog.
- The Codex plugin namespace is `phntm`. Namespacing applies to plugin-packaged skills, not to normal standalone installs through the `skills` CLI.

Useful commands:

```bash
# List skills visible to the skills CLI from this repo
DISABLE_TELEMETRY=1 npx skills add . --list

# Install all skills globally into Codex and Claude Code via the skills CLI
DISABLE_TELEMETRY=1 npx skills add git@github.com:phntm7/skills.git --skill '*' -g -a codex -a claude-code -y

# Add this repo as a Codex plugin marketplace
codex plugin marketplace add git@github.com:phntm7/skills.git
```

For a private GitHub repo, prefer SSH URLs if local SSH auth is already configured. Codex's skill installer can also use existing git credentials or `GITHUB_TOKEN`/`GH_TOKEN` for private repos.

## Claude Code

Claude Code supports standalone skills and plugin-packaged skills.

- Personal standalone skills live in `~/.claude/skills/<skill>/SKILL.md`.
- Project standalone skills live in `.claude/skills/<skill>/SKILL.md`.
- Plugin skills live in `skills/<skill>/SKILL.md` inside a plugin root. Current skill names are unprefixed in `SKILL.md`; plugin invocation adds the `phntm` namespace, for example `/phntm:skill-create`.
- Claude plugin packaging uses `.claude-plugin/plugin.json`; this repo's manifest treats the repo root as the plugin root.
- The Claude marketplace file at `.claude-plugin/marketplace.json` exposes this repo as a private marketplace with one plugin.

Useful commands:

```bash
# Test the plugin directly from a local clone
claude --plugin-dir .

# In Claude Code, add the private marketplace, then install the plugin
/plugin marketplace add git@github.com:phntm7/skills.git
/plugin install phntm@phntm
```

## skills CLI

The `skills` CLI already discovers the current repo shape because it scans `skills/<skill>/SKILL.md`.

Important behavior:

- `npx skills add . --list` detects local skills without installing them.
- `--skill '*'` installs all discovered skills.
- `-a codex -a claude-code` targets Codex and Claude Code.
- `--copy` copies files instead of symlinking.
- `--full-depth` searches nested skill trees more aggressively if a root `SKILL.md` ever exists.
- Standalone installs keep the skill's own `name`, such as `prompt-craft`; they do not use the `phntm` plugin namespace.

Telemetry:

- `skills` telemetry is enabled by default for public installs and can include skill names, source, agents, and skill file paths.
- In `skills@1.5.6`, telemetry is disabled when either `DISABLE_TELEMETRY` or `DO_NOT_TRACK` is present in the environment.
- There is no persistent `skills telemetry disable` command in the current CLI help. To disable globally, export one of those variables from the shell environment, preferably in `~/.zshenv` if every zsh process should inherit it:

```bash
export DISABLE_TELEMETRY=1
# or use the broader console opt-out convention:
export DO_NOT_TRACK=1
```

For one-off private repo operations, prefix commands with `DISABLE_TELEMETRY=1`.

## Maintenance Checklist

- Commit and push `skills/`; remote installs only see committed files.
- Keep root `skills/` canonical. Avoid duplicating the same skills under `.agents/skills` or `.claude/skills` in this repo unless a specific local workflow requires it.
- Keep `.codex-plugin/plugin.json`, `.claude-plugin/plugin.json`, `.agents/plugins/marketplace.json`, and `.claude-plugin/marketplace.json` in sync with the repo's skill collection and version.
- Keep `skills/<skill>/agents/openai.yaml` prompts accurate when renaming skills or changing their trigger behavior.
- Bump plugin versions when publishing meaningful manifest or skill changes through plugin marketplaces.
- Validate discovery before publishing:

```bash
DISABLE_TELEMETRY=1 npx skills add . --list
for skill in skills/*; do python3 skills/skill-create/scripts/validate_skill.py "$skill"; done
python3 -m json.tool .codex-plugin/plugin.json >/dev/null
python3 -m json.tool .claude-plugin/plugin.json >/dev/null
python3 -m json.tool .agents/plugins/marketplace.json >/dev/null
python3 -m json.tool .claude-plugin/marketplace.json >/dev/null
```

## Sources

- Agent Skills Specification: https://agentskills.io/specification
- Codex skills: https://developers.openai.com/codex/skills/
- Codex plugins: https://developers.openai.com/codex/plugins/build
- Claude Code skills: https://code.claude.com/docs/en/skills
- Claude Code plugins: https://code.claude.com/docs/en/plugins
- Claude Code plugin reference: https://code.claude.com/docs/en/plugins-reference
- Claude Code plugin marketplaces: https://code.claude.com/docs/en/plugin-marketplaces
- skills CLI docs: https://www.skills.sh/docs/cli
- skills CLI repository: https://github.com/vercel-labs/skills
- Console `DO_NOT_TRACK` convention: https://donottrack.sh/
