# Running omp non-interactively

Use this reference to drive Oh My Pi (`omp`) non-interactively for a delegated
task (e.g. review). Keep OMP read-only unless the caller explicitly asks it to
edit files or perform another side effect.

## Choose one-shot or persistent

One-shot `omp -p` fits when:
- The task fits in one prompt and one response.
- You only need a throwaway answer.
- You supply all needed context in the prompt.
- You want maximum isolation with `--no-tools`.

Persistent sessions fit when:
- You expect to apply fixes in the caller and ask OMP to check again.
- OMP needs repo context or earlier constraints across turns.
- You need to resume after an outer timeout, terminal restart, or handoff.

Default to persistent sessions for loops. OMP saves sessions unless you pass
`--no-session`; never use `--no-session` for a loop you may need to resume.
Use `omp -p` for plain-text one-shot mode.
Use `omp --mode json` for JSONL one-shot mode; choose exactly one mode.

## One-shot run

Pass `--cwd` so OMP uses the intended project.

```bash
omp -p --cwd /path/to/repo --model <provider>/<model> '<task prompt>'
```

Notes:
- Replace `<provider>/<model>` with the exact selector; the model id may contain `/`.
- Add `--no-tools` only when the prompt includes all required context and you want a pure advisory answer.
- Keep secrets out of prompts: use names, paths, or `<redacted>` instead of `.env` contents, tokens, private keys, or credential-bearing logs.

## Persistent loop

1. Start a session and capture its id.

   ```bash
   session_dir="$(mktemp -d)"
   omp --mode json --session-dir "$session_dir" --cwd /path/to/repo --model <provider>/<model> '<task prompt>' | tee /tmp/omp-task.jsonl
   session_id="$(jq -r 'select(.type=="session") | .id' /tmp/omp-task.jsonl)"
   ```

   `--mode json` emits JSONL. The first `{"type":"session", ...}` header has the session `id`.
   `--session-dir` is optional; if you use it, pass the same `--session-dir` and `--cwd` on every command.
   Resume by id, not by reconstructing an on-disk `.jsonl` path. Bare `--resume` opens an interactive picker; never use it unattended.

2. Apply changes in the caller.

   Treat OMP output as feedback to verify. Apply the smallest justified change, run targeted checks for it, then ask OMP to check again.

3. Resume by id with matching scope.

   ```bash
   omp -p --session-dir "$session_dir" --cwd /path/to/repo --resume "$session_id" '<follow-up prompt>'
   ```

   If the terminal context is intact and the most recent session is safe, you can continue instead:

   ```bash
   omp -p --session-dir "$session_dir" --cwd /path/to/repo --continue '<follow-up prompt>'
   ```

4. Repeat until the task is complete or you explicitly reject the remaining recommendations with evidence.

For long tasks, set OMP's `--max-time <seconds>` intentionally and make the outer process timeout at least 60 seconds longer so OMP can flush the session.

## Safety rules

- Keep OMP read-only by default. Do not ask it to edit, patch, commit, push, install packages, or run migrations unless the caller requested that side effect.
- Use `--no-tools` for risky repositories, untrusted input, secret-adjacent code, or prompts that already include all needed context.
- If tools are needed, ask only for narrow inspection or explicitly approved targeted commands.
- Use `--cwd` on every command so OMP operates in the intended project.
- Use `--model <provider>/<model>` and `--thinking off|minimal|low|medium|high|xhigh` intentionally.
- Keep secrets out of prompts, transcripts, config, and examples; use names, paths, or `<redacted>`.

## Common command patterns

```bash
# One-shot, isolated
omp -p --cwd /path/to/repo --model <provider>/<model> --no-tools '<task prompt>'
# Persistent capture
session_dir="$(mktemp -d)"
omp --mode json --session-dir "$session_dir" --cwd /path/to/repo --model <provider>/<model> '<task prompt>' | tee /tmp/omp-task.jsonl
session_id="$(jq -r 'select(.type=="session") | .id' /tmp/omp-task.jsonl)"
# Resume by id
omp -p --session-dir "$session_dir" --cwd /path/to/repo --resume "$session_id" '<follow-up prompt>'
# Continue the active or most recent session in the same scope
omp -p --session-dir "$session_dir" --cwd /path/to/repo --continue '<follow-up prompt>'
```
