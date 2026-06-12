# Troubleshooting Playbooks

Diagnostic flows for the warnings and failures mise emits during install/upgrade. Load this when a tool will not resolve, an upgrade reports an ignored release, or installs behave inconsistently. General docs: <https://mise.jdx.dev/troubleshooting.html> and <https://mise.jdx.dev/faq.html>.

## First, orient

```bash
mise --version                       # rule out a stale mise
mise config                          # which config files load, in what order
mise settings get minimum_release_age
mise doctor                          # shell integration / activation health
```

`mise doctor` (alias `mise dr`) surfaces activation, shim, and PATH problems that masquerade as tool failures.

## "A newer release is ignored by minimum_release_age"

`minimum_release_age` filters out versions newer than the configured age. Confirm whether the filter is the cause before changing config.

1. Check the active setting and what mise resolves with the filter off:
   ```bash
   mise settings get minimum_release_age
   mise latest --minimum-release-age 0s <tool>
   ```
2. Clear caches once, then re-check — stale resolver data can mimic a filter:
   ```bash
   mise cache clear
   mise latest --minimum-release-age 0s <tool>
   ```
3. Compare against the upstream registry (npm example):
   ```bash
   npm view <package> version time --json
   ```
4. Decide:
   - If `--minimum-release-age 0s` returns the newer version, the filter is working as designed. Adjust intentionally: lower the global age, add a per-tool override, or add the tool to `minimum_release_age_excludes`. Precedence is CLI flag > per-tool > global.
   - If `0s` still returns the **old** version, this is **stale/missing mise remote metadata or a backend limitation**, not a config failure. Report the evidence: active setting, `mise latest` result, upstream latest, and whether `cache clear` changed anything.

Per-tool override and exclusions:

```toml
[settings]
minimum_release_age = "7d"
minimum_release_age_excludes = ["npm:*", "trivy", "npm:prettier"]
[tools.trivy]
version = "latest"
minimum_release_age = "1d"
```

## A tool stops resolving

1. Confirm the tool/version exists upstream:
   ```bash
   mise ls-remote <tool>
   mise latest <tool>
   ```
2. Check whether the package was **renamed or unpublished** (common for npm/pipx CLIs). Verify both names against the source registry:
   ```bash
   npm view <package> version time --json     # npm
   ```
   Migrate to the new key, install, uninstall the old (no compatibility alias) — see [backends.md](backends.md).
3. Confirm the backend is enabled and not overridden:
   ```bash
   mise settings get disable_backends
   mise registry <tool>      # shows resolvable backends
   ```
4. For private GitHub/GitLab assets or rate limits, configure a token: <https://mise.jdx.dev/dev-tools/github-tokens.html>.

## SLSA / signature / release-tag verification errors

Shape:

```text
SLSA verification error ... Failed to get release ... /releases/tags/<owner>/<repo>@<version>
```

This usually means the backend built a tag name the upstream does not publish, or the upstream lacks the verification artifact mise expects.

1. Verify the real upstream tags/releases.
2. Prefer switching to a backend that exposes the binary reliably (`github:`/`aqua:`) over disabling verification.
3. If you must relax aqua verification because upstream genuinely lacks a method, scope it with the `MISE_AQUA_*` env vars (see [security](https://mise.jdx.dev/security.html)) rather than disabling globally and silently.

## Prerelease dependency conflicts (pipx/uv)

`uv` may refuse to resolve when a transitive dependency only has prerelease versions. Prefer a scoped fix over blanket prerelease allowance:

```toml
"pipx:markitdown" = {
  version = "latest",
  extras = "all",
  uvx_args = "--with <dep>==<prerelease> --prerelease explicit",
}
```

Only use `--prerelease allow` when the user accepts prereleases throughout the environment. Never reach for `--index-strategy unsafe-best-match` unless every configured index is equally trusted.

## Wrong binary / version on PATH

1. Confirm the resolved binary and active versions:
   ```bash
   mise which <bin>
   mise ls --current
   mise where <tool>
   ```
2. If shims are stale after an install/uninstall, rebuild them:
   ```bash
   mise reshim
   ```
3. If activation is not loading the env (interactive shell), re-check `mise activate` is in the shell rc and run `mise doctor`. Shims and `activate` differ — see <https://mise.jdx.dev/dev-tools/shims.html>.
4. A tool with an `os`/`os/arch` restriction is silently skipped on non-matching platforms — confirm the gate matches the host.

## Config is ignored / "untrusted config" error

mise will not parse a `mise.toml` that can execute code (env directives, tasks, hooks) until it is trusted.

```bash
mise trust --show       # trust status up the tree
mise trust              # trust config in current/parent dir
mise trust <file>       # trust a specific file
mise trust --untrust    # revoke; mise prompts again later
```

In detected CI mise assumes trust unless [paranoid mode](https://mise.jdx.dev/paranoid.html) is enabled. To pre-trust paths non-interactively, set `trusted_config_paths` (global config) or `MISE_TRUSTED_CONFIG_PATHS`.

## Cache and reset escape hatches

```bash
mise cache clear              # drop resolver/version caches (cheap, safe first step)
mise install -f <tool>        # force reinstall a tool
mise install -f 'pipx:*'      # reinstall all pipx packages (e.g. after python bump)
mise uninstall --all && mise install   # regenerate lockfile checksums from scratch
```

Cache layout and TTLs: <https://mise.jdx.dev/cache-behavior.html>. One cache-cleared retry that "works" is not proof of an upstream fix — corroborate with the upstream registry or release API before concluding.

## What to report

- the exact warning/error text and the command that produced it;
- active `minimum_release_age`/`prereleases`/`disable_backends` settings;
- `mise latest` / `mise ls-remote` results with and without the age filter;
- upstream registry/release evidence (`npm view ...`, release tags);
- whether `mise cache clear` changed the outcome;
- the conclusion: config fix vs stale metadata vs backend limitation vs renamed package.
