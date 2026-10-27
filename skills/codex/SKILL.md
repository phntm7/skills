---
name: codex
description: >
  Use when the user asks to run the Codex CLI (`codex exec`, `codex exec resume`,
  `codex exec review`) from another agent, for example to get a GPT-family
  implementation, second opinion, or cross-family code review.
---

# Codex

Run OpenAI's Codex CLI non-interactively and report what it did. Codex runs the
GPT family, so it is the natural reviewer for work written by Claude models and
the natural implementer when a GPT model fits the task better.

## Before running

1. `codex --version`. Flags below were checked against codex-cli 0.164.0; if the
   version differs a lot, check `codex exec --help` before relying on them.
2. Model and effort come from `~/.codex/config.toml` (`model`,
   `model_reasoning_effort`). Do not pass `-m` unless the user or the task calls
   for a specific model; when choosing one, read `~/.agents/model-policy.md` if
   it exists.
3. Pick the sandbox from what the task needs:
   - review or analysis: `-s read-only`;
   - edits in the working tree: `-s workspace-write`;
   - network, `gh`, package managers or paths outside the repo:
     `--dangerously-bypass-approvals-and-sandbox`. Ask first unless the user
     already allowed it.

## Commands

```bash
# New task; prompt from stdin keeps quoting simple
codex exec -s read-only -C <repo> -o /tmp/codex-last.md - < prompt.md

# Different model or effort for one run
codex exec -m <model> -c model_reasoning_effort='"high"' -s workspace-write -C <repo> - < prompt.md

# Continue the most recent session (or pass a session id instead of --last)
codex exec resume --last "<follow-up prompt>"

# Built-in code review of uncommitted changes, a branch, or a commit
codex exec review --uncommitted
codex exec review --base main
codex exec review --commit <sha>
```

- `-C <dir>` sets the working root; `--skip-git-repo-check` is needed outside a
  git repo.
- `-o <file>` writes Codex's final message to a file; read that instead of
  scraping the whole transcript.
- `--json` streams events as JSONL when you need tool calls or token usage.
- `--worktree` runs in a new managed git worktree.
- `resume` takes `-m`, `-c` and the bypass flag, but not `-s`; it reuses the
  original session's sandbox.
- Long runs: start them in the background and wait for completion rather than
  polling.

## Writing the prompt

Codex sees only the prompt and the repository. State the goal, the files or
diff in scope, constraints (what not to touch, whether to commit), and the
output you want back. For a review, give the base ref or the diff and ask for
findings with file and line, most severe first.

## Reporting back

Summarize Codex's result, the model and sandbox it ran with, and the session id
(printed at the top of the output) so the user can resume it. Report failures
with the error text; do not retry with a wider sandbox without asking.
