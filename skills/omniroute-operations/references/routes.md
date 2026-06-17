# OmniRoute Routes and Triage

OmniRoute is dynamic. Use these routes as the stable interface, then inspect the live response shape.

## Authentication

Most operational routes accept:

```http
Authorization: Bearer <omniroute-api-key>
Accept: application/json
```

Use `Content-Type: application/json` for POST bodies.

Do not print full keys. When reporting, use length/prefix/suffix only if needed, for example `len=35 prefix=sk-... suffix=...`.

## Base URL Selection

Use the nearest reachable origin:

| Environment | Common base |
|---|---|
| Same Compose network | `http://omniroute:20128` |
| Host/Tailscale/local DNS through Traefik | `http://omniroute.lo` |
| Custom tunnel or port forward | set `OMNIROUTE_BASE_URL` |

Normalize by stripping a trailing `/v1` when calling `/api/*` routes.

## Core Endpoints

### `GET /v1/models`

Returns the OpenAI-compatible model catalog available through configured providers. The list changes after account syncs, provider updates, subscriptions, and OmniRoute upgrades. Fetch it live.

Use it for:

- model availability checks;
- provider-prefix discovery, such as `opencode-go/*`, `zai/*`, `xiaomi-mimo/*`, `cx/*`, `claude/*`;
- confirming new model IDs after a sync.

### `POST /v1/chat/completions`

OpenAI-compatible chat endpoint.

Minimal smoke body:

```json
{
  "model": "<model-id>",
  "messages": [
    {"role": "user", "content": "Calculate 95222+25820, and reply with the result only."}
  ],
  "max_tokens": 64,
  "stream": false
}
```

Useful response headers can include:

- `x-omniroute-provider`
- `x-omniroute-model`

If the body says success but content is empty, inspect the full event/client behavior. Some model adapters can return reasoning or protocol errors differently in raw HTTP vs an agent client.

### `GET /api/providers`

Returns configured provider connections and current provider-level state.

Use it for:

- provider names and connection IDs;
- health or test status;
- last errors;
- account/subscription metadata when exposed;
- deciding whether a quota cache entry maps to a live provider connection.

Provider health is not enough to prove a specific model works. Always smoke-test the model route when the question is about usability.

### `GET /api/rate-limits`

Returns OmniRoute runtime rate-limit and queue state. This is not the same as subscription usage. It can include active/queued/executing counts, lockouts, rate-limit protection config, and cache stats.

Use it for:

- diagnosing local OmniRoute lockouts;
- queue pressure;
- runtime protection decisions.

### `GET /api/usage/provider-limits`

Returns subscription/provider quota caches when OmniRoute has them. This is the route to answer questions like "how much of the 5-hour Claude/Codex/GLM/Xiaomi limit is used?" when the provider cache exists.

The response commonly has:

- `caches`: per provider/connection quota caches;
- `intervalMinutes`: sync interval;
- `lastAutoSyncAt`: last refresh time.

Do not assume the cache keys are provider names. Join with `/api/providers` by connection ID when possible, and also handle orphan/stale caches that no longer map to a live connection.

## Failure Classes

| Symptom | Likely cause | Next check |
|---|---|---|
| `401 Authentication required` | missing Authorization header | verify key source and header |
| `401 Invalid API key` | wrong OmniRoute key or wrong key for this instance | test `GET /v1/models` with the same key |
| `403` JSON with provider error | upstream provider denied or quota/scope issue | check `/api/providers`, logs, provider console |
| `403` HTML / Cloudflare page | upstream anti-bot/browser signature block | retry with browser/OpenAI user-agent or real client; inspect logs |
| `429` | provider or OmniRoute rate limit | check `/api/rate-limits` and provider limit route |
| `5xx` | provider adapter/upstream failure | retry once, then inspect logs and provider status |
| Model listed but Pi says not found | Pi runtime `models.json` not synced | inspect rendered Pi model config and seed/live file behavior |

## OpenCode Go User-Agent Trap

OpenCode Go requests can be sensitive to request shape. A raw Python `urllib` request with its default user-agent can trigger upstream Cloudflare access-denied while the same model works through Pi/OpenCode or with an OpenAI/browser-like user-agent.

Before declaring `opencode-go/*` broken:

1. Retry raw HTTP with `User-Agent: OpenAI/JS 6.9.1` or a browser-like user-agent.
2. Test through the actual client, such as Pi/OpenCode, if the user is asking about that client.
3. Compare OmniRoute logs for upstream error details.

## Limit Interpretation Notes

- Codex and Claude Code subscription quota caches can expose 5-hour/session and weekly windows when OmniRoute syncs them.
- GLM Coding Plan exposes plan-specific limits when available; GLM-5.2 may have higher consumption multipliers than routine models.
- Xiaomi MiMo Token Plan uses monthly credits. MiMo v2.5 and v2.5-pro share the same package pool with different credit multipliers.
- OpenCode Go provider docs define 5-hour, weekly, and monthly dollar-value limits, but OmniRoute may not expose detailed counters for `opencode-go` in `/api/usage/provider-limits`. If not returned, say so and point to provider console/docs rather than inventing counters.
