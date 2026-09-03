# OMP Configuration and Models

Use this reference to inspect, edit, or troubleshoot Oh My Pi (`omp`) settings, custom model providers, credentials, model roles, and benchmarking. Keep secrets out of transcripts: use env var names, paths, or `<redacted>` only.

## 1. Config Paths and Precedence

| Scope / Layer | Path or Source | Behavior & Notes |
|---|---|---|
| **Active Agent Directory** | Run `omp config path` | Canonical root. Defaults to `~/.omp/agent`. Relocated by `PI_CODING_AGENT_DIR` in process env, or `~/.omp/profiles/<name>/agent/` when using `--profile <name>`. |
| **Global Settings** | `~/.omp/agent/config.yml` | Writable settings file. `omp config set/reset` and `/settings` write here. |
| **Project Settings** | `<cwd>/.omp/config.yml` | Project-scoped overrides. Loaded only when `<cwd>/.omp/` exists and is non-empty. Edit directly for project scope. |
| **Config Overlays** | `--config <path>` | Process-local overlay file; repeatable; beats project and global settings. |
| **CLI Runtime Flags** | e.g. `--approval-mode`, `--api-key` | In-memory flags for this invocation only; highest precedence. |

**Effective Precedence (Lowest to Highest):**
$$\text{Built-in Defaults} \to \text{Global Config} \to \text{Project Config} \to \text{--config Overlays} \to \text{CLI Runtime Overrides}$$

*Note on settings arrays:* Arrays replace wholesale at higher-precedence layers; they do not merge.

## 2. Credential Resolution Order

OMP resolves model credentials through a strict 7-tier cascade (first match wins):

1. **CLI Runtime Override**: `--api-key <key>` passed at invocation.
2. **`models.yml` Provider `apiKey`**: Config-sourced key or command. Deliberately beats stored credentials so gateway keys are honored.
3. **Stored OAuth Credential**: Token in SQLite store with auto-refresh/rotation.
4. **Stored `/login` API Key**: API key persisted into the store by a successful `/login <provider>` command.
5. **Provider Environment Variable**: Including values loaded from the `.env` cascade.
6. **Other Stored Static API Key**: Key stored in `~/.omp/agent/agent.db`.
7. **`models.yml` Fallback Resolver**: Fallback mechanism defined for the model catalog.

### `.env` File Precedence
Before credential lookup, OMP loads environment variables in this order (first defined wins):
1. Process environment (shell exports; canonical `PI_*` preferred).
2. `<cwd>/.env`
3. `~/.omp/agent/.env`
4. `~/.omp/.env`
5. `~/.env`

*Note on `OMP_*` vs `PI_*`:* The `OMP_` to `PI_` variable mirror applies only while parsing `.env` files, not in shell process env. Prefer `PI_*` for shell exports.

## 3. `models.yml` Custom Providers

Custom providers live in `~/.omp/agent/models.yml` under `providers`:

```yaml
providers:
  novita:
    baseUrl: https://api.novita.ai/openai
    api: openai-completions
    apiKey: NOVITA_API_KEY
    authHeader: true
    models:
      - id: minimax/minimax-m3
        name: MiniMax-M3 (Novita)
        contextWindow: 1000000
        maxTokens: 131072
```

### Key Provider Fields

| Field | Meaning & Constraints |
|---|---|
| `baseUrl` | Endpoint root URL. Required for custom providers with non-empty `models`. |
| `api` | API adapter. Allowed values: `openai-completions`, `openai-responses`, `openai-codex-responses`, `azure-openai-responses`, `anthropic-messages`, `google-generative-ai`, `google-gemini-cli`, `google-vertex`. Use `openai-completions` for OpenAI-compatible chat endpoints. |
| `apiKey` | Environment variable name, literal secret, or `!command <secret-command>`. Prefer env var names or trusted command references. |
| `auth` | `apiKey` (default), `none`, or `oauth`. Modern OMP permits `auth: oauth` without requiring a dummy `apiKey`. |
| `authHeader` | When `true`, OMP sends `Authorization: Bearer <resolved-key>`. Common for OpenAI-compatible proxies. |
| `headers` | Record of custom request headers. Secret values may use `!command`. |
| `disableStrictTools` | Set `true` for Anthropic-fronted gateways that reject the `strict` tool field. |
| `models` | List of model definitions. Each item requires `id` and positive `contextWindow`/`maxTokens`. |

*Model Selectors:* Model selectors are `<provider-id>/<model-id>`. For nested IDs like `minimax/minimax-m3` on `novita`, the exact selector is `novita/minimax/minimax-m3`.

## 4. Built-in Model Roles

OMP uses role aliases to decouple workflows from concrete models. The built-in roles are:

| Role | Purpose | Default Behavior / Fallback |
|---|---|---|
| `default` | Primary general-purpose model for conversational turns and tasks. | Set via `modelRoles.default`. |
| `smol` | Fast, lightweight model for cheap background tasks, summarization, or prewalk targets. | Set via `modelRoles.smol`. |
| `slow` | Heavy reasoning model for thorough analysis and hard debugging. | Set via `modelRoles.slow`. |
| `vision` | Image inspection and visual delegation tool (`inspect_image`). | Auto-selected based on model vision capabilities. |
| `plan` | Architectural planning and read-only plan mode. | Falls back to `default` or `slow`. |
| `commit` | Generating git commit messages and atomic PR diff analysis. | Set via `modelRoles.commit`. |
| `tiny` | Titles, memory indexing, stop checks, and auto-thinking classification. | Falls back to `smol`. |
| `task` | Default model for spawned `task` subagents. | Inherits parent session model if unset. |
| `advisor` | Shadow watchdog reviewing turns in the background. | Set via `advisor.model`. |

*(Note: The legacy `designer` role was removed in v18.1.5).*

Configure roles in `config.yml`:
```yaml
modelRoles:
  default: anthropic/claude-opus-5
  smol: openai/gpt-5.6-luna
  slow: anthropic/claude-fable-5-1
  tiny: deepseek/deepseek-v4-flash
```

## 5. Model Discovery and Benchmarking

```bash
# List configured and known concrete models
omp models ls

# Show models for a single provider
omp models novita

# Search model IDs or names by regex/pattern
omp models find sonnet

# Rebuild the local model cache database (~/.omp/models.db)
omp models refresh

# Show coalesced canonical model names
omp models canonical --json

# Benchmark generation throughput (tokens/s) and time-to-first-token (TTFT)
omp bench opus sonnet --runs 5
omp bench openai/gpt-5.6 --cache --json
```

*Note:* `omp bench` is a separate top-level utility command, not a subcommand under `omp models`.

## 6. Auth Vault & Gateway Infrastructure

OMP includes centralized credential management tools for teams, servers, and multi-machine setups:

- **`omp auth-broker`**: A centralized credential vault running against a local or remote SQLite store.
  - `omp auth-broker serve`: Launch the broker daemon.
  - `omp auth-broker token --regenerate`: Print or rotate the broker bearer token.
  - `omp auth-broker login <provider>`: Authenticate with an OAuth provider locally or over an SSH tunnel (`--via=user@host`).
- **`omp auth-gateway`**: A loopback forward proxy backed by the broker.
  - `omp auth-gateway serve`: Run the proxy server.
  - `omp auth-gateway check --strict`: Verify each credential against its provider's endpoint.

## 7. Essential Settings Commands

```bash
# Show active agent root
omp config path

# List all effective settings with current values
omp config list

# Get a specific setting value
omp config get task.maxConcurrency

# Set a global setting (arrays/records passed as quoted JSON string)
omp config set prewalk.enabled true
omp config set task.agentPrewalk '{"AuthScout": "on"}'

# Reset a setting to its schema default
omp config reset prewalk.enabled
```
