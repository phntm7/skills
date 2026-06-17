---
name: omniroute-operations
description: >
  Query and troubleshoot OmniRoute APIs, model catalogs, provider health, usage limits, and chat routes. Use when a user asks about OmniRoute models, providers, API keys, quota/limit checks, OpenCode Go/Claude/Codex/GLM/Xiaomi MiMo limits, failed routes, or whether a model is available or responding.
---

# OmniRoute Operations

Use this skill to answer OmniRoute operational questions with live API evidence instead of stale model lists or guessed routes.

## Core Rules

- Treat OmniRoute state as dynamic. Fetch models, providers, health, and limits at runtime.
- Do not hardcode API keys, provider IDs, connection IDs, current quotas, or model catalogs in responses.
- Use an API key only from the caller's environment, secret file, or explicitly provided secure context. Never print full secrets.
- Prefer OmniRoute's local/base URL reachable from the current environment:
  - inside Docker stacks: `http://omniroute:20128`
  - via Traefik/local DNS: `http://omniroute.lo`
  - override with `OMNIROUTE_BASE_URL` when needed.
- For OpenCode Go routes, use a normal browser/OpenAI-style user-agent. Some upstream paths can fail through Cloudflare when probed with Python's default `urllib` user-agent even though Pi/OpenCode clients work.
- Distinguish provider health from chat success. `/api/providers` can show active while an individual model request still fails upstream.

## Quick Procedure

1. Locate the base URL and key.
   - Env: `OMNIROUTE_BASE_URL`, `OMNIROUTE_API_KEY`.
   - Optional key file: set `OMNIROUTE_API_KEY_FILE`.
   - For Pi runtime, inspect its rendered config if available; do not paste the key.
2. Query live state with [scripts/omniroute_inspect.py](scripts/omniroute_inspect.py):
   - models: `python3 scripts/omniroute_inspect.py models`
   - providers: `python3 scripts/omniroute_inspect.py providers`
   - usage limits: `python3 scripts/omniroute_inspect.py limits`
   - rate-limit runtime state: `python3 scripts/omniroute_inspect.py rate-limits`
   - chat smoke test: `python3 scripts/omniroute_inspect.py test-chat --model <model-id> --prompt "Reply OK"`
3. If a model works in UI/Pi but your script fails, retry the chat request with the script's default `OpenAI/JS` user-agent before concluding the model is broken.
4. Report:
   - endpoint called;
   - HTTP status;
   - routed provider/model headers when present;
   - model/provider status;
   - quota windows and reset times when present;
   - exact failure class (`401` key/auth, `403` upstream/cloudflare/quota, `429` limit, `5xx` provider error).

## What to Query

Load [references/routes.md](references/routes.md) when you need endpoint details or failure triage.

Common endpoints:

| Need | Endpoint |
|---|---|
| OpenAI-compatible model catalog | `GET /v1/models` |
| Chat smoke test | `POST /v1/chat/completions` |
| Provider connection state | `GET /api/providers` |
| Runtime queue/rate-limit state | `GET /api/rate-limits` |
| Subscription/provider quota windows | `GET /api/usage/provider-limits` |

## Interpreting Limits

- `GET /api/usage/provider-limits` is the quota-window source when available. It may return Codex, Claude, GLM, Xiaomi MiMo, GitHub Copilot, and other provider caches depending on configured accounts.
- `opencode-go` may expose provider health/models without detailed quota counters in OmniRoute. Use provider docs or the provider console for detailed OpenCode Go usage if OmniRoute does not return it.
- GLM Coding Plan, Xiaomi MiMo Token Plan, Codex, and Claude Code each have separate subscription pools. When recommending routing, distribute routine tasks across pools and keep scarce/high-quality providers for specialist roles.

## Chat Smoke Tests

Use a deterministic cheap prompt:

```text
Calculate 95222+25820, and reply with the result only.
```

Expected content: `121042`.

Prefer `--stream false` or non-streaming calls for smoke tests because they are easier to parse and compare. If testing Pi/OpenCode behavior specifically, run the tool through that client too; raw HTTP and agent clients can differ in request headers, protocol adapters, and context injection.

## Output Contract

For user-facing summaries, use this structure:

```markdown
- Base URL tested: `<base>`
- Key source: env/file/runtime config, redacted
- Models checked: `<ids>`
- Results:
  - `<model>`: HTTP `<status>`, provider `<provider>`, routed model `<model>`, result `<short content or error>`
- Limits:
  - `<provider>`: `<quota name>` used `<used>/<total>`, remaining `<remaining>`, resets `<time>`
- Conclusion: `<works / broken / auth issue / upstream issue>`
```

## Trigger Examples

Should trigger:

- "Check which OmniRoute models are available and whether Kimi works."
- "Does OmniRoute expose Codex/Claude/GLM/Xiaomi usage limits?"
- "Why does opencode-go return 403 from my script but work in Pi?"
- "Write a command for querying OmniRoute provider limits."

Should not trigger:

- "Pick the best LLM for my app" with no OmniRoute or provider-routing context.
- "Configure Docker Compose for a new unrelated service."
