# OMP Configuration and Models

Use this reference when an agent needs to inspect, change, or troubleshoot Oh My Pi (`omp`) settings, providers, credentials, or model catalogs. Keep secrets out of transcripts: show variable names, paths, and redacted sources only.

## 1. Config paths and precedence

| Area | Path or source | Notes |
|---|---|---|
| Active agent directory | `omp config path` | Prints the active global agent directory. Default is `~/.omp/agent`; `PI_CODING_AGENT_DIR` relocates it. |
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
5. runtime flags and environment variables.

Project config is not a target for `omp config set`; if you need project-scoped behavior, create or edit `<cwd>/.omp/config.yml` and run OMP from that directory or pass `--cwd <project>`.

## 2. `omp config` commands

| Command | Use |
|---|---|
| `omp config path` | Show the active global agent directory. Use this before editing files if `PI_CODING_AGENT_DIR` might be set. |
| `omp config list` | List effective configurable settings. |
| `omp config get <key>` | Print one setting. Do not use this on keys that may contain secrets. |
| `omp config set <key> <value>` | Write a global setting to `~/.omp/agent/config.yml`. |
| `omp config reset <key>` | Write the schema default for a global setting to `~/.omp/agent/config.yml`. |

Value parsing rule: scalar values can be passed as strings, but arrays and records must be JSON strings. Quote them for the shell.

```bash
omp config set <boolean-key> true
omp config set <array-key> '["value-one","value-two"]'
omp config set <record-key> '{"name":"example","enabled":true}'
```

If a value might contain a token, key, cookie, or credential, do not print it. Prefer editing the appropriate file after confirming the key name and source path.

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
| `providers.<id>.api` | Provider-level API adapter. Use `openai-completions` for OpenAI-compatible chat/completions providers. |
| `providers.<id>.apiKey` | Environment variable name or literal key. Use an environment variable name, not a literal key. |
| `providers.<id>.authHeader` | When `true`, OMP sends `Authorization: Bearer <resolved-key>`. |
| `providers.<id>.auth` | Set to `none` only for providers that require no API key. Otherwise omit it and provide `apiKey`. |
| `providers.<id>.models` | List of model definitions exposed by the provider. Each model must include `id`; it can inherit provider-level `api` or set its own. |

Rules to preserve:

- A custom provider with a non-empty `models` list needs `baseUrl`.
- It needs `apiKey` unless `auth: none` is explicitly correct for that provider.
- It needs an `api` at the provider level or on each model.
- `openai-completions` is the common adapter for OpenAI-compatible chat APIs.
- Keep provider IDs short, lowercase, and stable; changing them changes model names users select.

## 4. Credential resolution and safe secret handling

`apiKey` may be either an environment variable name or a literal secret. Use the environment variable name form:

```yaml
apiKey: NOVITA_API_KEY
```

Resolution order for API keys:

1. process environment;
2. `<cwd>/.env`;
3. `~/.omp/agent/.env`;
4. `~/.omp/.env`;
5. `~/.env`.

The process environment wins and is never overwritten by `.env` files.

Safe handling rules:

- Prefer environment variable names in `models.yml`; use `.env` files or the process environment for the actual values.
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

If the provider wants a different model namespace, keep the model ID exactly as the provider documents it. The OMP model selector combines the provider ID and model ID as `<provider-id>/<model-id>`.

## 6. Model discovery and verification commands

| Command | Use |
|---|---|
| `omp models` | List configured and known models. |
| `omp models --json` | Produce machine-readable model data for agents. Redact any credential-related fields before quoting output. |
| `omp models <provider>` | Show models for one provider, such as `omp models novita`. |
| `omp models find <pattern>` | Search model IDs or names, such as `omp models find minimax`. |
| `omp models refresh` | Refresh model metadata/cache after provider or catalog changes. |
| `omp models canonical` | Show canonical model naming and aliases. |

Useful checks after editing `models.yml`:

```bash
omp models novita
omp models find minimax
omp models canonical
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
- Ensure a non-empty `models` list has model `id` values plus provider-level or model-level `api`, and the provider has `baseUrl` and `apiKey` unless `auth: none`.
- Use the exact selector `<provider-id>/<model-id>`.
- Run `omp models <provider>` and `omp models find <pattern>`.
- Run `omp models refresh` if the cache may be stale.

### Wrong key or auth failure

- Confirm the `apiKey` field names the intended env var, such as `NOVITA_API_KEY`.
- Check whether the process environment overrides `.env` files.
- Verify the key exists in one allowed source without printing it.
- Confirm `authHeader: true` for OpenAI-compatible Bearer-token providers.
- If the provider intentionally has no key, use `auth: none`; do not leave a missing `apiKey` by accident.

### Provider appears disabled or ignored

- Confirm `models.yml` is in the active agent directory, not a different `~/.omp` tree.
- Check for `disabledProviders` in global config, project config, or a `--config` overlay; remove the disable override only when the user intends to re-enable the provider.
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
- Key source: `<process env | <cwd>/.env | ~/.omp/agent/.env | stored auth>`, value not printed
- Verification commands suggested or run: `<omp models ...>`
- Remaining issue, if any: `<short error class, no secret material>`
```

Do not include real key values, raw Authorization headers, cookies, or full `.env` contents in the report.
