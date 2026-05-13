# Platform Notes

Last verified: 2026-05-13

## Scope

Use this reference when a skill needs compatibility with Codex, Claude Code, OpenCode, `skills.sh`, or plugin packaging.

## Portable Baseline

The safest shared baseline is:

- skill folder with `SKILL.md`;
- frontmatter with `name` and `description`;
- optional `references/`, `scripts/`, and `assets/`;
- no platform-specific frontmatter unless needed.

## Codex

- Direct repo skills are discovered from `.agents/skills`, but this repo keeps canonical skills under `skills/` and exposes them through plugin/installer metadata.
- Codex reads `name`, `description`, and the skill path for discovery, then loads `SKILL.md` after selection.
- `agents/openai.yaml` can add Codex UI metadata, default prompts, invocation policy, and tool dependencies.
- Codex plugin packaging uses `.codex-plugin/plugin.json` with `"skills": "./skills/"`.

## Claude Code

- Personal skills live under `~/.claude/skills`.
- Project skills live under `.claude/skills`.
- Plugin skills live under `skills/` inside a Claude plugin root and are invoked with the plugin namespace.
- Claude supports additional fields such as `allowed-tools`, `disable-model-invocation`, `user-invocable`, `context`, `agent`, hooks, and model/effort controls. Add these only when the skill intentionally needs Claude behavior.

## OpenCode

- OpenCode supports global skills in `~/.config/opencode/skill`, project skills in `.opencode/skill`, and also loads compatible Claude and Agent Skills directories.
- It recognizes `name`, `description`, `license`, `compatibility`, and `metadata` in frontmatter. Unknown frontmatter is ignored, but portable skills should not depend on ignored fields.
- OpenCode skills can be referenced with `@skill-name` in prompts.

## skills CLI

- `skills.sh` discovers `skills/<skill>/SKILL.md`, `.agents/skills`, `.claude/skills`, `.opencode/skills`, and other compatible folders.
- Use `DISABLE_TELEMETRY=1` or `DO_NOT_TRACK=1` for private repo operations.
- Use `npx skills add . --list` to confirm discovery before publishing.

## This Repo

- Canonical skill source: `skills/<skill-name>/`.
- Codex plugin namespace: `phntm`.
- Claude plugin namespace: `phntm`.
- Do not duplicate skills across platform folders unless testing an install path.

## Sources

- Codex skills: https://developers.openai.com/codex/skills/
- Codex plugins: https://developers.openai.com/codex/plugins/build
- Claude Code skills: https://code.claude.com/docs/en/skills
- Claude Code plugins: https://code.claude.com/docs/en/plugins
- OpenCode skills: https://opencode.ai/docs/skills/
- skills CLI docs: https://www.skills.sh/docs/cli
