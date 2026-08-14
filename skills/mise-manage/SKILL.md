---
name: mise-manage
description: >
  Use when installing, pinning, upgrading, or troubleshooting tools and runtimes
  managed by mise; it covers configuration, backends, lockfiles, environments, and supply-chain controls.
---

# Mise Manage

`mise` (mise-en-place) is a polyglot tool-version manager, environment manager, and task runner. Use this skill to install, pin, upgrade, and debug tools globally and per project. Prefer config inspection and dry runs before mutating shared global state.

## Mental Model

- **Backends** are the package ecosystems mise installs from: `core` (node, python, …), `aqua`, `github`, `npm`, `pipx`, `cargo`, `go`, `ubi`, `asdf`, `vfox`, `http`, and more. A tool key is `backend:name` (e.g. `npm:prettier`); registry shorthands like `node` or `ripgrep` resolve to a default backend.
- **Config** is hierarchical TOML. Project config lives in `mise.toml`; global config in `~/.config/mise/config.toml`. Files closer to the working directory override parents; sections merge (see Config Files).
- **Activation modes** decide how tools reach `PATH`:
  - `mise activate` (shell hook) — interactive shells; updates `PATH`/env on prompt and `cd`.
  - shims (`mise activate --shims`) — CI, IDEs, scripts; symlinks that resolve versions on call. Shims do not support every feature of `activate` (see [shims](https://mise.jdx.dev/dev-tools/shims.html)).
  - none — prefix commands with `mise exec --` / `mise x --`, or run via `mise run`.
- **Trust**: mise refuses to parse a `mise.toml` that may run code (env directives, tasks, hooks) until it is trusted. After creating or editing such a config, run `mise trust` (or `mise trust <file>`). In detected CI mise assumes trust unless [paranoid mode](https://mise.jdx.dev/paranoid.html) is on.

## Preflight

1. Confirm the binary and version: `command -v mise && mise --version`.
2. See which config files are loaded and in what order: `mise config` (alias `mise cfg`).
3. Inspect the file you intend to change directly — project `mise.toml` or global `~/.config/mise/config.toml`.
4. Check active vs configured versions: `mise ls --current`. Check what is outdated: `mise outdated`.
5. Preview upgrades with `mise up --dry-run` before mutating. Use `--yes` only when the user asked for non-interactive changes.

## Core Workflows

### Add or pin a tool

- **Per project**: `mise use <tool>@<version>` — installs, activates, and writes the version to the project `mise.toml`.
- **Globally** (user default): `mise use --global <tool>@<version>` (`-g`) — writes to `~/.config/mise/config.toml`.
- Editing the TOML by hand is equivalent; run `mise install` afterward to install newly added tools.
- `mise use` writes to the **lowest-precedence file in the highest-precedence directory** (so `mise.toml` over `mise.local.toml`). Target another file with `mise use --path <file>` or `mise use --env <name>`.

```bash
mise use node@24                  # project: pin node 24
mise use -g npm:@anthropic-ai/claude-code  # global CLI from npm backend
mise install                      # install everything in config (no version change)
mise exec node@22 -- node -v      # one-off, installs on demand, no config write
```

### Upgrade tools

- `mise outdated` — show what can move.
- `mise upgrade [tool]` (alias `mise up`) — upgrade within the configured range; updates `mise.lock` if present, leaves `mise.toml` ranges untouched.
- `mise upgrade --bump [tool]` — also rewrite `mise.toml` to the newer prefix.
- `mise upgrade <tool>@<exact>` — move to a specific version (bumps the config prefix only if it no longer matches).

### Inspect & remove

- `mise latest <tool>` / `mise ls-remote <tool>` — newest resolvable / all remote versions.
- `mise ls [tool]` — installed versions; `mise where <tool>` — install path; `mise which <bin>` — resolved binary.
- `mise uninstall <tool>@<version>` or `mise uninstall --all <tool>` — remove installs.
- `mise unuse <tool>` — remove from config; `mise prune` — drop installs not referenced by any config.

### Command decision table

| Intent | Command |
| --- | --- |
| Install all configured tools | `mise install` |
| Install/pin one tool in project config | `mise use <tool>@<ver>` |
| Install/pin one tool globally | `mise use -g <tool>@<ver>` |
| Run a one-off tool/version | `mise exec <tool>@<ver> -- <cmd>` |
| Run a command in the mise env | `mise exec -- <cmd>` (alias `mise x`) |
| Run a task / script with the env | `mise run <task>` (alias `mise r`) |
| Newest resolvable version | `mise latest <tool>` |
| All remote versions | `mise ls-remote <tool>` |
| What is outdated | `mise outdated` |
| Upgrade within range | `mise up [tool]` |
| Preview an upgrade | `mise up --dry-run` |
| Rewrite config to newer versions | `mise up --bump` |
| Remove an installed version | `mise uninstall <tool>@<ver>` / `--all <tool>` |
| Remove from config | `mise unuse <tool>` |
| Generate/refresh a lockfile | `mise lock` |
| Get/set/unset an env var | `mise set K=V` / `mise unset K` |
| Trust a config after editing | `mise trust` |
| Refresh stale resolver data | `mise cache clear` |
| Rebuild shims | `mise reshim` |
| Health-check integration | `mise doctor` (alias `mise dr`) |
| Find the right tool name | `mise registry` / `mise search <q>` |

CLI reference: <https://mise.jdx.dev/cli/>.

## Config Files

Project config resolves in this precedence (top wins), merged up the directory tree (see [configuration](https://mise.jdx.dev/configuration.html)):

- `mise.local.toml` (do not commit), then `mise.toml`, then `mise/config.toml`, `.mise/config.toml`, `.config/mise.toml`, `.config/mise/config.toml`, `.config/mise/conf.d/*.toml`. `mise.<env>.toml` (with `MISE_ENV`) layers in too.
- Global: `~/.config/mise/config.toml`. System: `/etc/mise/config.toml`.

Merge behavior: `[tools]`, `[env]`, `[settings]` are additive with overrides; each `[tasks.*]` is replaced wholesale by the closer file.

```toml
[tools]
node = "24"                                    # registry shorthand → core backend
pnpm = "latest"
"npm:@anthropic-ai/claude-code" = "latest"     # explicit backend
"pipx:black" = "latest"
"github:BurntSushi/ripgrep" = "latest"
# Table form when a tool needs options:
"pipx:harlequin" = { version = "latest", extras = "postgres,s3" }
ripgrep = { version = "latest", os = ["linux", "macos"] }   # OS/arch gating
"pipx:ruff" = { version = "latest", depends = ["python"] }  # install ordering
node = { version = "22", postinstall = "corepack enable" }  # per-tool postinstall
```

- **Version specs**: exact (`22.5.0`), prefix (`22`), `latest`, `lts`. Scopes: `prefix:`, `ref:<sha>`, `path:<dir>`, `sub-N:<ver>`. Pinned exact versions bypass `minimum_release_age`.
- **Idiomatic version files** (`.nvmrc`, `.python-version`, `.go-version`, `package.json`, …) are read but **disabled by default**; enable per tool with `mise settings add idiomatic_version_file_enable_tools <tool>`.
- `.tool-versions` (asdf format) is supported for compatibility; prefer `mise.toml`.
- Validate against the schema at <https://mise.jdx.dev/schema/mise.json> for editor autocompletion.

## Backends

Choosing a backend matters for reliability and supply-chain trust. Tiers (per the [registry](https://mise.jdx.dev/registry.html)):

- **Preferred**: `aqua` (built-in Cosign/SLSA/attestation verification, no plugin), `github`, `gitlab`.
- **Runtime-coupled, use sparingly**: `npm`, `pipx`, `gem`, `go`, `cargo`, `dotnet` — each needs its runtime on `PATH` and silently binds to whichever `node`/`python`/`ruby`/etc. was active at install time.
- **Discouraged / legacy**: `ubi` is deprecated; new `asdf` and `vfox` tools are not accepted into the registry for supply-chain reasons (still installable with explicit syntax).

Select or override a backend:

```bash
mise registry <tool>            # show available backends for a tool
mise use aqua:cli/cli           # force a specific backend
mise settings disable_backends=asdf
export MISE_BACKENDS_PHP='vfox:mise-plugins/vfox-php'   # highest-priority override
```

For per-backend install syntax, options, and the failure patterns hit when maintaining real installs (npm lifecycle-script approvals, pipx/uv prerelease conflicts, aqua/github SLSA tag errors, renamed packages), read [references/backends.md](references/backends.md).

## Supply-Chain Controls

- **`minimum_release_age`** ignores versions newer than a configured age to dodge compromised fresh releases (Renovate-style). mise applies a built-in default when unset. It affects fuzzy resolution only; pinned exact versions bypass it. For `npm:` and `pipx:` it also constrains transitive dependencies during install.

  ```toml
  [settings]
  minimum_release_age = "7d"
  minimum_release_age_excludes = ["npm:*", "trivy"]   # backend wildcards / shorthands / full IDs
  [tools.trivy]
  version = "latest"
  minimum_release_age = "1d"   # per-tool override
  ```

  Precedence: `--minimum-release-age` flag > per-tool > global. Disable globally with `minimum_release_age = "0s"`.
- **Prereleases** are separate from release age. Opt in globally with `[settings] prereleases = true`, or per tool with `prerelease = true` (documented for `github:`, `forgejo:`, `aqua:`, `dotnet:`). Do not assume it changes `npm:`/`pipx:` resolution without testing.
- **Verification**: aqua tools verify Cosign/Minisign signatures, SLSA provenance, and GitHub attestations automatically. See [security](https://mise.jdx.dev/security.html).

When `mise up` reports a newer release is ignored, or a tool stops resolving, follow the diagnosis playbook in [references/troubleshooting.md](references/troubleshooting.md) before concluding it is a config bug.

## Lockfiles & Reproducibility

`mise.lock` pins exact versions and (backend-permitting) checksums/URLs. It is **not created automatically**: enable it, then generate.

```bash
mise settings lockfile=true   # or [settings] lockfile = true
mise lock                     # generate/refresh mise.lock for all tools
mise install                  # install exact locked versions
```

- Commit `mise.lock` and any `mise.<env>.lock`; gitignore `mise.local.lock`.
- `locked = true` (or `MISE_LOCKED=1`) requires every tool to have a pre-resolved URL in the lockfile — fully offline/reproducible CI. Note: `locked` is **global in scope**, so it also covers global config tools; run `mise lock -g` if global tools warn.
- Checksum/URL support is full for `aqua`/`http`/`github`/`gitlab`, version-only for `npm`/`cargo`/`pipx`/`asdf`. See [mise.lock](https://mise.jdx.dev/dev-tools/mise-lock.html).

## Feature Map

mise does more than tool versions. Reach for these and read the linked docs when the task needs them:

- **Environment variables** — `[env]` per directory, `mise set/unset`, lazy `tools = true` eval, `required = true`, redactions: <https://mise.jdx.dev/environments/>
- **Secrets** — fnox (recommended), sops, or inline age encryption: <https://mise.jdx.dev/environments/secrets/>
- **Tasks** — TOML tasks and standalone script tasks, parallel deps, sources/outputs: <https://mise.jdx.dev/tasks/> ; `mise watch` for rebuild-on-change: <https://mise.jdx.dev/cli/watch.html>
- **Shims vs activate** — when to use each: <https://mise.jdx.dev/dev-tools/shims.html>
- **Tool stubs** — self-contained executable shims pinning a tool: <https://mise.jdx.dev/dev-tools/tool-stubs.html>
- **Hooks** — run commands on `cd`/enter/leave/preinstall/postinstall: <https://mise.jdx.dev/hooks.html>
- **Templates** — Tera templating inside config values: <https://mise.jdx.dev/templates.html>
- **Settings** — full settings list and env-var equivalents: <https://mise.jdx.dev/configuration/settings.html>
- **Registry** — browse aliased tools: <https://mise.jdx.dev/registry.html> (`mise registry`, `mise search`)
- **Config environments** — `mise.<env>.toml` with `MISE_ENV`, platform auto-envs: <https://mise.jdx.dev/configuration/environments.html>
- **CI** — caching and setup: <https://mise.jdx.dev/continuous-integration.html> (or [mise-action](https://github.com/jdx/mise-action))
- **IDE integration**: <https://mise.jdx.dev/ide-integration.html> · **direnv**: <https://mise.jdx.dev/direnv.html> · **shell aliases**: <https://mise.jdx.dev/shell-aliases.html>
- **MCP server** — expose mise to agents: <https://mise.jdx.dev/mcp.html>
- **Trust & paranoid mode**: <https://mise.jdx.dev/cli/trust.html> · <https://mise.jdx.dev/paranoid.html>
- **Cache behavior** (and `mise cache clear`): <https://mise.jdx.dev/cache-behavior.html>
- **FAQ / troubleshooting**: <https://mise.jdx.dev/faq.html> · <https://mise.jdx.dev/troubleshooting.html>

## Verification After Changes

```bash
mise install <changed-tool>       # install the edited entries
mise exec -- <binary> --version   # confirm the real binary, not just the tool key
mise up --dry-run <changed-tool>  # confirm resolution is clean
mise ls --current                 # confirm active versions
```

For package-manager-backed CLIs, verify the actual binary name (e.g. `npm:@ampcode/cli` provides `amp`), not only the mise tool key. After global cleanup, confirm removal: `mise uninstall --all '<old-key>' && mise ls '<old-key>'`.

## Guardrails

- Do not edit global config unless the user asked for global behavior or the failure is in `~/.config/mise/config.toml`. Default tool changes to the project `mise.toml`.
- After editing a config with env/tasks/hooks, trust it (`mise trust`) so mise will parse it.
- Prefer `aqua`/`github` backends over `npm`/`pipx`/`asdf`/`vfox`/`ubi` when a tool is available through more than one.
- Do not enable lifecycle scripts (`npm_args = "--ignore-scripts=false"`, `allow_builds`, `--trust`) just to silence a warning — inspect the scripts first; they execute package code at install time.
- Do not confuse release-age filtering with prerelease filtering; they are independent settings.
- Do not keep compatibility shims for renamed tools unless the user needs both names — migrate and uninstall the old key.
- One cache-cleared retry is not proof of an upstream fix; corroborate with the upstream registry/release API.
- Do not use uv `--index-strategy unsafe-best-match` unless every configured index is equally trusted.

## Output Contract

When reporting a mise change or diagnosis, include:

- changed config paths and exact tool keys (project vs global);
- root cause per warning/error;
- commands run and observed results;
- fixed warnings separated from remaining warnings;
- whether any global state changed and whether a config needs trusting.

## Sources

- Getting started: <https://mise.jdx.dev/getting-started.html>
- Dev tools & tool options: <https://mise.jdx.dev/dev-tools/>
- Configuration: <https://mise.jdx.dev/configuration.html>
- Backends index: <https://mise.jdx.dev/dev-tools/backends/>
- Settings: <https://mise.jdx.dev/configuration/settings.html>
- Security & verification: <https://mise.jdx.dev/security.html>
- Lockfiles: <https://mise.jdx.dev/dev-tools/mise-lock.html>
- CLI reference: <https://mise.jdx.dev/cli/>
