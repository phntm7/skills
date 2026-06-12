# Agents Matrix

The `skills` CLI claims support for 70+ agents (71 at CLI v1.5.11). The flag passed to `-a` is the agent slug shown below. Project install paths are written under the current repo; global paths are written under the user's home.

## Common Flags

| Flag | Agent | Project path | Global path |
| --- | --- | --- | --- |
| `claude-code` | Anthropic Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| `codex` | OpenAI Codex CLI | `.agents/skills/` | `~/.codex/skills/` |
| `cursor` | Cursor | `.agents/skills/` | `~/.cursor/skills/` |
| `opencode` | OpenCode | `.agents/skills/` | `~/.config/opencode/skills/` |
| `cline` | Cline | `.agents/skills/` | `~/.agents/skills/` |
| `windsurf` | Windsurf | `.windsurf/skills/` | `~/.codeium/windsurf/skills/` |
| `continue` | Continue.dev | `.continue/skills/` | `~/.continue/skills/` |
| `gemini-cli` | Gemini CLI | `.agents/skills/` | `~/.gemini/skills/` |
| `warp` | Warp | `.agents/skills/` | `~/.agents/skills/` |
| `github-copilot` | GitHub Copilot | `.agents/skills/` | `~/.copilot/skills/` |
| `openclaw` | OpenClaw | `skills/` | `~/.openclaw/skills/` |

Paths and slugs can change between releases. Verify with `skills list -g --json` against a known install before trusting them in scripts.

## Targeting Rules

- Omit `-a` for auto-detection: the CLI installs to agents it can detect on the system.
- Pass one or more flags space-separated: `-a claude-code codex`.
- `-a '*'` forces install to every supported agent, regardless of detection. Use sparingly — it litters unrelated directories.
- Combine with `-s '*'` (or `--all`) to install every skill from the source to every targeted agent.

## Feature Compatibility (high level)

- **Basic skills (SKILL.md + frontmatter)**: supported by all listed agents.
- **`allowed-tools` frontmatter**: supported by most agents; Kiro CLI and Zencoder are known holdouts.
- **`context: fork`**: Claude Code only.
- **Hooks**: Claude Code, Cline, Kiro CLI.

Refer to the CLI README's compatibility section for the authoritative matrix at the version installed.

## Discovery Locations Inside a Source Repo

When `skills add <source>` runs, the CLI searches the source repo for skills in:

- Repo root (if it contains `SKILL.md`)
- `skills/`
- `skills/.curated/`, `skills/.experimental/`, `skills/.system/`
- Agent-specific directories such as `.claude/skills/` and `.agents/skills/`
- `.claude-plugin/marketplace.json` and `.claude-plugin/plugin.json` (plugin manifests)
- Recursive search if none of the above contain `SKILL.md`

Use `--full-depth` to force the recursive search even when a root-level `SKILL.md` exists.
