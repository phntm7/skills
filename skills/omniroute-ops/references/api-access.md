# OmniRoute API Access

Purpose: give agents the safe way to reach OmniRoute's API, choose the right auth class, and classify failures without leaking secrets.
Load this when choosing an OmniRoute base URL, attaching credentials, setting request headers, or diagnosing an API failure. This file is [references/api-access.md](api-access.md) and owns the canonical auth/header/error reference for [SKILL.md](../SKILL.md), [references/inference.md](inference.md), [references/capabilities.md](capabilities.md), [references/operations.md](operations.md), and [scripts/omniroute_inspect.py](../scripts/omniroute_inspect.py).

## 1. Auth classes: do not mix them

OmniRoute uses two separate schemes, not interchangeable credentials. Its route-aware authz pipeline classifies requests as `PUBLIC`, `CLIENT_API`, or `MANAGEMENT`; unclassified routes fail closed to `MANAGEMENT`. That is why a normal API key can call inference but still gets rejected by most `/api/*` admin routes when `requireLogin` is enabled.

| Auth class | Credential | Governs | What a default API key can do |
|---|---|---|---|
| `BearerAuth` | `Authorization: Bearer <key>` | `/v1/*` and `/api/v1/*` proxy/inference routes: chat, models, embeddings, images, audio, moderations, rerank, responses, messages, v1beta; plus `/api/*` helpers the spec/endpoint map marks Bearer: playground, compression preview/language-packs/rules, `/api/quota/*`, `/api/settings/quota-store`, `/api/compliance/audit-log`, and `/api/agent-skills/generate` | Call inference and catalog routes; cannot assume access to management/admin state |
| `ManagementSessionAuth` | `Cookie: auth_token=<session-cookie>` | Most `/api/*` management/admin routes: providers, keys, combos, settings, usage, quota, rate limits, memory, resilience, cache, telemetry, system, AgentBridge, Traffic Inspector, CLI tools, embedded services, cloud, evals, OAuth, db-backups, OpenAPI spec, agent-skills catalog | Not reachable with a default API key; use a dashboard session cookie or a Bearer key that explicitly carries `manage`/`admin` scope |

Live-verified behavior on a `requireLogin` instance:

| Request with a valid default Bearer key | Result |
|---|---|
| `GET /v1/models` | `200` |
| `GET /api/v1/models` | `200` |
| `GET /api/providers` | `403 {"error":{"code":"AUTH_001","message":"Invalid management token","correlation_id":"..."}}` |
| `GET /api/rate-limits` | same `403 AUTH_001` |
| `GET /api/quota/*` including `/api/quota/pools` and `/api/quota/preview` | same `403 AUTH_001` |
| `GET /api/openapi/spec` | same `403 AUTH_001` |

Important caveat: the endpoint map/spec marks some `/api/quota/*` routes as Bearer, but live behavior gates them behind management auth on `requireLogin` instances. When an agent has only `$OMNIROUTE_API_KEY`, treat `/api/*` as management-gated unless the target route is known proxy/inference (`/api/v1/*`) or explicitly documented as a Bearer-compatible helper.

## 2. Base URL selection and `/v1` normalization

| Environment | Use this base |
|---|---|
| Same Docker/Compose network | `http://omniroute:20128` |
| Host/local DNS through Traefik | `http://omniroute.lo` |
| Custom tunnel, port forward, or nonstandard deploy | `$OMNIROUTE_BASE_URL` |

Prominent rule: `OMNIROUTE_BASE_URL` may already include `/v1` (for example `http://omniroute.lo/v1`). Keep `/v1` for inference, but strip a trailing `/v1` before building any `/api/*` management URL.

| Target | Build URL as | Example when `OMNIROUTE_BASE_URL=http://omniroute.lo/v1` |
|---|---|---|
| Inference/catalog | keep or append `/v1` | `GET http://omniroute.lo/v1/models` |
| `/api/v1/*` proxy alias | origin + `/api/v1/...` | `POST http://omniroute.lo/api/v1/chat/completions` |
| `/api/*` management/admin | origin + `/api/...`; never `/v1/api/...` | `GET http://omniroute.lo/api/providers` |

Safe normalization pattern: derive `origin` by removing one trailing `/v1` from the configured base, then build management URLs from `origin`.

## 3. Key sources and redaction rules

Read credentials only from:

1. `OMNIROUTE_API_KEY` for a Bearer key.
2. `OMNIROUTE_API_KEY_FILE` for a file containing the Bearer key.
3. An explicitly supplied secure context.
4. A dashboard session cookie only when the user intentionally supplies it: `Cookie: auth_token=<session-cookie>`.

Rules:

- Never hardcode a real API key, session cookie, provider token, or OAuth credential.
- Never print full secrets. If a diagnostic needs proof of which key was used, report only source plus length/prefix/suffix, e.g. `env OMNIROUTE_API_KEY, len=..., suffix=...`.
- Treat keys in URLs as secrets because URLs land in shell history, proxies, access logs, crash reports, and browser history.
- Do not infer current provider IDs, quotas, or model catalogs from old notes; fetch live state when credentials allow it.

## 4. Key-in-URL compatibility

Preferred auth is always `Authorization: Bearer $OMNIROUTE_API_KEY`. For clients that cannot set headers, `docs/reference/API_REFERENCE.md` documents these compatibility variants:

| Variant | Example shape | Use only when |
|---|---|---|
| Query `token` | `/v1/models?token=<OMNIROUTE_API_KEY>` | The client cannot send `Authorization` |
| Query `apiKey` | `/v1/models?apiKey=<OMNIROUTE_API_KEY>` | Compatibility with camelCase config |
| Query `api_key` | `/v1/models?api_key=<OMNIROUTE_API_KEY>` | Compatibility with snake_case config |
| Query `key` | `/v1/models?key=<OMNIROUTE_API_KEY>` | Last-resort compatibility |

Dedicated tokenized VS Code/OpenAI aliases:

| Method | Path | Meaning |
|---|---|---|
| `GET` | `/api/v1/vscode/{token}/` | OpenAI catalog alias |
| `GET` | `/api/v1/vscode/{token}/models` | OpenAI models alias |
| `POST` | `/api/v1/vscode/{token}/chat/completions` | OpenAI chat tokenized alias |
| `POST` | `/api/v1/vscode/{token}/responses` | OpenAI Responses tokenized alias |
| `POST` | `/api/v1/vscode/{token}/api/chat` | Ollama chat tokenized alias |
| `GET` | `/api/v1/vscode/{token}/api/tags` | Ollama tags tokenized alias |

Do not use URL tokens in examples unless the target client cannot attach headers. When you must show them, use `<OMNIROUTE_API_KEY>` only.

## 5. Standard headers

Request headers from `docs/reference/API_REFERENCE.md`:

| Header | Direction | Use |
|---|---|---|
| `Authorization: Bearer $OMNIROUTE_API_KEY` | Request | Bearer auth for `/v1/*`, `/api/v1/*`, and Bearer-compatible helper routes |
| `Cookie: auth_token=<session-cookie>` | Request | Management session auth for most `/api/*` admin routes |
| `X-OmniRoute-No-Cache: true` | Request | Bypass cache |
| `X-OmniRoute-Progress: true` | Request | Ask for progress tracking/events |
| `X-Session-Id: <id>` | Request | Sticky external session affinity |
| `x_session_id: <id>` | Request | Underscore variant accepted on direct HTTP |
| `Idempotency-Key: <key>` | Request | Deduplicate within a short window documented as 5s |
| `X-Request-Id: <id>` | Request | Alternative dedup/request correlation key |

Nginx caveat: if relying on underscore headers such as `x_session_id`, configure `underscores_in_headers on;`. Prefer `X-Session-Id` when a proxy path may drop underscore headers.

Response headers from the API reference, authz guide, and live observations:

| Header | Direction | Meaning |
|---|---|---|
| `X-OmniRoute-Cache` | Response | `HIT` or `MISS` on non-streaming responses |
| `X-OmniRoute-Idempotent` | Response | `true` when a request was deduplicated |
| `X-OmniRoute-Progress` | Response | `enabled` when progress tracking is active |
| `X-OmniRoute-Session-Id` / `X-Omniroute-Session-Id` | Response | Effective session ID used by OmniRoute |
| `X-Request-Id` | Response | Correlation/request ID; authz errors also include a `correlation_id` body field |
| `X-Omniroute-Route-Class` | Response | Route classifier such as `PUBLIC`, `CLIENT_API`, or `MANAGEMENT`; live routed chat showed `CLIENT_API` |
| `X-Omniroute-Provider` | Response | Routed provider on successful routed responses |
| `X-Omniroute-Model` | Response | Routed model on successful routed responses |

## 6. Canonical error and failure-class table

Use this table before declaring OmniRoute, a provider, or a model broken.

| Symptom | Likely cause | Next check |
|---|---|---|
| `401` on `/v1/*` or `/api/v1/*` proxy route | Missing, malformed, inactive, or wrong Bearer key when API-key enforcement is enabled | Verify the key source (`OMNIROUTE_API_KEY`, `OMNIROUTE_API_KEY_FILE`, or secure context) without printing it; retry `GET /v1/models` with `Authorization: Bearer $OMNIROUTE_API_KEY`; do not switch to management cookie for inference |
| `401 AUTH_001` with message like `Authentication required` on a management route | No dashboard session and no management-grade Bearer credential | Use `Cookie: auth_token=<session-cookie>` or a Bearer key with `manage`/`admin` scope; if the agent only has a default key, stop and report management session required |
| `403 {"error":{"code":"AUTH_001","message":"Invalid management token","correlation_id":"..."}}` on `/api/providers`, `/api/rate-limits`, `/api/quota/*`, `/api/openapi/spec`, or similar `/api/*` | A default Bearer key hit a `MANAGEMENT` route, or a Bearer key lacks management scope. Live-verified: these routes return this 403 even when `/v1/models` succeeds with the same key | Do not call it a broken key. Strip any trailing `/v1` from the base, then retry only with a dashboard session cookie or manage/admin-scoped key; otherwise route the user to the dashboard/provider console |
| `403` with HTML body, Cloudflare/access-denied page, or non-JSON upstream response | Upstream anti-bot or request-shape block, commonly seen with raw HTTP clients against some provider-backed routes | Retry with the real client or a browser/OpenAI-style `User-Agent`; compare OmniRoute logs for upstream status/body and preserve `X-Request-Id`; do not mark the model broken if the real client succeeds |
| Proxy JSON envelope: `{"error":{"message":"[<model-id>] [<status>]: <detail>"}}` | OmniRoute routed the request, but the selected provider/model failed upstream; the model may be listed but not actually serving | Re-run `GET /v1/models` only to confirm catalog presence, then smoke-test the exact model non-streaming; compare another model/provider, routed provider/model headers, request ID, and provider console/logs |
| `429` | Rate limit, quota exhaustion, or provider-side throttling | Capture `X-Request-Id`, routed provider/model, and any retry/rate-limit body; if a management session is available inspect `/api/rate-limits`, `/api/quota/*`, and `/api/usage/*`; with only a default key, say counters require a management session and check the upstream provider console |
| `5xx` from a routed request | Provider adapter failure, upstream outage, resilience/circuit-breaker path, or malformed upstream response | Retry once with the deterministic non-streaming chat smoke test for the same model; compare another model; preserve `X-Request-Id`, `X-Omniroute-Provider`, `X-Omniroute-Model`, and logs before changing configuration |
| `404` after constructing an `/api/*` URL from a base ending in `/v1` | Base URL normalization bug: management routes live at the origin, not under `/v1/api/*` | Rebuild from `origin = OMNIROUTE_BASE_URL` with one trailing `/v1` stripped; call `{origin}/api/...` |

See [references/operations.md](operations.md) for the step-by-step triage procedure, [references/inference.md](inference.md) for model-calling surfaces, and [references/capabilities.md](capabilities.md) for management capability areas.

## Source anchors

- `docs/reference/openapi.yaml` (OmniRoute API v3.8.27): canonical API title/version, auth overview, and endpoint security scheme names.
- `local://omniroute-endpoint-map.md`: grouped endpoint map and route security labels.
- `docs/reference/API_REFERENCE.md`: custom header table, key-in-URL variants, and `/api/v1/vscode/{token}/...` aliases.
- `docs/architecture/AUTHZ_GUIDE.md`: fail-closed `PUBLIC`/`CLIENT_API`/`MANAGEMENT` pipeline, `requireManagementAuth`, manage/admin scope caveat, 401-vs-403 split, and route-class/request-id headers.
- `local://omniroute-contract.md`: live-verified Bearer-vs-management behavior, base URL rules, redaction rules, and live routed response headers.
