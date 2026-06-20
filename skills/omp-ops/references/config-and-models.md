# OMP Configuration and Models

Use this reference to inspect, change, or troubleshoot Oh My Pi (`omp`) settings, providers, credentials, and model catalogs. Keep secrets out of transcripts: names, paths, and `<redacted>` only.

## 1. Config paths and precedence
| Area | Path or source | Notes |
|---|---|---|
| Active agent directory | `omp config path` | Source of truth. Default is `~/.omp/agent`; process env `PI_CODING_AGENT_DIR` relocates the base, while profiles use `~/.omp/profiles/<name>/agent/`. |
| Global settings | `~/.omp/agent/config.yml` | Writable settings file. `/settings`, `omp config set`, and `omp config reset` write here, not project config. |
| Project settings | `<cwd>/.omp/config.yml` | Loaded only when `<cwd>/.omp/` exists and is non-empty. Edit directly for project scope. |
| Config overlays | `--config <path>` | Repeatable, process-only overlays loaded after defaults/global/project. |
| Model/provider config | `~/.omp/agent/models.yml` | Custom providers and models. Keep credential values as env-var names or command references. |
| Environment files for API keys | `<cwd>/.env`, `~/.omp/agent/.env`, `~/.omp/.env`, `~/.env` | Used only when the process environment lacks the key. |

Settings precedence, low to high: built-in defaults; global config; project config; `--config` overlays; runtime overrides such as in-memory CLI flags (`--approval-mode`, etc.).

Settings arrays replace wholesale at higher-precedence layers; they do not merge. Use canonical `PI_*` names in shell/process env. `OMP_*` mirrors only while parsing `.env` files, not in process env; avoid conflicting pairs and confirm paths with `omp config path`.

## 2. `omp config` commands
| Command | Use |
|---|---|
| `omp config` / `omp config list` | List effective configurable settings; `list` is the default action. |
| `omp config path` | Show the active global agent directory before editing files. |
| `omp config get <key>` | Print one schema-defined setting. Redact only if the displayed value contains secret material. |
| `omp config set <key> <value>` | Write a global setting to `~/.omp/agent/config.yml`. |
| `omp config reset <key>` | Write the schema default for a global setting to `~/.omp/agent/config.yml`. |
| `omp config init-xdg` | Initialize XDG-style config support when needed. |
| `omp config --json ...` | Emit machine-readable output for commands that support it. |

`set` joins multiple value args with spaces. Pass arrays and records as one shell-quoted JSON string, e.g. `omp config set <array-key> '["value-one","value-two"]'`. `omp config set` does not write project config; for project scope, edit `<cwd>/.omp/config.yml` and run OMP from that directory or pass `--cwd <project>`.

## 3. `models.yml` essentials
Custom providers live in `~/.omp/agent/models.yml` under `providers`:

```yaml
providers:
  <provider-id>:
    baseUrl: https://<provider-host>/<api-root>
    api: openai-completions
    apiKey: PROVIDER_API_KEY
    authHeader: true
    models:
      - id: <provider-model-id>
        name: <display-name>
        contextWindow: 128000
        maxTokens: 8192
```

| Field | Meaning |
|---|---|
| `providers.<id>.baseUrl` | Provider endpoint root. Required for custom providers with non-empty `models`. |
| `providers.<id>.api` | API adapter. Allowed values: `openai-completions`, `openai-responses`, `openai-codex-responses`, `azure-openai-responses`, `anthropic-messages`, `google-generative-ai`, `google-gemini-cli`, `google-vertex`. Use `openai-completions` for common OpenAI-compatible chat APIs. |
| `providers.<id>.apiKey` | Environment variable name, literal key, or `!command <secret-command>`. Prefer an environment variable name or trusted command. |
| `providers.<id>.auth` | `apiKey` (default), `none`, or `oauth`. For `models.yml` custom models, `oauth` does not waive the `apiKey` requirement. |
| `providers.<id>.authHeader` | When `true`, OMP sends `Authorization: Bearer <resolved-key>`. |
| `providers.<id>.headers` | Extra headers. Secret values may use `!command <secret-command>`; never inline real tokens. |
| `providers.<id>.disableStrictTools` | Set `true` for Anthropic-fronted proxies/gateways that reject the `strict` tool field. |
| `providers.<id>.discovery.type` | `ollama`, `llama.cpp`, `lm-studio`, `openai-models-list`, or `proxy`. Discovery needs provider-level `api` except for `proxy`. |
| `providers.<id>.models` | Model definitions. Each model needs `id`; it can inherit provider-level `api` or set its own. |

Validation:
- A custom provider with a non-empty `models` list needs `baseUrl`, `apiKey` unless `auth: none`, and provider- or model-level `api`.
- `contextWindow` and `maxTokens` must be positive when set.
- An override-only provider with no models must define at least one of `baseUrl`, `apiKey`, `auth: none`, `headers`, `compat`, `disableStrictTools`, `modelOverrides`, or `discovery`.
- Selectors are `<provider-id>/<model-id>`; model IDs may contain `/`. Use exact selectors in automation.

## 4. Credential resolution and safe secret handling
`apiKey` may be an env-var name, literal secret, or quoted `!command`; header values may also start with `!`.

`.env`/environment-file loading order before provider lookup (first source wins):
1. process environment;
2. `<cwd>/.env`;
3. `~/.omp/agent/.env`;
4. `~/.omp/.env`;
5. `~/.env`.

Full credential precedence, first match wins:
1. `--api-key` runtime override;
2. `models.yml` provider `apiKey` (config-sourced; deliberately beats stored OAuth, so a gateway key is honored);
3. stored API key in `~/.omp/agent/agent.db`;
4. stored OAuth credential, with auto-refresh/rotation;
5. provider environment variable, including loaded `.env` values;
6. `models.yml` fallback resolver.

Keyless providers use `auth: none` or implicit local engines. If an `apiKey` or header value starts with `!`, OMP runs the command with a 10s timeout, trims stdout, caches outputs per process, and uses stdout as the secret.

Safe handling:
- Prefer env-var names or `!command` references in `models.yml`; put real values in private env sources.
- Never print, log, or commit real keys, Bearer tokens, cookies, stored auth, or full `.env` contents.
- Report only safe evidence: `NOVITA_API_KEY set in process env`, `key source: ~/.omp/agent/.env`, `stored auth present`, or `<redacted>`.

## 5. OpenAI-compatible provider recipe
1. Confirm the active agent directory: `omp config path`.
2. Put the real API key in process env or a private `.env` file as `NOVITA_API_KEY=<provider-api-key>`.
3. Merge a provider block into `~/.omp/agent/models.yml` under `providers`; do not replace unrelated providers.
4. List or find the model with `omp models` commands.
5. Run OMP with `--model <provider-id>/<model-id>`.

Novita-like OpenAI-compatible example:

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

The selector is `novita/minimax/minimax-m3`:
```bash
omp -p --model novita/minimax/minimax-m3 '<task prompt>'
```

## 6. Model discovery and verification commands
| Command | Use |
|---|---|
| `omp models` / `omp models ls` | List configured and known concrete models; `ls` is the default action. |
| `omp models <provider>` | Show models for one provider, such as `omp models novita`. |
| `omp models find <pattern>` | Search model IDs or names, such as `omp models find minimax`. |
| `omp models refresh` | Rebuild the model cache DB at `~/.omp/models.db` after provider or catalog changes. |
| `omp models canonical` | Show coalesced canonical model names. |

| Flag | Use |
|---|---|
| `--json` | Emit machine-readable output; combines with any action. |
| `-e`, `--extension <name>` | Include a model extension; repeatable. |
| `--no-extensions` | Disable model extensions for this command. |
| `--config <path>` | Apply a repeatable config overlay for this command. |

## Troubleshooting
- Model not listed: confirm the active directory with `omp config path`; edit that directory's `models.yml`, and check provider/model indentation under `providers`.
- Model validation fails: for non-empty `models`, require model `id`, provider or model `api`, `baseUrl`, and `apiKey` unless `auth: none`; use the exact selector `<provider-id>/<model-id>`.
- Model lookup is ambiguous or stale: run `omp models <provider>`, `omp models find <pattern>`, then `omp models refresh` and repeat.
- Auth fails: ensure `apiKey` names the intended env var; process env overrides `.env`; verify the key source without printing it.
- Bearer auth fails: set `authHeader: true` for OpenAI-compatible Bearer providers.
- Keyless/OAuth confusion: use `auth: none` only for intentionally keyless providers; `auth: oauth` in `models.yml` still needs `apiKey`.
- Provider is ignored: check `disabledProviders` in global/project config or `--config`; it is applied before credentials.
- Project or overlay surprises: arrays replace wholesale across layers, project `.omp/` must be non-empty to load, and `--config` overlays affect only that process.
