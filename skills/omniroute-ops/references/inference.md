# Inference API

Load this when an agent has a Bearer key and needs to call OmniRoute's model/proxy surface: chat, responses, embeddings, images, audio, rerank, files, batches, search, or WebSocket streaming.
For auth, base-URL normalization, request/response headers, and the canonical error table, read [api-access.md](api-access.md) first; this file only names the Bearer-reachable inference routes.

Related skill files: [`SKILL.md`](../SKILL.md), [`references/api-access.md`](api-access.md), [`references/capabilities.md`](capabilities.md), [`references/operations.md`](operations.md), [`scripts/omniroute_inspect.py`](../scripts/omniroute_inspect.py).

Grounding: endpoint existence comes from `docs/reference/openapi.yaml` via the endpoint map; Files, Batches, Search, image edits, video/music generation, and WebSocket shapes come from `docs/reference/API_REFERENCE.md`; live catalog and smoke-test facts come from the shared contract.

## Compatibility matrix

Canonical paths below use `/v1` unless the source route is explicitly outside it. Live verification confirms both `/v1/*` and `/api/v1/*` prefixes work for the proxy surface; prefer `/v1/*` in client examples.

| Method | Path | Format | Notes |
|---|---|---|---|
| `POST` | `/v1/chat/completions` | OpenAI Chat Completions | Standard `messages` body; streams when `stream: true`. |
| `POST` | `/v1/responses` | OpenAI Responses | HTTP Responses API route. |
| `POST` | `/v1/embeddings` | OpenAI Embeddings | Text embedding generation. |
| `POST` | `/v1/images/generations` | OpenAI Images | Image generation. |
| `POST` | `/v1/images/edits` | OpenAI Images edit/inpaint | Multipart image edit route. |
| `POST` | `/v1/audio/speech` | OpenAI TTS | Returns an audio body. |
| `POST` | `/v1/audio/transcriptions` | OpenAI Audio STT | Transcription route. |
| `POST` | `/v1/moderations` | OpenAI Moderations | Content moderation. |
| `POST` | `/v1/rerank` | Cohere/Voyage-style rerank | Body includes model, query, and documents. |
| `POST` | `/v1/videos/generations` | OpenAI-style video generation | Provider-prefixed model id. |
| `POST` | `/v1/music/generations` | OpenAI-style music generation | Provider-prefixed model id. |
| `POST` | `/v1/messages` | Anthropic Messages | Anthropic-compatible message creation. |
| `POST` | `/v1/messages/count_tokens` | Anthropic token count | Counts tokens for an Anthropic-style message. |
| `GET` | `/v1beta/models` | Gemini models | Gemini-compatible model listing. |
| `POST` | `/v1beta/models/{...path}` | Gemini `generateContent` | Pass the Gemini model/action path after `/models/`. |
| `POST` | `/v1/api/chat` | Ollama chat | Ollama-compatible chat endpoint. |
| `GET` | `/api/tags` | Ollama tags | Tags for Ollama clients; OpenAPI maps tags outside `/v1`, and tokenized clients can use `/api/v1/vscode/{token}/api/tags`. Do not assume `/v1/api/tags` unless the live instance documents it. |

## Model IDs and provider routes

- Normal HTTP model IDs are provider-namespaced: `prefix/model`. Examples from the live catalog include `cx/codex-auto-review`, `cc/...`, `claude/...`, and `voyage/...`.
- The catalog is dynamic. `GET /v1/models` returned 256 entries at probe time; do not bake that list into agents. Fetch the live catalog before choosing a model.
- Live-seen prefixes: `nvidia/`, `opencode-go/`, `codex/`, `cx/`, `voyage/`, `voyage-ai/`, `oc/`, `tllm/`, `cc/`, `claude/`, `xiaomi-mimo/`, `mimo/`, `ddgw/`, `zai/`, `veo-free/`, `pepper/`.
- Virtual combo IDs are valid model IDs for routing: `auto`, `auto/coding`, `auto/fast`, `auto/cheap`, `auto/offline`, `auto/smart`.

Dedicated provider routes exist for these operations only:

| Method | Path | Behavior |
|---|---|---|
| `POST` | `/v1/providers/{provider}/chat/completions` | Chat completion through one provider. |
| `POST` | `/v1/providers/{provider}/embeddings` | Embedding through one provider. |
| `POST` | `/v1/providers/{provider}/images/generations` | Image generation through one provider. |
| `GET` | `/v1/providers/{provider}/models` | List models for one provider. |

On provider routes, OmniRoute auto-adds the `{provider}/` prefix when the request model omits it. A model with a different provider prefix returns `400`.

## Catalog/read endpoints

Use these before making assumptions about available models or providers:

| Method | Path | Returns |
|---|---|---|
| `GET` | `/v1/models` | OpenAI-style list of chat, embedding, image models, and combos. |
| `GET` | `/v1/embeddings` | OpenAI-style list of embedding models. |
| `GET` | `/v1/images/generations` | OpenAI-style list of image models. |
| `GET` | `/v1/search` | OpenAI-style list of configured search providers and capabilities. |

## Files API

OpenAI-compatible files are Bearer-authenticated and scoped to the API key.

| Method | Path | Shape |
|---|---|---|
| `POST` | `/v1/files` | Multipart upload: `file`, `purpose`, optional `expires_after[anchor]`, `expires_after[seconds]`; API reference states 512 MiB max. |
| `GET` | `/v1/files` | List files for the authenticated key. |
| `GET` | `/v1/files/{id}` | Retrieve file metadata. |
| `DELETE` | `/v1/files/{id}` | Delete a file. |
| `GET` | `/v1/files/{id}/content` | Stream raw file content. |

## Batches API

OpenAI-compatible batches are Bearer-authenticated and scoped to the API key.

| Method | Path | Shape |
|---|---|---|
| `POST` | `/v1/batches` | Create a batch; body uses `input_file_id`, `endpoint`, and `completion_window`. |
| `GET` | `/v1/batches` | List batches. |
| `GET` | `/v1/batches/{id}` | Retrieve batch status and `request_counts`. |
| `POST` | `/v1/batches/{id}/cancel` | Cancel an in-progress batch. |
| `DELETE` | `/v1/batches/{id}` | Delete a finished or failed batch. |

## Search API

Search is a Bearer-authenticated abstraction over configured search providers such as Tavily, Brave, Exa, and Serper. Policy is enforced for the calling API key.

| Method | Path | Shape |
|---|---|---|
| `GET` | `/v1/search` | List configured search providers and capabilities. |
| `POST` | `/v1/search` | Run a search query; request body is validated by OmniRoute's `v1SearchSchema` and supports caching/coalescing. |
| `GET` | `/v1/search/analytics` | Per-provider hit, latency, and cache stats. |

## WebSocket streaming

### Generic WebSocket handshake

```http
GET /v1/ws?handshake=1
Authorization: Bearer <OMNIROUTE_API_KEY>
```

This validates a WebSocket upgrade handshake and returns example wire-protocol messages (`request`, `cancel`). Actual WebSocket frames are handled by the bundled WebSocket server outside the Next.js route table.

### Responses over WebSocket for Codex only

Connect to the same host and port as HTTP, default `20128`:

```bash
wscat -c "ws://<host>:20128/v1/responses?api_key=<OMNIROUTE_API_KEY>"
# or pass: Authorization: Bearer <OMNIROUTE_API_KEY>
```

First frame must be `response.create`:

```json
{ "type": "response.create", "model": "gpt-5.5", "input": [{ "role": "user", "content": "hi" }] }
```

Rules:

- This bridge is wired exclusively to `codex`; non-codex models are rejected with `codex_ws_provider_required`.
- Use the bare ChatGPT/Codex model id, for example `gpt-5.5`, not `codex/gpt-5.5`. The Codex CLI validates WebSocket model names client-side and rejects provider-prefixed IDs.
- Accepted bridge paths are `/v1/responses`, `/responses`, and `/api/v1/responses`.
- For quota-share routing, the API reference documents `model: "qtSd/<group>/codex/<model>"`.

## Smoke test

Use a deterministic, non-streaming check so the agent can compare one content string and one routing header. Do not paste real keys into commands.

```bash
BASE="${OMNIROUTE_BASE_URL:-http://omniroute.lo}"
BASE="${BASE%/v1}"

curl -sS -D /tmp/omniroute.headers \
  -H "Authorization: Bearer $OMNIROUTE_API_KEY" \
  -H "Content-Type: application/json" \
  -X POST "$BASE/v1/chat/completions" \
  --data '{"model":"cx/codex-auto-review","messages":[{"role":"user","content":"Calculate 95222+25820, and reply with the result only."}],"max_tokens":32,"stream":false}'
```

Verified result on a live instance:

- HTTP `200`.
- Assistant content: `121042`.
- Response header: `X-Omniroute-Provider: cx`.

Prefer `stream: false` for smoke tests; streaming is useful for client behavior but harder to compare deterministically. For failures, use the error/failure classes in [api-access.md](api-access.md) instead of guessing whether the issue is auth, routing, quota, or upstream provider health.
