# Backends Reference

Per-backend install syntax, key options, and the failure patterns that show up when maintaining real installs. Load this when choosing a backend or debugging a backend-specific install. Backends index: <https://mise.jdx.dev/dev-tools/backends/>.

## Selection Priority

When a tool is available from more than one backend, prefer in this order:

1. **`aqua`** — built-in Cosign/Minisign/SLSA/GitHub-attestation verification, no plugin, full lockfile asset tracking. Default for most registry tools.
2. **`github` / `gitlab`** — for release binaries not in the aqua registry.
3. **runtime-coupled backends** (`npm`, `pipx`, `gem`, `go`, `cargo`, `dotnet`) — only when the tool is genuinely a package in that ecosystem. They require the runtime on `PATH` and bind to whichever runtime was active at install time.
4. **`asdf` / `vfox`** — plugin-based; not accepted for new registry entries (supply-chain). Use only when nothing better exists.
5. **`ubi`** — deprecated; avoid for new installs.

Inspect/override:

```bash
mise registry <tool>                 # backends available for a tool
mise use aqua:owner/repo             # force a backend
mise settings disable_backends=asdf  # turn a backend off (asdf off by default on Windows)
export MISE_BACKENDS_<TOOL>='vfox:owner/repo'   # SHOUTY_SNAKE_CASE; highest priority
```

Full backend docs: aqua, asdf, cargo, conda, dotnet, forgejo, gem, github, gitlab, go, http, npm, pipx, s3, spm, ubi, vfox — all under `https://mise.jdx.dev/dev-tools/backends/<name>.html`.

## npm backend

Docs: <https://mise.jdx.dev/dev-tools/backends/npm.html>. Installs node CLIs (one global package per entry).

```toml
[tools]
"npm:prettier" = "latest"
"npm:@anthropic-ai/claude-code" = "latest"
```

- **Package manager**: `npm.package_manager` defaults to `auto`, which installs with mise's embedded [aube](https://github.com/jdx/aube) — no node or package-manager CLI required, and version metadata is queried from the npm registry over HTTP. `"aube"` selects that same embedded installer explicitly; `"aube_cli"`, `"bun"`, `"pnpm"`, and `"npm"` shell out to that tool, which must then be installed. `npm.shell_out = true` forces the npm CLI for the `auto` path only — use it when you depend on npm-only configuration (`cafile`, client certificates, an auth token helper).
- **Lifecycle scripts execute package code at install time.** `allow_builds`, `trust_policy_excludes`, `pnpm_args`, `bun_args`, and `npm_args` only affect the package manager actually used; an approval option for one does nothing for another.
  - `aube` (embedded default) / `aube_cli` / `pnpm`: dependency build scripts are denied unless allowlisted. Prefer `allow_builds = ["esbuild"]` (one reviewed package) over blanket allowance; `allow_builds = true` allows every dependency build script (`--dangerously-allow-all-builds` on pnpm). On aube, `trust_policy_excludes` exempts reviewed packages from the `trustPolicy=no-downgrade` check.
  - `npm`: mise passes `--ignore-scripts=true` by default (safe). On npm >= 11.16.0, `allow_builds = ["<pkg>"]` is forwarded as `--allow-scripts=<pkg>` and mise drops `--ignore-scripts=true`, because npm's `ignore-scripts` setting overrides the allowlist. On older npm, `--ignore-scripts=true` stays and the only opt-in is per-tool `npm_args = "--ignore-scripts=false"`, which lets every package in the install graph run scripts — there is **no global `npm_args`**.
  - `bun`: does not run arbitrary dependency scripts by default, and `allow_builds` does not apply (mise's bun path is a global install and writes no per-transitive `trustedDependencies` allowlist). Pass `bun_args = "--trust"` only when you accept broad install-time trust.
- **Before opting in**: read the package's `package.json` `scripts` block and the referenced script files. Prefer a scoped `allow_builds` over enabling scripts wholesale.
- **`minimum_release_age` transitive support**: the embedded aube installer honors it natively. When shelling out it depends on the tool version — `pnpm >= 10.16.0`, `bun >= 1.3.0`, `npm >= 11.10.0` (`--min-release-age`, day-granular; npm 6.9.0–11.9.x and sub-day windows use `--before`). Older versions may fail on the forwarded flag.
- Options: `allow_builds`, `trust_policy_excludes` (aube only), `aube_args` (`aube_cli` only — ignored by the embedded installer), `pnpm_args`, `bun_args`, `npm_args`, `allow_low_downloads`, plus shared options (`os`, `depends`, `install_env`, `postinstall`).

```toml
"npm:some-cli" = { version = "latest", allow_builds = ["esbuild"] }           # aube/aube_cli/pnpm/npm >= 11.16
"npm:some-cli" = { version = "latest", npm_args = "--ignore-scripts=false" }  # older npm only
```

### Renamed/removed npm packages

If a previously working `npm:` tool stops resolving (especially under a `minimum_release_age` filter), check whether the package was renamed or unpublished against the npm registry before treating it as a mise bug:

```bash
npm view <package> version time --json
```

Migrate to the new key, install, then uninstall the old key (clean cutover, no alias):

```toml
[tools]
"npm:@ampcode/cli" = "latest"
```

```bash
mise install 'npm:@ampcode/cli'
mise uninstall --all 'npm:@sourcegraph/amp'
mise list 'npm:@sourcegraph/amp'   # confirm gone
```

## pipx backend

Docs: <https://mise.jdx.dev/dev-tools/backends/pipx.html>. Installs Python CLIs in isolated venvs — not a dependency manager (use it for `black`/`ruff`, not `numpy`).

```toml
[tools]
"pipx:black" = "latest"
"pipx:psf/black" = "latest"          # GitHub shorthand
"pipx:harlequin" = { version = "latest", extras = "postgres,s3" }
```

- **uv by default**: if `uv` is installed, mise uses `uv tool install`/`uvx` (much faster). Disable per tool with `uvx = "false"`.
- **`minimum_release_age` is forwarded into dependency resolution**: uv uses `--exclude-newer`; the pipx fallback uses pip `--uploaded-prior-to` (needs `pip >= 26.0`). A package whose transitive deps are prerelease-only can fail even when the top-level package is stable.
- When uv reports a prerelease dependency conflict, prefer a **scoped** fix over blanket prerelease allowance:

  ```toml
  "pipx:markitdown" = {
    version = "latest",
    extras = "all",
    uvx_args = "--with azure-ai-contentunderstanding==1.2.0b2 --prerelease explicit",
  }
  ```

  Use `--prerelease allow` only when the user accepts prereleases throughout the tool's environment. Avoid `--index-strategy unsafe-best-match` unless all configured Python indexes are equally trusted.
- After a Python version change, pipx packages may need reinstalling: `mise install -f 'pipx:*'` (or `mise up python` does it automatically).
- Options: `extras`, `uvx`, `uvx_args`, `pipx_args`, `install_env`, plus shared options.

## aqua backend

Docs: <https://mise.jdx.dev/dev-tools/backends/aqua.html>. Preferred backend. Built-in signature/provenance verification (Cosign, Minisign, SLSA, GitHub attestations), full lockfile asset tracking.

```toml
[tools]
"aqua:BurntSushi/ripgrep" = "latest"
ripgrep = "latest"   # registry shorthand usually resolves here
```

Tune verification only when an upstream lacks a method:

```bash
export MISE_AQUA_COSIGN=false
export MISE_AQUA_SLSA=false
export MISE_AQUA_GITHUB_ATTESTATIONS=false
export MISE_AQUA_MINISIGN=false
```

### SLSA / release-tag failures

A failure like:

```text
SLSA verification error ... Failed to get release ... /releases/tags/<owner>/<repo>@<version>
```

usually means the backend constructed a tag name the upstream does not actually publish. Verify upstream tags/releases, then switch to a backend that exposes the same binary reliably:

```bash
mise registry <tool>
mise ls-remote <tool>
mise latest 'github:<owner>/<repo>'
```

Prefer `github:`/`aqua:` for the replacement. Only fall back to an `asdf:` plugin when no verified backend works, and note the supply-chain tradeoff:

```toml
# Example: explicit asdf plugin when aqua resolution is broken for a tool
"asdf:asdf-community/asdf-bitwarden-secrets-manager" = "latest"
```

## github / gitlab backends

Docs: <https://mise.jdx.dev/dev-tools/backends/github.html>, <https://mise.jdx.dev/dev-tools/backends/gitlab.html>. Install release-asset binaries directly from GitHub/GitLab releases. Full lockfile asset tracking; support `prerelease = true`.

```toml
"github:cli/cli" = "latest"
"github:astral-sh/ruff" = { version = "latest", prerelease = true }
```

For private repos or to dodge rate limits, configure a token — see [github tokens](https://mise.jdx.dev/dev-tools/github-tokens.html). A populated `mise.lock` avoids most API calls.

## Compiled-language backends (cargo, go, gem, dotnet)

Docs under `https://mise.jdx.dev/dev-tools/backends/`. These compile or fetch from language registries and require the toolchain installed. Because most such tools ship single binaries, `aqua`/`github` are preferred when available.

```toml
"cargo:ripgrep" = "latest"
"go:github.com/goreleaser/goreleaser" = "latest"
"gem:rubocop" = "latest"
```

- `cargo:` accepts a `locked` option; `go:`/`cargo:` need `go`/`cargo` on `PATH`.

## http / s3 / spm backends

Docs: <https://mise.jdx.dev/dev-tools/backends/http.html> (and `s3.html`, `spm.html`). The `http` backend installs from arbitrary URLs with per-platform `url` + `checksum`; ideal for internal/private binaries.

```toml
[tools."http:my-tool"]
version = "1.0.0"
[tools."http:my-tool".platforms]
macos-arm64 = { url = "https://example.com/my-tool-macos-arm64.tar.gz", checksum = "sha256:..." }
linux-x64   = { url = "https://example.com/my-tool-linux-x64.tar.gz",   checksum = "sha256:..." }
```

## Shared tool options

These work across backends (see <https://mise.jdx.dev/dev-tools/#tool-options>):

- `os = ["linux", "macos/arm64"]` — gate by OS, or OS/arch when an entry contains `/`.
- `depends = ["python"]` — ordering within the current install set (not vfox hook deps — those go in plugin `metadata.lua`).
- `install_env = { KEY = "value" }` — env vars during install and per-tool `postinstall`.
- `postinstall = "corepack enable"` — command run after a successful install with the tool's bin on `PATH`.
