# Telemetry and Private Repos

## Telemetry

The `skills` CLI collects anonymous usage data by default for public installs. Reported fields can include skill names, the source URL, the targeted agents, and the resolved file paths.

Two environment variables disable telemetry, checked since `skills@1.5.6`:

- `DISABLE_TELEMETRY=1`
- `DO_NOT_TRACK=1` (broader, console-wide convention; see https://donottrack.sh/)

The README claims CI environments disable telemetry automatically. In `skills@1.5.7` the code only adds a `ci=1` query parameter and still sends the event unless `DISABLE_TELEMETRY` or `DO_NOT_TRACK` is set. Until upstream code matches the README, set the env var explicitly in CI.

### How to apply

- **One-off**: prefix the command — `DISABLE_TELEMETRY=1 skills add ...`.
- **Per-shell**: `export DISABLE_TELEMETRY=1` in the active session.
- **Persistent**: add the export to `~/.zshenv` so every zsh process inherits it.

There is no `skills telemetry disable` subcommand in the current CLI help; the env vars are the only documented opt-out.

## Private Repos

`skills add` shallow-clones the source repo via the local `git` binary with `GIT_TERMINAL_PROMPT=0`. Tokens from `GITHUB_TOKEN`/`GH_TOKEN` are **not** injected into the clone command — they are only used by the CLI's GitHub API tree lookups (and as an API rate-limit fallback). For the clone to succeed against a private repo, the user's git environment must already be authenticated.

Recommended auth setup for private GitHub repos, in order of robustness:

- **SSH** (preferred when keys are already loaded): use `git@github.com:<owner>/<repo>.git`. Verify with `ssh -T git@github.com` and `ssh-add -l`.
- **`gh auth setup-git`**: configures git to use the GitHub CLI as a credential helper for HTTPS URLs. Run `gh auth login` first if not already authenticated, then `gh auth setup-git`. After that, HTTPS clones to GitHub succeed without prompting.
- **Git credential helper**: store credentials with `git config --global credential.helper osxkeychain` (macOS) or `manager` (cross-platform) and ensure `git credential fill` returns a valid token for `github.com`.

For GitHub API rate-limit relief when adding from a public repo subpath, export `GITHUB_TOKEN` or `GH_TOKEN`. This does not affect clone auth — only API metadata reads.

### Recommended private-repo pattern

```bash
DISABLE_TELEMETRY=1 skills add git@github.com:<owner>/<repo>.git \
  --skill '*' -g -a codex -a claude-code -y
```

- `DISABLE_TELEMETRY=1` keeps private repo names and paths out of telemetry payloads.
- SSH URL reuses the loaded key pair instead of prompting for credentials.
- `--skill '*'` installs every skill in the repo.
- `-g` makes the install global; drop it for project scope.
- `-a codex -a claude-code` constrains the install to two specific agents.
- `-y` suppresses confirmation prompts; only add when the user is confident about the scope.

### When to fall back to HTTPS

- The user is on a sandboxed shell with no SSH key available.
- A CI runner only has `GITHUB_TOKEN`.
- The repo is fetched through a corporate proxy that blocks SSH.

In those cases, use the HTTPS URL with a git credential helper or `gh auth setup-git` so plain `git clone https://github.com/...` works non-interactively. On CI, write `GITHUB_TOKEN` into `~/.git-credentials` (or use the `x-access-token` helper pattern) before running `skills add`. Exporting `GITHUB_TOKEN` alone is not sufficient — the CLI does not forward it to the clone.

## Verification

After installing from a private source, confirm:

```bash
skills ls -g --json | jaq '.[] | select(.name == "<expected-skill>")'
test -f ~/.claude/skills/<expected-skill>/SKILL.md && echo OK
```

If verification fails, re-run the install with `--list` first to confirm the source repo exposes the expected skill names.
