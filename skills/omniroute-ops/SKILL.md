---
name: omniroute-ops
description: >
  Use when calling or troubleshooting OmniRoute APIs, authentication, quotas, or
  provider-routing combos; it provides safe workflows for discovery, requests, and failure diagnosis.
---

# OmniRoute Ops

Answer OmniRoute questions and drive its API with live, grounded evidence — never stale
model lists, guessed routes, or invented quota numbers. OmniRoute state is dynamic: fetch
models, providers, and limits at runtime.

## What OmniRoute is

A local-first, OpenAI-compatible AI gateway (default port `20128`). One endpoint fans every
request out to ~226 providers (50+ free) and returns an OpenAI-shaped response. Around the
proxy it layers: combo routing with auto-fallback, RTK + Caveman prompt compression, usage
and quota tracking, conversational memory, guardrails, an MCP server and an A2A server, and a
three-layer resilience model (provider circuit breaker, per-connection cooldown, per-model
lockout).

Request pipeline: `client -> API-key/session auth -> authz (route classifier + policy) ->
routing/combo selection -> compression -> provider adapter -> resilience + usage tracking ->
OpenAI-shaped response`. Deep dive: [references/capabilities.md](references/capabilities.md).

## The one rule that trips everyone: two auth classes

OmniRoute has two independent auth schemes. A client holding only an API key can call the
inference surface but is **locked out of most admin routes**.

| Auth class | Credential | Governs | Reachable with API key alone? |
|---|---|---|---|
| `BearerAuth` | `Authorization: Bearer <key>` | `/v1/*` and `/api/v1/*` proxy/inference (chat, models, embeddings, images, audio, moderations, rerank, responses, messages, v1beta) + a few `/api/*` routes (playground, compression preview) | Yes |
| `ManagementSessionAuth` | `Cookie: auth_token=<session>` | Most `/api/*` management/admin routes (providers, keys, combos, settings, usage, quota, memory, resilience, telemetry, system, agent-skills catalog) | No — needs a dashboard login session |

Verified: on a `requireLogin` instance, a valid Bearer key returns `200` for
`GET /v1/models` but `403 {"error":{"code":"AUTH_001","message":"Invalid management
token",...}}` for `/api/providers`, `/api/rate-limits`, `/api/quota/*`, `/api/openapi/spec`.
When a key-only agent is asked about providers/quota/limits, say those need a management
session and route the user to the dashboard rather than reporting a 403 as "broken". Full
auth details: [references/api-access.md](references/api-access.md).

## Base URL and the `/v1` trap

| Environment | Base |
|---|---|
| Same Docker/Compose network | `http://omniroute:20128` |
| Host / local DNS via Traefik | `http://omniroute.lo` |
| Anything else | set `OMNIROUTE_BASE_URL` |

`OMNIROUTE_BASE_URL` often already ends in `/v1` (e.g. `http://omniroute.lo/v1`). Inference
lives under `/v1` and `/api/v1`; every `/api/*` management route lives at the **root**. Strip
a trailing `/v1` before building `/api/*` URLs or you get a 404.

## Keys and secrets (Core Rules)

- Treat OmniRoute state as dynamic. Never hardcode API keys, provider/connection IDs, current
  quotas, or model catalogs in answers.
- Read the key only from the caller's environment (`OMNIROUTE_API_KEY`), a secret file
  (`OMNIROUTE_API_KEY_FILE`), or explicitly provided secure context. Never print full secrets —
  length/prefix/suffix only if a check truly needs it.
- A management session cookie is a secret too; never embed or echo it.

## Quick start

```bash
# 1. Discover the live catalog (Bearer key)
python3 scripts/omniroute_inspect.py models        # OpenAI-shaped /v1/models
python3 scripts/omniroute_inspect.py catalog       # namespace/prefix breakdown

# 2. Smoke-test a route (deterministic, non-streaming)
python3 scripts/omniroute_inspect.py chat --model <model-id> \
  --prompt "Calculate 95222+25820, and reply with the result only."   # expect 121042

# 3. Admin reads (need a management session cookie; 403 AUTH_001 without one)
python3 scripts/omniroute_inspect.py providers --cookie "$OMNIROUTE_SESSION_COOKIE"
python3 scripts/omniroute_inspect.py quota --cookie "$OMNIROUTE_SESSION_COOKIE"
```

The script is stdlib-only, scrubs secrets from output, and defaults to a browser/OpenAI
user-agent (some upstreams — notably `opencode-go/*` — 403 behind Cloudflare with Python's
default `urllib` UA even though real clients work).

## Capability map

| Area | Endpoints (representative) | Auth | Reference |
|---|---|---|---|
| Chat / Responses / Messages | `POST /v1/chat/completions`, `/v1/responses`, `/v1/messages` | Bearer | [inference.md](references/inference.md) |
| Embeddings / Images / Audio / Rerank / Moderations | `POST /v1/embeddings`, `/v1/images/generations`, `/v1/audio/*`, `/v1/rerank`, `/v1/moderations` | Bearer | [inference.md](references/inference.md) |
| Catalogs | `GET /v1/models`, `/v1/embeddings`, `/v1/images/generations`, `/v1/search` | Bearer | [inference.md](references/inference.md) |
| Files / Batches / Search / WebSocket | `/v1/files`, `/v1/batches`, `/v1/search`, `/v1/ws`, `/v1/responses` (WS, codex) | Bearer | [inference.md](references/inference.md) |
| Compat formats | Anthropic `/v1/messages`, Gemini `/v1beta`, Ollama `/v1/api/chat` | Bearer | [inference.md](references/inference.md) |
| Combos & Auto-Combo | `auto`/`auto/*` model ids, `GET/POST /api/combos`, `/api/fallback/chains` | Mgmt (admin) / Bearer (use `auto`) | [capabilities.md](references/capabilities.md) |
| Providers & nodes | `GET /api/providers`, `/api/provider-nodes` | Mgmt | [capabilities.md](references/capabilities.md) |
| Usage / Quota / Pricing | `/api/usage/*`, `/api/quota/*`, `/api/pricing` | Mgmt | [capabilities.md](references/capabilities.md) · [operations.md](references/operations.md) |
| Resilience / Rate limits | `/api/resilience`, `/api/rate-limit(s)` | Mgmt | [capabilities.md](references/capabilities.md) |
| Compression / Memory | `/api/compression/*`, `/api/memory*`, `/api/settings/qdrant/*` | Bearer (preview) / Mgmt | [capabilities.md](references/capabilities.md) |
| Frameworks | MCP server, A2A server, AgentBridge, Traffic Inspector, Agent Skills catalog | Mgmt | [capabilities.md](references/capabilities.md) |

## Reference selection

- Calling the API (auth, base URL, headers, key-in-URL/vscode routes, error/failure classes):
  read [references/api-access.md](references/api-access.md).
- Inference surface (chat, embeddings, images, audio, rerank, search, files, batches, WS,
  compat formats, model-id namespacing, smoke tests): read [references/inference.md](references/inference.md).
- Architecture and the full management/framework capability surface: read
  [references/capabilities.md](references/capabilities.md).
- Operational triage, quota/limit interpretation, the opencode-go UA trap, and the
  user-facing output contract: read [references/operations.md](references/operations.md).

## Output contract

When summarizing an operational check for a user, use the structure in
[references/operations.md](references/operations.md): base URL tested, key source (redacted),
models checked, per-model result (HTTP status, routed provider/model, short content or error),
limits when a management session is available, and a one-line conclusion (works / broken /
auth issue / upstream issue).

## Trigger examples

Should trigger:

- "What can OmniRoute do and how do I call its API?"
- "List OmniRoute models and smoke-test whether `cx/codex-auto-review` works."
- "Does OmniRoute expose Codex/Claude/GLM/Xiaomi usage limits, and how do I read them?"
- "Which routing combo should I use to drain my subscription first?"
- "Why does `/api/providers` return 403 AUTH_001 with my API key?"
- "Why does opencode-go 403 from my script but work in my IDE?"

Should not trigger:

- "Pick the best LLM for my app" with no OmniRoute or provider-routing context.
- "Configure Docker Compose for an unrelated service."
