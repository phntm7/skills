# OMP Configuration and Models

Use this reference when an agent needs to inspect, change, or troubleshoot Oh My Pi (`omp`) settings, providers, credentials, or model catalogs. Keep secrets out of transcripts: show variable names, paths, and redacted sources only.

## 1. Config paths and precedence

| Area | Path or source | Notes |
|---|---|---|
| Active agent directory | `omp config path` | Prints the active global agent directory. Default is `~/.omp/agent`; process env `PI_CODING_AGENT_DIR` relocates this base, while profiles use `~/.omp/profiles/<name>/agent/`. Confirm the active path with `omp config path`. |
| Global settings | `~/.omp/agent/config.yml` | Main writable settings file. `/settings`, `omp config set`, and `omp config reset` write here, not to project config. |
| Project settings | `<cwd>/.omp/config.yml` | Loaded only for the current working directory when `<cwd>/.omp/` exists and is non-empty. Edit this file directly when project-local settings are required. |
| Config overlays | `--config <path>` | Loaded after defaults, global, and project settings. Use for temporary runs. |
| Model/provider config | `~/.omp/agent/models.yml` | Stores custom provider and model definitions. Keep credential values as environment variable names. |
| Environment files for API keys | `<cwd>/.env`, `~/.omp/agent/.env`, `~/.omp/.env`, `~/.env` | Used only when the process environment does not already define the key. |

Settings precedence, lowest to highest:

1. built-in defaults;
2. global config;
3. project config;
4. `--config` overlays;
5. runtime overrides, such as in-memory CLI flags (`--approval-mode`, etc.).

For environment-driven settings, use canonical `PI_*` names in shell/process env. `OMP_*` mirrors only while parsing `.env` files: `OMP_X` is copied to `PI_X` and overrides `PI_X` in that same file. Process-env `OMP_*` names are not mirrored. Avoid conflicting pairs and confirm paths with `omp config path`.

Project config is not a target for `omp config set`; if you need project-scoped behavior, create or edit `<cwd>/.omp/config.yml` and run OMP from that directory or pass `--cwd <project>`.

## 2. `omp config` commands

| Command | Use |
|---|---|
| `omp config` / `omp config list` | List effective configurable settings; `list` is the default action. |
| `omp config path` | Show the active global agent directory. Use this before editing files if `PI_CODING_AGENT_DIR` or profiles might relocate settings. |
| `omp config get <key>` | Print one schema-defined setting. Redact only if the displayed value itself contains secret material from user config. |
| `omp config set <key> <value>` | Write a global setting to `~/.omp/agent/config.yml`. |
| `omp config reset <key>` | Write the schema default for a global setting to `~/.omp/agent/config.yml`. |
| `omp config init-xdg` | Initialize XDG-style config support when needed. |
| `omp config --json ...` | Emit machine-readable output for commands that support it. |

Value parsing rule: `set` joins multiple value args with spaces. Scalar values can be passed as strings, but arrays and records must be one JSON string. Quote that JSON for the shell.

```bash
omp config set <boolean-key> true
omp config set <array-key> '["value-one","value-two"]'
omp config set <record-key> '{"name":"example","enabled":true}'
```

Secret risk is concentrated in `.env` files, `models.yml` literal values, stored auth tokens, cookies, and logs. Do not print those values; schema-defined settings from `omp config get` are not secret-bearing by default.

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

Essential fields:

| Field | Meaning |
|---|---|
| `providers.<id>.baseUrl` | Provider endpoint root. Required for custom providers with non-empty `models`. |
| `providers.<id>.api` | API adapter. Allowed values: `openai-completions`, `openai-responses`, `openai-codex-responses`, `azure-openai-responses`, `anthropic-messages`, `google-generative-ai`, `google-gemini-cli`, `google-vertex`. Use `openai-completions` for common OpenAI-compatible chat APIs. |
| `providers.<id>.apiKey` | Environment variable name, literal key, or `!command <secret-command>`. Prefer an environment variable name or trusted command, not a literal key. |
| `providers.<id>.auth` | `apiKey` (default), `none`, or `oauth`. For `models.yml` custom models, `oauth` is accepted but does not waive the `apiKey` requirement. |
| `providers.<id>.authHeader` | When `true`, OMP sends `Authorization: Bearer <resolved-key>`. |
| `providers.<id>.headers` | Extra headers. Secret header values may use `!command <secret-command>`; never inline real tokens. |
| `providers.<id>.disableStrictTools` | Set `true` for Anthropic-fronted proxies/gateways that reject the `strict` tool field. |
| `providers.<id>.discovery.type` | `ollama`, `llama.cpp`, `lm-studio`, `openai-models-list`, or `proxy`. Discovery needs provider-level `api` except for `proxy`. |
| `providers.<id>.models` | List of model definitions exposed by the provider. Each model must include `id`; it can inherit provider-level `api` or set its own. |

Validation rules:

- A custom provider with a non-empty `models` list needs `baseUrl`, `apiKey` unless `auth: none`, and `api` at provider level or on each model.
- Each model needs `id`; `contextWindow` and `maxTokens` must be positive when set.
- An override-only provider with no models must define at least one of `baseUrl`, `apiKey`, `auth: none`, `headers`, `compat`, `disableStrictTools`, `modelOverrides`, or `discovery`.
- Keep provider IDs short, lowercase, and stable; changing them changes model names users select.

## 4. Credential resolution and safe secret handling

`apiKey` may be an environment variable name, a literal secret, or a quoted shell command value that starts with `!`. Use an environment variable name or trusted command:

```yaml
apiKey: NOVITA_API_KEY
# or
apiKey: "!op read op://team/novita/api-key"
headers:
  X-Provider-Token: "!op read op://team/provider/token"
```

`.env`/environment-file loading order before provider lookup (first source wins):

1. process environment;
2. `<cwd>/.env`;
3. `~/.omp/agent/.env`;
4. `~/.omp/.env`;
5. `~/.env`.

The process environment wins and is never overwritten by `.env` files. This list is only the env-file order, not full credential precedence.

Full credential precedence, first match wins:

1. `--api-key` runtime override;
2. `models.yml` provider `apiKey` (config key — deliberately beats stored OAuth, so a gateway key is honored);
3. stored API key in `~/.omp/agent/agent.db`;
4. stored OAuth credential, with auto-refresh/rotation;
5. provider environment variable, including loaded `.env` values;
6. `models.yml` fallback resolver.

Keyless providers use `auth: none` or implicit local engines. If an `apiKey` or header value starts with `!`, OMP runs the command with a 10s timeout, trims stdout, caches outputs per process, and uses stdout as the secret value. Treat the command, stdout, stderr, and logs as secret-adjacent.

Safe handling rules:

- Prefer environment variable names or `!command` references in `models.yml`; use `.env` files, the process environment, or a trusted command for the actual values.
- Use OMP stored auth only as an opaque credential source. Do not extract, print, copy, or convert stored credentials into config examples.
- Use placeholder names such as `PROVIDER_API_KEY`, `NOVITA_API_KEY`, or `OPENAI_API_KEY` in examples.
- Never paste, print, log, or commit real API keys, Bearer tokens, session cookies, or provider secrets.
- When reporting what was checked, say `NOVITA_API_KEY is set in process env`, `key source: ~/.omp/agent/.env`, or `stored auth present`; never reveal the value.
- If you must show a value shape, use `<redacted>` or `<provider-api-key>`.

Example private `.env` entry:

```dotenv
NOVITA_API_KEY=<provider-api-key>
```

## 5. OpenAI-compatible provider recipe

Use this flow to add a provider/model without exposing secrets:

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

Example run command:

```bash
omp -p --model novita/minimax/minimax-m3 "Reply with 'ok' only."
```

If the provider wants a different model namespace, keep the model ID exactly as the provider documents it. The selector is `<provider-id>/<model-id>`, so the example model `minimax/minimax-m3` is selected as `novita/minimax/minimax-m3`.

OMP model selection supports fuzzy matching for interactive use, but unattended automation should pass the exact selector to avoid ambiguity.

## 6. Model discovery and verification commands

| Command | Use |
|---|---|
| `omp models` / `omp models ls` | List configured and known concrete models; `ls` is the default action. |
| `omp models <provider>` | Show models for one provider, such as `omp models novita`. |
| `omp models find <pattern>` | Search model IDs or names, such as `omp models find minimax`. |
| `omp models refresh` | Rebuild the model cache DB at `~/.omp/models.db` after provider or catalog changes. |
| `omp models canonical` | Show coalesced canonical model names. |

Flags:

| Flag | Use |
|---|---|
| `--json` | Emit machine-readable output; combines with any action. |
| `-e`, `--extension <name>` | Include a model extension; repeatable. |
| `--no-extensions` | Disable model extensions for this command. |
| `--config <path>` | Apply a repeatable config overlay for this command. |

Useful checks after editing `models.yml`:

```bash
omp models novita
omp models find minimax
omp models canonical --json
omp models refresh
omp models --json
```
For a functional smoke check, use a non-interactive prompt with the exact model selector:

```bash
omp -p --model novita/minimax/minimax-m3 "Reply with 'ok' only."
```

Use `--no-tools` when the prompt should test only model access:

```bash
omp -p --no-tools --model novita/minimax/minimax-m3 "Reply with 'ok' only."
```

## 7. Troubleshooting checklist

### Model is unavailable or not listed

- Confirm the active directory with `omp config path`; edit that directory's `models.yml`.
- Check provider and model indentation under `providers`.
- Ensure a non-empty `models` list has model `id` values plus provider-level or model-level `api`, and the provider has `baseUrl` and `apiKey` unless `auth: none` is correct.
- Use the exact selector `<provider-id>/<model-id>` in automation; fuzzy matching is for human convenience.
- Run `omp models <provider>` and `omp models find <pattern>`.
- Run `omp models refresh` if the cache may be stale.

### Wrong key or auth failure

- Confirm the `apiKey` field names the intended env var, such as `NOVITA_API_KEY`.
- Check whether the process environment overrides `.env` files.
- Verify the key exists in one allowed source without printing it.
- Confirm `authHeader: true` for OpenAI-compatible Bearer-token providers.
- If the provider intentionally has no key, use `auth: none`; for `models.yml` custom models, `auth: oauth` does not waive the `apiKey` requirement.

### Provider appears disabled or ignored

- Confirm `models.yml` is in the active agent directory, not a different `~/.omp` tree.
- Check for `disabledProviders` in global config, project config, or a `--config` overlay. It is applied before credentials are checked.
- Settings arrays are replaced wholesale by the higher-precedence layer: project `disabledProviders` replaces the global array instead of merging with it. Repeat global IDs in the project file if the project should add to the global disables.
- Check for higher-precedence runtime flags or `--config` overlays changing model selection.
- Confirm project config loads only when `<cwd>/.omp/` exists and is non-empty.
- Try selecting the exact model with `--model <provider-id>/<model-id>`.

### Stale cache or old catalog

- Run `omp models refresh`.
- Re-run `omp models <provider>` and `omp models find <pattern>`.
- If a provider changed its public model ID, update the `models` key and use `omp models canonical` to confirm the selector.

## 8. Agent output contract

When reporting a config/model change, include only safe evidence:

```markdown
- Config path checked: `<output of omp config path, no secrets>`
- File changed: `~/.omp/agent/models.yml` or `<project>/.omp/config.yml`
- Provider/model: `<provider-id>/<model-id>`
- Key source: `<--api-key runtime override | models.yml apiKey | process env | <cwd>/.env | ~/.omp/agent/.env | stored API key | stored OAuth>`, value not printed
- Verification commands suggested or run: `<omp models ...>`
- Remaining issue, if any: `<short error class, no secret material>`
```

Do not include real key values, raw Authorization headers, cookies, or full `.env` contents in the report.
