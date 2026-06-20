# OMP review workflows

Use this reference when you want Oh My Pi (`omp`) to act as an external reviewer
for a local change set. Keep OMP in review mode unless the caller explicitly
asks it to edit files.

If the `deep-code-review` skill is available, let it own the review
methodology: lenses, the Blocker/Major/Minor/Nit severity scale, and the
findings schema (`severity`, `lens`, `location` as `path:line`, `problem`,
`why`, `remedy`). When you invoke `omp` for that kind of review, tell OMP to
apply those lenses, severities, and output fields. Use this file to operate
`omp`; use the prompt templates below only as generic fallbacks when
`deep-code-review` is not in play.

## Choose one-shot or persistent review

Use a one-shot `omp -p` review when:

- The diff is small enough to fit in one prompt and one response.
- You need a second opinion before merging, not an ongoing conversation.
- The review can be throwaway. Add `--no-session` only when you are sure you
  will not need to resume or recover from an outer runner timeout.
- You supply all needed diff/context in the prompt. Add `--no-tools` for maximum
  isolation in that mode.

Use a persistent session when:

- You expect to fix findings and ask OMP to re-review the remaining diff.
- The codebase context is too large for a single prompt.
- You want OMP to remember earlier findings, constraints, and your fix notes.
- You need to resume after a tool crash, terminal restart, or context handoff.

Default to persistent sessions for review loops. OMP saves sessions unless you
pass `--no-session`. Long reviews can exceed an outer runner timeout while OMP
still saves progress; avoid `--no-session` for any review expected to continue.

`omp -p` is the plain-text one-shot mode. `omp --mode json` is also one-shot
and emits JSONL; do not combine `-p` with `--mode json`.

## One-shot review command

Run one-shot reviews from outside the target repo or with an explicit `--cwd` so
OMP reviews the intended project.

```bash
omp -p \
  --cwd /path/to/repo \
  --model <provider>/<model> \
  'Review the current working tree diff only.

Goal: find correctness, security, data-loss, API-contract, and maintainability issues that should block or change this patch.

Scope:
- Inspect the diff against the current base.
- Ignore unrelated pre-existing issues unless this patch makes them worse.
- Do not modify files.
- Run only narrow read-only inspection commands; do not run tests unless I explicitly ask.

Output:
- Findings first, highest severity first.
- For each finding: severity, file/path, affected code, why it matters, and the smallest concrete fix.
- If there are no actionable findings, say "No actionable findings" and list the checks you performed.
- Do not give broad advice, style preferences, or speculative rewrites.'
```

Notes:

- Replace `<provider>/<model>` with the exact reviewer model selector. The model portion may itself contain `/`.
- Add `--no-tools` only when you supply the needed diff/context in the prompt
  and want a pure advisory review.
- Do not paste secrets, `.env` contents, tokens, private keys, or
  credential-bearing logs into the prompt.

## Persistent review loop

Use this loop when OMP should review, you should apply fixes, and OMP should
re-review the result.

1. Start the review session.

   ```bash
   session_dir="$(mktemp -d)"
   omp --mode json \
     --session-dir "$session_dir" \
     --cwd /path/to/repo \
     --model <provider>/<model> \
     'You are reviewing the current working tree diff. Do not modify files.

   Return only actionable findings. For each finding include severity, file/path, affected code, impact, and a concrete fix. Ignore broad advice and unrelated pre-existing issues.' \
     | tee /tmp/omp-review.jsonl
   ```

   `--mode json` is one-shot and emits JSONL events. The first
   `{"type":"session", ...}` event contains the session `id`. `--session-dir`
   is optional isolation; if you use it, pass the same `--session-dir` and
   `--cwd` on every command in the loop. If you omit it, omit it everywhere.

2. Capture the session id.

   ```bash
   session_id="$(jq -r 'select(.type=="session") | .id' /tmp/omp-review.jsonl)"
   ```

   Resume by id, not by reconstructing the session file path. Id-prefix resume
   is the documented, layout-independent mechanism; reconstructing a `.jsonl`
   path depends on cwd-encoding internals. When the session used
   `--session-dir`, every resume command must pass the same
   `--session-dir "$session_dir"` and `--cwd /path/to/repo` so OMP searches the
   right scope.

   Do not pass `--no-session` for loops you expect to resume. `--resume`
   accepts an id prefix or `.jsonl` path, but use the captured id in automation.
   Do not use bare `--resume` unattended; bare `--resume` opens an interactive
   picker. Use `--continue`/`-c` only when the active terminal breadcrumb or the
   most recent session is safe.

   If a long review exceeds the outer runner's timeout, do not discard the run.
   Resume the captured id with `--resume "$session_id"` and ask OMP to
   synthesize completed findings plus any remaining review work.

   Timeout policy: use at least 10 minutes for a small one-shot review and 20
   minutes as the default for Opus/high-reasoning or repo-aware reviews. Use
   30–45 minutes for large diffs. If you set OMP's `--max-time` in seconds,
   make the outer process timeout at least 60 seconds longer so OMP can flush
   the session.

3. Apply fixes in the caller, not in the review agent.

   - Treat OMP's output as review feedback, not ground truth.
   - Verify each recommendation against the code and requirements.
   - Make only the fixes you can justify.
   - Run the targeted checks that cover the touched behavior.

4. Ask OMP to re-review the remaining diff.

   Prefer the captured id:

   ```bash
   omp -p \
     --session-dir "$session_dir" \
     --cwd /path/to/repo \
     --resume "$session_id" \
     'Re-review the current working tree diff after my fixes.

   Focus only on unresolved or newly introduced actionable issues. Confirm which prior findings are fixed if you can verify them from the diff. Do not modify files. Do not repeat resolved findings.'
   ```

   If no id is available and the terminal context is intact, continue the most
   recent session. If the original command used `--session-dir`, pass the same
   `--session-dir` here too:

   ```bash
   omp -p \
     --session-dir "$session_dir" \
     --cwd /path/to/repo \
     --continue \
     'Re-review the current working tree diff after my fixes.

   Focus only on unresolved or newly introduced actionable issues. Do not modify files. Do not repeat resolved findings.'
   ```

5. Repeat until OMP reports no actionable findings or you reject the remaining
   recommendations with a documented reason.

## Prompt templates

### Initial review prompt

```text
You are an external code reviewer for this repository. Review the current working tree diff only.

Constraints:
- Do not modify files.
- Do not run broad formatters, linters, or project-wide tests unless I explicitly ask.
- Ignore unrelated pre-existing issues unless this patch makes them worse.
- Do not report style preferences without a correctness, security, contract, or maintainability impact.

Findings to prioritize:
1. Correctness bugs and broken edge cases.
2. Security, secret handling, and trust-boundary problems.
3. Data loss, migration, persistence, or concurrency risks.
4. Broken API contracts, type contracts, or caller expectations.
5. Maintainability regressions that will make this code harder to change safely.

Output format:
- Findings, highest severity first.
- Each finding must include: severity, file/path, affected code, impact, and concrete fix.
- If no actionable findings exist, say "No actionable findings" and summarize what you inspected.
```

### Re-review prompt

```text
Re-review the current working tree diff after my fixes.

Focus:
- Verify whether the previous actionable findings are resolved.
- Find only unresolved or newly introduced actionable issues.
- Do not repeat fixed findings.
- Do not broaden scope beyond this diff.

Output format:
- Remaining findings, highest severity first.
- For each finding: severity, file/path, affected code, why it still matters, and the smallest concrete fix.
- If the diff is clean, say "No actionable findings remain" and list any targeted checks I should still run locally.
```

### Reviewer with limited tools prompt

Use this with `--no-tools` or a runtime that restricts tools when you supply the
needed diff yourself.

```text
Review only the diff and context pasted below. You may not inspect files, run commands, or infer code outside the supplied context.

Return actionable findings only. Each finding must cite the supplied file/path and line or hunk. If the supplied context is insufficient to verify a concern, say what context is missing instead of guessing.

<diff>
[paste sanitized diff here]
</diff>
```

## Safety rules

- Keep OMP read-only by default. Do not ask it to edit, patch, commit, push,
  install packages, or run migrations unless the caller explicitly requested
  that side effect.
- Use `--no-tools` for risky repositories, untrusted diffs, secret-adjacent
  code, or reviews that can rely on pasted context.
- If tools are needed, limit the prompt to review actions: inspect files,
  inspect diffs, and run narrow read-only commands or explicitly approved
  targeted tests.
- Prefer sessions for review loops. Use `--no-session` only for throwaway
  reviews with no sensitive context and no need to resume or recover.
- Use `--cwd` on every command so OMP operates in the intended repository.
- Use `--model <provider>/<model>` (the model portion may itself contain `/`)
  and `--thinking off|minimal|low|medium|high|xhigh` intentionally. Do not let
  an unknown default decide reviewer quality for high-risk changes.

## Handling OMP recommendations

1. Triage findings by impact. Fix blockers and high-confidence correctness or
   security issues first.
2. Verify every claim in the code. Reject findings that rely on missing context,
   stale assumptions, or behavior contradicted by the implementation.
3. Apply the smallest fix that addresses the root cause. Avoid broad refactors
   unless the finding requires one.
4. Run targeted checks for the changed behavior. Use the narrowest unit,
   integration, typecheck, or scenario that can catch the failure.
5. Re-run OMP against the remaining diff with `--resume "$session_id"` or
   `--continue`, passing the same `--cwd` and, when used, `--session-dir`.
6. Stop only when OMP reports no actionable findings remain, or when you have
   explicitly rejected the remaining findings with evidence.

## Common command patterns

One-shot, isolated review:

```bash
omp -p --cwd /path/to/repo --model <provider>/<model> --no-tools '<initial review prompt>'
```

Persistent review session:

```bash
session_dir="$(mktemp -d)"
omp --mode json --session-dir "$session_dir" --cwd /path/to/repo --model <provider>/<model> '<initial review prompt>' | tee /tmp/omp-review.jsonl
session_id="$(jq -r 'select(.type=="session") | .id' /tmp/omp-review.jsonl)"
```

Resume by id:

```bash
omp -p --session-dir "$session_dir" --cwd /path/to/repo --resume "$session_id" '<re-review prompt>'
```

Continue the active or most recent session in the same isolated session scope:

```bash
omp -p --session-dir "$session_dir" --cwd /path/to/repo --continue '<re-review prompt>'
```
