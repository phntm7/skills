---
name: mise-manage
description: >
  Manage mise-en-place tool versions, mise.toml files, global ~/.config/mise/config.toml, backends, installs, updates, shims, and warnings. Use when the user asks about mise, mise up/install/use/exec, minimum_release_age, prereleases, npm/pipx/aqua/asdf/github backends, lifecycle-script warnings, stale version metadata, or failed tool resolution.
---

# Mise Manage

Use this skill to operate and debug `mise` as a tool-version manager. Prefer dry runs and config inspection before changing shared global state.

## Preflight

1. Verify the binary and active version:
   ```bash
   command -v mise && mise --version
   ```
2. Identify config scope before editing:
   ```bash
   mise config
   mise settings get minimum_release_age
   ```
3. Inspect the relevant config file directly when diagnosing config-driven behavior:
   - project: `mise.toml`
   - global: `~/.config/mise/config.toml`
4. Use `mise up --dry-run` before upgrades. Use `mise up --yes` only when the user asked for non-interactive changes.

## Command Decision Rules

| Intent | Command |
| --- | --- |
| Install configured tools | `mise install` |
| Install one configured tool | `mise install <tool>` |
| Add a tool to project config | `mise use <tool>@<version>` |
| Add a tool globally | `mise use --global <tool>@<version>` |
| Run a one-off tool/version | `mise exec <tool>@<version> -- <command>` |
| Run inside active mise context | `mise exec -- <command>` |
| Check latest resolvable version | `mise latest <tool>` |
| List remote versions | `mise ls-remote <tool>` |
| Upgrade installed/configured tools | `mise up` |
| Preview upgrade | `mise up --dry-run` |
| Rewrite config to newer versions | `mise up --bump` |
| Remove installed versions | `mise uninstall <tool>@<version>` or `mise uninstall --all <tool>` |
| Refresh stale resolver data | `mise cache clear` |
| Rebuild shims | `mise reshim` |
| Health check shell integration | `mise doctor` |

## Config Patterns

Global tools live under `[tools]` in `~/.config/mise/config.toml`; project tools live in `mise.toml`.

```toml
[tools]
node = "24"
pnpm = "latest"
"npm:@anthropic-ai/claude-code" = "latest"
"pipx:black" = "latest"
"github:BurntSushi/ripgrep" = "latest"
```

Use table entries when a backend needs options:

```toml
[tools]
"npm:some-cli" = { version = "latest", npm_args = "--ignore-scripts=false" }
"pipx:harlequin" = { version = "latest", extras = "postgres,s3" }
```

## Release-Age and Prerelease Handling

`minimum_release_age` reduces supply-chain risk by ignoring versions newer than the configured age. mise defaults to a delay when the setting is absent. To disable it globally:

```toml
[settings]
minimum_release_age = "0s"
```

or:

```bash
mise settings set minimum_release_age 0s
```

For selective bypasses:

```toml
[settings]
minimum_release_age = "7d"
minimum_release_age_excludes = ["npm:*", "trivy"]
```

For one tool:

```toml
[tools.trivy]
version = "latest"
minimum_release_age = "0s"
```

Prereleases are separate from release age. Global prerelease opt-in:

```toml
[settings]
prereleases = true
```

Per-tool `prerelease = true` is documented for `github:`, `forgejo:`, `aqua:`, and `dotnet:` backends. Do not assume it changes `npm:` resolution without testing against the current mise version.

## Troubleshooting Update Warnings

When `mise up` says a newer release is ignored by `minimum_release_age`:

1. Confirm the active setting:
   ```bash
   mise settings get minimum_release_age
   mise latest --minimum-release-age 0s <tool>
   ```
2. Clear resolver caches once before concluding:
   ```bash
   mise cache clear
   mise latest --minimum-release-age 0s <tool>
   ```
3. Compare with the upstream registry:
   ```bash
   npm view <package> version time --json
   ```
4. If `minimum_release_age = "0s"` still returns the old version, treat it as stale/missing mise remote metadata or backend limitations, not a config failure. Report the evidence: active setting, `mise latest` result, upstream latest version, and whether cache clear changed anything.

When `mise` cannot resolve an npm package that was renamed, verify both package names against the npm registry. Example from this session: `npm:@sourcegraph/amp` stopped resolving under the date filter because Amp moved to `npm:@ampcode/cli`. Replace the tool key, install the new package, then uninstall the old package:

```toml
[tools]
"npm:@ampcode/cli" = { version = "latest", npm_args = "--ignore-scripts=false" }
```

```bash
mise install 'npm:@ampcode/cli'
mise uninstall --all 'npm:@sourcegraph/amp'
mise list 'npm:@sourcegraph/amp'
```

## Backend-Specific Failure Patterns

### npm backend

mise may skip lifecycle scripts with `--ignore-scripts=true`. This is safer by default because lifecycle scripts execute package code during install.

Before opting in:

1. Read the package's `package.json` `scripts` block.
2. Read the referenced script files if they exist in the installed package or source package.
3. Prefer package-level `allow_builds` when using `aube` or `pnpm`; use `npm_args = "--ignore-scripts=false"` only when the selected CLI requires its own scripts and the package is trusted.

```toml
"npm:some-cli" = { version = "latest", npm_args = "--ignore-scripts=false" }
"npm:some-cli" = { version = "latest", allow_builds = ["esbuild"] }
```

### pipx backend with uv

mise uses `uv tool install` when `uv` is available. `minimum_release_age` is forwarded into Python dependency resolution, and packages with prerelease-only transitive dependencies can fail even when the top-level package is stable.

If uv reports a prerelease dependency conflict, prefer an explicit prerelease dependency over broad prerelease allowance:

```toml
"pipx:markitdown" = {
  version = "latest",
  extras = "all",
  uvx_args = "--with azure-ai-contentunderstanding==1.2.0b2 --prerelease explicit",
}
```

Use broad `--prerelease allow` only when the user accepts prereleases throughout the tool environment. Avoid `--index-strategy unsafe-best-match` unless all configured Python indexes are equally trusted.

### aqua and GitHub release backends

SLSA or release-tag failures can be backend-specific. Example failure shape:

```text
SLSA verification error ... Failed to get release ... /releases/tags/<owner>/<repo>@<version>
```

That usually means the backend constructed a tag name GitHub does not expose. Verify upstream tags/releases, then switch backend if the same binary is available through a reliable plugin:

```bash
mise registry <tool>
mise ls-remote <tool>
mise latest 'asdf:<plugin-owner>/<plugin-name>'
```

Example replacement pattern from this session:

```toml
# Instead of a broken aqua resolution for Bitwarden Secrets Manager:
"asdf:asdf-community/asdf-bitwarden-secrets-manager" = "latest"
```

## Verification After Changes

After editing config or installing tools:

```bash
mise install <changed-tool>
mise exec -- <binary> --version
mise up --dry-run <changed-tool>
```

For global cleanup:

```bash
mise uninstall --all '<old-tool-key>'
mise list '<old-tool-key>'
```

For package-manager-backed CLIs, verify the actual binary name, not only the mise tool key.

## Guardrails

- Do not modify global config unless the user asks for global behavior or the current failure is in `~/.config/mise/config.toml`.
- Do not trust lifecycle scripts merely to silence warnings; inspect them first.
- Do not confuse release-age filtering with prerelease filtering.
- Do not keep compatibility shims for renamed tools unless the user explicitly needs both names.
- Do not use `--index-strategy unsafe-best-match` for uv unless the trust boundary is clear.
- Do not treat one cache-cleared retry as proof of a fixed upstream; verify with the upstream registry or release API.

## Output Contract

When reporting a mise diagnosis, include:

- changed config paths and exact tool keys;
- root cause per warning/error;
- commands run and observed result;
- remaining warnings separated from fixed warnings;
- whether any global state changed.

## Sources

- mise Getting Started: https://mise.jdx.dev/getting-started.html
- mise Settings: https://mise.jdx.dev/configuration/settings.html
- mise npm backend: https://mise.jdx.dev/dev-tools/backends/npm.html
- mise pipx backend: https://mise.jdx.dev/dev-tools/backends/pipx.html
