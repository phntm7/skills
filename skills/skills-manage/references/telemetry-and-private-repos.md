# Telemetry and Private Repos

## Telemetry

The `skills` CLI collects anonymous usage data by default for public installs. Reported fields can include skill names, the source URL, the targeted agents, and the resolved file paths.

Two environment variables disable telemetry, checked since `skills@1.5.6`:

- `DISABLE_TELEMETRY=1`
- `DO_NOT_TRACK=1` (broader, console-wide convention; see https://donottrack.sh/)

CI environments disable telemetry automatically.

### How to apply

- **One-off**: prefix the command — `DISABLE_TELEMETRY=1 skills add ...`.
- **Per-shell**: `export DISABLE_TELEMETRY=1` in the active session.
- **Persistent**: add the export to `~/.zshenv` so every zsh process inherits it.

There is no `skills telemetry disable` subcommand in the current CLI help; the env vars are the only documented opt-out.

## Private Repos

`skills add` resolves the source repo through git. For private GitHub repos:

- **SSH** (preferred when keys are already loaded): use `git@github.com:<owner>/<repo>.git`. Confirm with `ssh -T git@github.com` if auth is uncertain.
- **HTTPS with token**: set `GITHUB_TOKEN` or `GH_TOKEN` in the environment; the CLI's git operations will pick them up.
- **`gh` auth**: if `gh auth status` shows an active token, git operations via the `https://github.com/...` URL will succeed without extra setup.

### Recommended pattern for this Mac

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

In those cases, use the HTTPS URL and rely on `GITHUB_TOKEN`/`GH_TOKEN` or `gh` auth.

## Verification

After installing from a private source, confirm:

```bash
skills ls -g --json | jaq '.[] | select(.name == "<expected-skill>")'
test -f ~/.claude/skills/<expected-skill>/SKILL.md && echo OK
```

If verification fails, re-run the install with `--list` first to confirm the source repo exposes the expected skill names.
