# OmniRoute capabilities

Load this when you need to explain what OmniRoute provides, how the management/framework surface is organized, or which non-inference endpoints exist. For auth mechanics read [references/api-access.md](api-access.md); for model-calling routes read [references/inference.md](inference.md).

Related skill files: [SKILL.md](../SKILL.md), [references/api-access.md](api-access.md), [references/inference.md](inference.md), [references/operations.md](operations.md), [scripts/omniroute_inspect.py](../scripts/omniroute_inspect.py).

## Management-gated by default

Most `/api/*` routes below are **management/dashboard routes**. A normal OmniRoute API key can call the inference surface, but it cannot usually read providers, keys, combos, usage, quota, memory, settings, telemetry, system state, or the Agent Skills catalog.

Verified behavior on a `requireLogin` instance: a valid Bearer key returned `200` for `GET /v1/models` and `GET /api/v1/models`, but `403 AUTH_001 Invalid management token` for `/api/providers`, `/api/rate-limits`, `/api/openapi/spec`, `/api/agent-skills`, `/api/models`, `/api/quota/pools`, and `/api/quota/preview`.

Bearer-accessible exceptions to remember:

- Playground: `/api/playground/*`.
- Compression previews/catalogs: `POST /api/compression/preview`, `GET /api/compression/language-packs`, `GET /api/compression/rules`.
- Quota is marked `BearerAuth` in the spec, but the live instance still gated `/api/quota/*`; warn users it may 403 and use the dashboard/management session when possible.

Base URL trap: `/v1` and `/api/v1` are inference aliases, but management routes live at the root. If `OMNIROUTE_BASE_URL` ends in `/v1`, strip that suffix before constructing `/api/*` URLs. Details: [references/api-access.md](api-access.md).

## Architecture and request pipeline

OmniRoute is a local-first, OpenAI-compatible gateway. Clients point at one endpoint; OmniRoute routes across roughly 226 providers, tracks usage/quota, can compress prompts, can inject/retrieve memory, and returns OpenAI-shaped responses.

Pipeline:

```text
client -> API-key/session auth -> authz (route classifier + policy) -> routing/combo selection -> compression -> provider adapter -> resilience + usage tracking -> OpenAI-shaped response
```

Operational model:

- **Authz is route-class based.** `CLIENT_API` covers `/v1/*` and `/api/v1/*`; `MANAGEMENT` covers dashboard/admin routes and fails closed when classification is uncertain.
- **Routing is combo-aware.** A model id can be a direct provider-prefixed model or an `auto*` virtual combo id; actual call shapes belong in [references/inference.md](inference.md).
- **Fallback is tiered.** The README describes the intended fallback ladder as `Subscription -> API -> Cheap -> Free` so paid subscriptions are drained before paid API calls and free/always-on providers.
- **Resilience has three scopes.** Provider circuit breaker, connection cooldown, and provider+connection+model lockout are separate so one bad model/key does not disable the whole router.
- **Local state is primary.** Providers, keys, combos, settings, pricing, usage, memory, audit logs, and backup data are stored locally; cloud/sync is optional.

Sources: `README.md`, `docs/reference/openapi.yaml`, `docs/reference/API_REFERENCE.md`, `docs/architecture/ARCHITECTURE.md`, `docs/architecture/AUTHZ_GUIDE.md`, `docs/architecture/RESILIENCE_GUIDE.md`.

## Capability map

| Area | Purpose | Key endpoints / entry points | Auth class | Docs |
|---|---|---|---|---|
| Model catalog & aliases | Inspect the management model catalog and create aliases that normalize model naming across provider/proxy dialects. | `/api/models`, `/api/models/catalog`, `/api/models/alias` | Management session. Bearer model catalogs are inference-surface routes and belong in [references/inference.md](inference.md). | `docs/reference/openapi.yaml` tag `Models`; `docs/architecture/ARCHITECTURE.md` |
| Providers & Provider Nodes | Manage upstream provider accounts, credentials, connection tests, imported local tokens, custom provider nodes, and provider model inventories. | `/api/providers`, `/api/providers/{id}`, `/api/providers/{id}/test`, `/api/providers/test-batch`, `/api/providers/validate`, `/api/providers/agy-auth/*`, `/api/provider-nodes`, `/api/provider-models` | Management session. Spec rows are mostly `none`; live `requireLogin` gates these as management. | `docs/reference/openapi.yaml` tags `Providers`, `Provider Nodes`; `docs/architecture/ARCHITECTURE.md` |
| API Keys | Create, inspect, update, and revoke OmniRoute endpoint keys; keys can carry scopes such as MCP/manage in current authz docs. | `/api/keys`, `/api/keys/{id}` | Management session. | `docs/reference/openapi.yaml` tag `API Keys`; `docs/architecture/AUTHZ_GUIDE.md`; `docs/security/COMPLIANCE.md` |
| Combos + Auto-Combo | Define persisted routing chains and use virtual `auto*` combos that score live provider candidates per request. | `/api/combos`, `/api/combos/{id}`, `/api/combos/metrics`, `/api/combos/test`; virtual model ids `auto`, `auto/coding`, `auto/fast`, `auto/cheap`, `auto/offline`, `auto/smart` (doc also mentions `auto/lkgp` alias) | Management session for combo CRUD/test/metrics; Bearer clients can use `model: "auto..."` on inference calls. | `docs/routing/AUTO-COMBO.md`; `docs/architecture/ARCHITECTURE.md` |
| Fallback chains | Manage named fallback chains used by routing policy and combo behavior. | `/api/fallback/chains` (`GET`, `POST`, `DELETE`) | Management session. | `docs/reference/openapi.yaml` tag `Fallback`; `docs/architecture/ARCHITECTURE.md` |
| Resilience | Configure/reset provider health controls and inspect live resilience state. | `/api/resilience`, `/api/resilience/reset`, `/api/monitoring/health`; doc also describes model cooldown routes under `/api/resilience/model-cooldowns` | Management session; health may be read-only/public in some configs, but treat as management unless the instance exposes it. | `docs/architecture/RESILIENCE_GUIDE.md`; `docs/architecture/AUTHZ_GUIDE.md` |
| Compression | Preview and configure RTK + Caveman prompt compression; RTK handles command/tool output, Caveman handles semantic condensation, stacked mode commonly runs `RTK -> Caveman`. | `/api/compression/*` (`preview`, `language-packs`, `rules`), `/api/settings/compression`, `/api/context/rtk/*` (`config`, `filters`, `test`, `raw-output/{id}`) | Mixed: preview/language-packs/rules are Bearer; settings and RTK config/filter/test/raw-output are management session. | `docs/compression/COMPRESSION_GUIDE.md`; `docs/reference/openapi.yaml` tag `Compression` |
| Memory | Store/retrieve conversational memory scoped primarily by API key, with SQLite FTS5 keyword search, optional sqlite-vec, and optional Qdrant vector backend. | `/api/memory*` (`/api/memory`, `/api/memory/{id}`, health, preview, engine status, summarize, reindex), `/api/settings/memory`, `/api/settings/qdrant/*` | Management session. | `docs/frameworks/MEMORY.md`; `docs/reference/openapi.yaml` tag `Memory` |
| Pricing | Manage and read model pricing used by cost reporting and cost-aware routing. | `/api/pricing`, `/api/pricing/defaults`, `/api/pricing/models` | Management session. | `docs/reference/openapi.yaml` tag `Pricing`; `docs/architecture/ARCHITECTURE.md` |
| Usage / Analytics + Quota | Inspect usage analytics, request/call/proxy logs, budgets, quota pools, resolved provider plans, and quota preview checks. | `/api/usage/*` (`analytics`, call/history/proxy/request logs, `budget`); `/api/quota/*` (`pools`, `pools/{id}/usage`, `plans`, `plans/{connectionId}`, `preview`) | Usage is management session. Quota is `BearerAuth` in the spec but live `requireLogin` gated it with `AUTH_001`; treat as management-gated unless proven otherwise. | `docs/reference/openapi.yaml` tags `Usage`, `Quota`; `docs/architecture/ARCHITECTURE.md`; [references/operations.md](operations.md) |
| Settings | Read/update global app, proxy, payload rules, combo defaults, login, IP filter, system prompt, thinking budget, rate limit, and quota-store settings. | `/api/settings`, `/api/settings/purge-request-history`, `/api/settings/payload-rules`, `/api/settings/combo-defaults`, `/api/settings/proxy`, `/api/settings/proxy/test`, `/api/settings/require-login`, `/api/settings/ip-filter`, `/api/settings/system-prompt`, `/api/settings/thinking-budget`, `/api/rate-limit`, `/api/rate-limits`, `/api/settings/quota-store` | Management session. Spec marks quota-store as Bearer, but it changes backend quota storage; do not assume a key-only agent can safely call it. | `docs/reference/openapi.yaml` tag `Settings`; `docs/architecture/AUTHZ_GUIDE.md` |
| MCP server | Expose OmniRoute as an MCP server with routing, health, combo, quota, usage, cache, compression, memory, skills, catalog, and context-source tools. | Transports from docs: `/api/mcp/sse`, `/api/mcp/stream`; management/status docs: `/api/mcp/status`, `/api/mcp/tools`, `/api/mcp/audit`, `/api/mcp/audit/stats` | Local-only by default; remote MCP transport can use Bearer with `manage` scope. Status/catalog/audit are management. | `docs/frameworks/MCP-SERVER.md`; `docs/architecture/AUTHZ_GUIDE.md` |
| A2A server | Expose OmniRoute as an A2A v0.3 JSON-RPC agent for smart routing, quota, discovery, cost, and health workflows. | `POST /a2a`, `GET /.well-known/agent.json`; auxiliary REST from docs: `/api/a2a/status`, `/api/a2a/tasks`, `/api/a2a/tasks/{id}`, `/api/a2a/tasks/{id}/cancel` | `/a2a` uses Bearer API key when keys are configured; `/api/a2a/*` helpers are management where not public status. | `docs/frameworks/A2A-SERVER.md`; `docs/frameworks/AGENT_PROTOCOLS_GUIDE.md` |
| AgentBridge | Local MITM bridge that reroutes supported IDE agent HTTPS traffic through OmniRoute, with model mappings, CA management, bypass rules, and Traffic Inspector publishing. | `/api/tools/agent-bridge/agents`, `/api/tools/agent-bridge/state`, `/api/tools/agent-bridge/server`, `/api/tools/agent-bridge/agents/{agentId}/dns`, `/api/tools/agent-bridge/agents/{agentId}/mappings`, `/api/tools/agent-bridge/bypass`, `/api/tools/agent-bridge/cert`, `/api/tools/agent-bridge/upstream-ca` | `LOCAL_ONLY` + management session; do not expose through tunnels. | `docs/frameworks/AGENTBRIDGE.md`; `docs/frameworks/TRAFFIC_INSPECTOR.md` |
| Traffic Inspector | Local LLM-aware HTTPS debugger for AgentBridge/custom-host/HTTP_PROXY/system-proxy capture, WebSocket live view, replay, annotations, sessions, and HAR export. | `/api/tools/traffic-inspector/requests`, `/api/tools/traffic-inspector/requests/{id}`, `/api/tools/traffic-inspector/requests/{id}/replay`, `/api/tools/traffic-inspector/ws`, `/api/tools/traffic-inspector/export.har`, `/api/tools/traffic-inspector/hosts`, `/api/tools/traffic-inspector/capture-modes/*`, `/api/tools/traffic-inspector/sessions`, `/api/tools/traffic-inspector/internal/ingest` | `LOCAL_ONLY` + management session; request bodies and headers may contain sensitive data even when masked. | `docs/frameworks/TRAFFIC_INSPECTOR.md`; `docs/frameworks/AGENTBRIDGE.md` |
| CLI Tools | Detect/configure local coding CLIs and tool-specific settings/backups/profiles. | `/api/cli-tools/*` (`backups`, `runtime/{toolId}`, `guide-settings/{toolId}`, Antigravity MITM, Claude/Cline/Codex/Droid/Kilo/OpenClaw settings, Codex profiles) | Management session; runtime paths are local-only and not manage-scope bypassable per authz guide. | `docs/reference/openapi.yaml` tag `CLI Tools`; `docs/frameworks/AGENT_PROTOCOLS_GUIDE.md` |
| Embedded Services | Install/control local helper services 9Router and CLIProxyAPI and stream their logs. | `/api/services/*` for 9Router and CLIProxyAPI install/start/stop/restart/update/status/auto-start plus `/api/services/{name}/logs`; includes 9Router key rotation | `LOCAL_ONLY` + management session; these spawn/control local services. | `docs/reference/openapi.yaml` tag `Embedded Services`; `docs/architecture/AUTHZ_GUIDE.md` |
| Cloud / Sync | Sync local state to cloud plumbing and orchestrate third-party cloud coding agents as long-running tasks. | `/api/sync/cloud`, `/api/sync/initialize`; `/api/cloud/auth`, `/api/cloud/credentials/update`, `/api/cloud/model/resolve`, `/api/cloud/models/alias`; cloud-agent lifecycle docs: `/api/v1/agents/tasks*` | Management session. `docs/frameworks/CLOUD_AGENT.md` explicitly requires management auth for `/api/v1/agents/tasks*`. | `docs/frameworks/CLOUD_AGENT.md`; `docs/frameworks/AGENT_PROTOCOLS_GUIDE.md`; `docs/reference/openapi.yaml` tag `Cloud` |
| Evals | Run built-in/custom evaluation suites against direct models or combos and persist scorecards/history. | `/api/evals`, `/api/evals/{suiteId}`; docs also describe `/api/evals/suites*` for custom suite CRUD. | Management session. | `docs/frameworks/EVALS.md`; `docs/reference/openapi.yaml` tag `System` |
| Policies / Compliance | Manage routing policies and read audit/compliance logs for admin, provider credential, MCP, and usage events. | `/api/policies`, `/api/compliance/audit-log`; docs also describe `/api/mcp/audit`, `/api/mcp/audit/stats` | Policies are management session. Audit log is marked Bearer in the spec, but it is sensitive management data; prefer management session unless the deployment explicitly allows scoped Bearer access. | `docs/security/GUARDRAILS.md`; `docs/security/COMPLIANCE.md`; `docs/reference/openapi.yaml` tag `System` |
| OAuth | Run/import provider OAuth flows and local OAuth credential imports. | `/api/oauth/*`: `/api/oauth/{provider}/{action}`, Cursor auto-import/import, Kiro auto-import/import/social-authorize/social-exchange | Dashboard/session-owned flow, not the normal Bearer inference surface. | `docs/reference/openapi.yaml` tag `OAuth`; `docs/architecture/AUTHZ_GUIDE.md` |
| Agent Skills catalog | Self-expose OmniRoute `SKILL.md` files so external agents can discover API/CLI capabilities without guessing routes. | `GET /api/agent-skills`, `GET /api/agent-skills/{id}`, `GET /api/agent-skills/{id}/raw`, `GET /api/agent-skills/coverage`, `POST /api/agent-skills/generate` | Catalog reads are management-gated on live `requireLogin` despite spec `none`; generator is BearerAuth in the spec but should be treated as privileged. | `docs/frameworks/AGENT-SKILLS.md`; `docs/frameworks/SKILLS.md`; `docs/reference/openapi.yaml` tag `Agent Skills` |
| System / Backup | Bootstrap/auth/logout, runtime control, database backups, storage health, cache state, sessions, and OpenAPI spec catalog. | `/api/auth/login`, `/api/auth/logout`, `/api/init`, `/api/restart`, `/api/shutdown`, `/api/db-backups`, `/api/storage/health`, `/api/sessions`, `/api/cache`, `/api/cache/stats`, `/api/openapi/spec`, `/api/tags` | Mixed bootstrap/public and management; do not assume Bearer access. Live Bearer probe for `/api/openapi/spec` returned `AUTH_001`. | `docs/reference/openapi.yaml` tag `System`; `docs/architecture/AUTHZ_GUIDE.md`; `docs/architecture/ARCHITECTURE.md` |
| Telemetry / Token-health | Read provider/router telemetry summaries and token health status. | `/api/telemetry/summary`, `/api/token-health` | Management session. | `docs/reference/openapi.yaml` tag `Telemetry`; `docs/architecture/ARCHITECTURE.md` |
| Cache / Sessions | Inspect active sessions and cache statistics; clear cache state when needed. | `/api/sessions`, `/api/cache`, `/api/cache/stats` | Management session. | `docs/reference/openapi.yaml` tag `System`; `docs/architecture/ARCHITECTURE.md` |
| Translator | Detect request format, translate between provider/API formats, send translated requests, and inspect translation history. | `/api/translator/detect`, `/api/translator/translate`, `/api/translator/send`, `/api/translator/history` | Management session. | `docs/reference/openapi.yaml` tag `Translator`; `docs/architecture/ARCHITECTURE.md` |
| Playground | Store playground presets and improve prompts through the playground helper surface. | `/api/playground/improve-prompt`, `/api/playground/presets`, `/api/playground/presets/{id}` | BearerAuth per spec and contract. Actual model calls still use inference routes; see [references/inference.md](inference.md). | `docs/reference/openapi.yaml` tag `Playground` |

## Combo and routing details

Concrete routing strategy values documented in `docs/routing/AUTO-COMBO.md` are 14, not 15. If a UI badge or summary says 15, do not invent a missing strategy; enumerate the concrete set:

`priority`, `weighted`, `round-robin`, `context-relay`, `fill-first`, `p2c`, `random`, `least-used`, `cost-optimized`, `reset-aware`, `strict-random`, `auto`, `lkgp`, `context-optimized`.

Auto-Combo virtual ids are consumed as model ids on the inference path, not via a special `POST /api/combos/auto` endpoint. Primary ids: `auto`, `auto/coding`, `auto/fast`, `auto/cheap`, `auto/offline`, `auto/smart`; the Auto-Combo doc also names `auto/lkgp` as an explicit LKGP alias.

Default Auto-Combo scoring is a 9-factor weighted sum:

| Factor | Weight | Meaning |
|---|---:|---|
| `health` | 0.22 | Circuit-breaker health (`CLOSED` high, `OPEN` zero). |
| `quota` | 0.17 | Remaining quota / rate-limit headroom. |
| `costInv` | 0.17 | Inverse blended token cost; cheaper scores higher. |
| `latencyInv` | 0.13 | Inverse p95 latency; faster scores higher. |
| `taskFit` | 0.08 | Fit for coding, review, planning, analysis, debugging, docs, etc. |
| `specificityMatch` | 0.08 | Match between request specificity and model tier. |
| `stability` | 0.05 | Low variance and low error rate. |
| `tierPriority` | 0.05 | Account-tier priority. |
| `tierAffinity` | 0.05 | Candidate tier vs manifest-recommended tier. |

## Resilience details

Keep these layers separate when triaging routing behavior:

| Layer | Scope | Purpose | Representative endpoints |
|---|---|---|---|
| Provider circuit breaker | Whole provider | Stop hammering an upstream/provider that is failing repeatedly. | `GET /api/monitoring/health`, `POST /api/resilience/reset` |
| Connection cooldown | One provider connection/account/key | Skip one rate-limited or transiently bad key while other keys for the same provider keep serving. | `GET/PATCH /api/resilience` |
| Model lockout | Provider + connection + model | Quarantine one unavailable/quota-limited model without disabling the whole connection. | Docs describe `/api/resilience/model-cooldowns` |

## Source rules for agents

- Do not restate chat, embeddings, image, audio, rerank, files, batches, search, or WebSocket calling details here; load [references/inference.md](inference.md).
- Do not duplicate auth headers, key-in-URL variants, or error tables here; load [references/api-access.md](api-access.md).
- If an endpoint in `docs/reference/openapi.yaml` says `none` but a live `requireLogin` instance returns `AUTH_001`, report it as management-gated and route the user to the dashboard/session flow.
- Never include real API keys, session cookies, provider tokens, or captured request bodies. Use placeholders only: `<OMNIROUTE_API_KEY>`, `$OMNIROUTE_API_KEY`, `<session-cookie>`.
