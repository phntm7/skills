# OmniRoute Operational Triage

Load this when diagnosing whether an OmniRoute route, model, provider, quota view, or client request path works. It gives the field procedure and user-facing report contract; use [api-access.md](api-access.md) for auth, headers, and the canonical error/failure-class table.

## 1. Pick the base URL

One-liner: inference keeps `/v1`; management `/api/*` is rooted at the origin, so strip a trailing `/v1` before building `/api/*` URLs. Full rule: [api-access.md](api-access.md).

| Environment | Common base |
|---|---|
| Same Docker/Compose network | `http://omniroute:20128` |
| Host/local DNS through Traefik | `http://omniroute.lo` |
| Custom tunnel, port forward, or nonstandard deploy | `$OMNIROUTE_BASE_URL` |

Examples:

- Inference: `POST {base}/v1/chat/completions` with `Authorization: Bearer $OMNIROUTE_API_KEY`.
- Management: `GET {origin}/api/providers` with `Cookie: auth_token=<session-cookie>`; do not call `{base}/v1/api/providers`.

## 2. Smoke-test the actual model route

Provider/model catalogs are dynamic. A listed model or an `active` provider does not prove a specific model serves. Always test the route the user cares about.

Recommended order:

1. Discover the catalog with `GET /v1/models` or `GET /api/v1/models` using the same Bearer key.
2. Send a cheap deterministic non-streaming chat request to the exact model ID.
3. Expect HTTP `200` and content `121042`; record routed headers when present.
4. If a real client succeeds but raw HTTP fails, retry raw HTTP with `User-Agent: OpenAI/JS 6.9.1` before calling the model broken.

Minimal body:

```json
{
  "model": "<model-id>",
  "messages": [
    {"role": "user", "content": "Calculate 95222+25820, and reply with the result only."}
  ],
  "max_tokens": 32,
  "stream": false
}
```

Useful response evidence:

- HTTP status and JSON body/error envelope.
- `X-Omniroute-Provider` and `X-Omniroute-Model` when present.
- `X-Omniroute-Route-Class`, `X-Omniroute-Session-Id`, `X-Request-Id`, and `X-OmniRoute-Cache` when relevant.

If the body succeeds but content is empty or malformed, inspect the full raw response and the real client behavior. Some adapters expose reasoning, streaming, or protocol errors differently from a simple raw HTTP client.

## 3. Provider health is not model health

`GET /api/providers` returns configured provider connections and provider-level state, but it is management-gated on `requireLogin` instances. A Bearer-key-only agent should expect `403 AUTH_001` there and should not treat that as OmniRoute being down.

Use `/api/providers` only when a management session is available, for:

- provider names and connection IDs;
- health/test status and last errors;
- account or subscription metadata when exposed;
- mapping usage/quota records back to live provider connections.

Operational rule: `active` provider state is a clue, not proof. If the question is "can model `<model-id>` answer now?", the answer must come from the chat smoke test for that model route.

## 4. opencode-go / Cloudflare user-agent trap

Raw `urllib` defaults can trigger upstream Cloudflare access-denied for `opencode-go/*` even when OmniRoute and the real client work. This is a request-shape failure, not automatically a broken provider.

Before declaring `opencode-go/*` broken:

1. Retry the same raw request with `User-Agent: OpenAI/JS 6.9.1` or a browser-like user-agent.
2. Test through the user's real client when the bug report is client-specific.
3. Compare OmniRoute request/proxy logs for upstream status, HTML/Cloudflare bodies, routed provider/model, and request IDs.
4. If only raw HTTP fails and the real client succeeds, report an HTTP client/user-agent issue, not a model outage.

## 5. Quota, usage, and limits

Critical correction: use only the current quota and usage surfaces below; do not instruct agents to call retired usage-limit routes. Quota and usage are split across the current management surface:

| Area | Current routes | What it answers | Access reality |
|---|---|---|---|
| Quota pools | `/api/quota/pools`, `/api/quota/pools/{id}`, `/api/quota/pools/{id}/usage` | pool allocations, per-key consumption, burn-rate snapshots | Treat as management-gated on `requireLogin`; a key-only client cannot rely on reading it |
| Provider plans | `/api/quota/plans`, `/api/quota/plans/{connectionId}` | resolved catalog/manual provider plan limits | Treat as management-gated on `requireLogin` |
| Enforcement preview | `GET /api/quota/preview` | dry-run quota enforcement check; no consumption recorded | Treat as management-gated on `requireLogin` |
| Usage records | `/api/usage/analytics`, `/api/usage/call-logs`, `/api/usage/history`, `/api/usage/logs`, `/api/usage/proxy-logs`, `/api/usage/budget` | calls, history, logs, analytics, budget status | Management-gated |

If the agent only has `$OMNIROUTE_API_KEY`, it cannot truthfully report current provider counters. Say management session required, then point the user to the OmniRoute dashboard and the upstream provider console.

Limit nuance to preserve:

- Codex and Claude pools may expose session/rolling-window details when OmniRoute has synced or configured them.
- GLM plan limits can be plan-specific, and some models may consume at different multipliers.
- Xiaomi MiMo monthly credits can be shared across related MiMo model pools with different credit multipliers.
- `opencode-go/*` may work for chat while still not exposing detailed counters in OmniRoute; if no counter is available, say so instead of inventing one.

## 6. Failure triage next steps

For status/code classification, read the canonical table in [api-access.md](api-access.md); do not duplicate it here. Add these operational checks after classifying the failure:

- Re-run `GET /v1/models` with the same key to separate auth/catalog failure from one-model failure.
- Re-run the deterministic non-streaming chat smoke test on the exact model ID.
- Capture routed provider/model headers and request IDs before changing configuration.
- For management routes returning `403 AUTH_001`, switch to a dashboard session cookie or stop and report "management session required".
- For upstream-looking `403`, `429`, or `5xx`, compare OmniRoute logs with the provider console before blaming OmniRoute routing.
- For Cloudflare/HTML bodies, retry with OpenAI/browser UA or the real client before marking the provider broken.
- For quota/limit questions without a management session, report that counters are unavailable to a key-only client and point to dashboard/provider console.

## 7. User-facing output contract

Return this shape after an operational check. Redact secrets and keep evidence short.

```markdown
## OmniRoute check

- Base URL tested: `<base-or-origin>`
- Key source: `<env/file/secure-context>`, redacted as `<redaction-summary>`
- Models checked:
  - `<model-id>`

| Model | Route | HTTP | Routed provider/model | Result |
|---|---|---:|---|---|
| `<model-id>` | `POST /v1/chat/completions` | `<status>` | `<provider>/<model or unavailable>` | `<short content, e.g. 121042, or concise error>` |

- Limits: `<only include values when a management session was available; otherwise: management session required, use OmniRoute dashboard/provider console>`
- Conclusion: `<works | broken | auth issue | upstream issue>` — `<one sentence with the decisive evidence>`
```

Related references: [api-access.md](api-access.md) for auth/headers/errors, [inference.md](inference.md) for model-calling surfaces, [capabilities.md](capabilities.md) for management areas, [../scripts/omniroute_inspect.py](../scripts/omniroute_inspect.py) for scripted inspection, and [../SKILL.md](../SKILL.md) for skill loading criteria.
