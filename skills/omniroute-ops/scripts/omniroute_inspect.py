#!/usr/bin/env python3
"""Inspect OmniRoute through its two real auth surfaces.

Use this stdlib-only helper when an agent needs live OmniRoute evidence: Bearer API keys
for `/v1/*` proxy calls, and dashboard `auth_token` session cookies for `/api/*`
management calls.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

DEFAULT_BASE_URL = "http://omniroute.lo"
DEFAULT_USER_AGENT = "OpenAI/JS 6.9.1"
PUBLIC_SPEC_URL = "https://raw.githubusercontent.com/diegosouzapw/OmniRoute/main/docs/reference/openapi.yaml"
SENSITIVE_FRAGMENTS = ("key", "token", "secret", "password", "authorization", "cookie")
SECRETS_TO_SCRUB = []
AUTH_HINT = (
    "Hint: this is a management route that needs a dashboard session cookie "
    "(Cookie: auth_token=<session-cookie>), not the OmniRoute API key."
)


def normalize_base_url(raw):
    """Return a base URL without trailing slashes, preserving a trailing /v1."""
    base = (raw or DEFAULT_BASE_URL).strip().rstrip("/")
    return base or DEFAULT_BASE_URL


def api_base_url(raw):
    """Return the root base for /api/* routes, stripping one trailing /v1."""
    base = normalize_base_url(raw)
    if base.endswith("/v1"):
        return base[:-3]
    return base


def build_url(base_url, path):
    """Build a URL while avoiding /v1/v1 and stripping /v1 before /api/* routes."""
    if path.startswith("/api/"):
        return api_base_url(base_url) + path
    base = normalize_base_url(base_url)
    if base.endswith("/v1") and path == "/v1":
        return base
    if base.endswith("/v1") and path.startswith("/v1/"):
        return base + path[3:]
    return base + path


def remember_secret(value):
    if value and value not in SECRETS_TO_SCRUB:
        SECRETS_TO_SCRUB.append(value)
    return value


def read_key(args):
    if args.api_key:
        return remember_secret(args.api_key.strip())
    env_key = os.environ.get("OMNIROUTE_API_KEY", "").strip()
    if env_key:
        return remember_secret(env_key)
    key_file = args.api_key_file or os.environ.get("OMNIROUTE_API_KEY_FILE")
    if key_file:
        try:
            with open(key_file, "r", encoding="utf-8") as handle:
                return remember_secret(handle.read().strip())
        except OSError as exc:
            raise SystemExit(f"Cannot read API key file {key_file}: {exc}") from exc
    raise SystemExit(
        "Missing OmniRoute API key. Set OMNIROUTE_API_KEY, pass --api-key, "
        "or pass --api-key-file."
    )


def read_cookie(args, *, required=True):
    raw_cookie = (args.cookie or os.environ.get("OMNIROUTE_SESSION_COOKIE", "")).strip()
    cookie = raw_cookie
    if "auth_token=" in raw_cookie:
        for part in raw_cookie.split(";"):
            part = part.strip()
            if part.startswith("auth_token="):
                cookie = part[len("auth_token=") :].strip()
                break
    if cookie:
        return remember_secret(cookie)
    if required:
        raise SystemExit(
            "Missing OmniRoute management session cookie. Set OMNIROUTE_SESSION_COOKIE "
            "or pass --cookie; /api/* management routes use Cookie: auth_token=<session-cookie>, "
            "not the API key."
        )
    return ""


def request(
    base_url,
    path,
    *,
    bearer=None,
    cookie=None,
    method="GET",
    body=None,
    user_agent=DEFAULT_USER_AGENT,
    timeout=30,
    accept="application/json",
):
    url = build_url(base_url, path)
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {
        "Accept": accept,
        "User-Agent": user_agent,
    }
    if bearer:
        headers["Authorization"] = f"Bearer {bearer}"
    if cookie:
        headers["Cookie"] = f"auth_token={cookie}"
    if data is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.status, dict(response.headers), response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, dict(exc.headers), exc.read().decode("utf-8", errors="replace")
    except OSError as exc:
        raise SystemExit(f"Request failed for {url}: {exc}") from exc


def fetch_text(url, *, user_agent=DEFAULT_USER_AGENT, timeout=30):
    headers = {"Accept": "text/yaml, text/plain, */*", "User-Agent": user_agent}
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return response.status, response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")
    except OSError as exc:
        raise SystemExit(f"Request failed for {url}: {exc}") from exc


def parse_json(text, context):
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        sample = scrub_text(text[:500].replace("\n", " "))
        raise SystemExit(f"{context} returned non-JSON: {exc}; body={sample!r}") from exc

def parse_json_or_text(text):
    if not text.strip():
        return {}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"raw": scrub_text(text[:1000])}


def scrub(value):
    if isinstance(value, dict):
        out = {}
        for key, item in value.items():
            lower = str(key).lower()
            if any(fragment in lower for fragment in SENSITIVE_FRAGMENTS):
                out[str(key)] = "<redacted>"
            else:
                out[str(key)] = scrub(item)
        return out
    if isinstance(value, list):
        return [scrub(item) for item in value]
    if isinstance(value, str):
        return scrub_text(value)
    return value


def scrub_text(text):
    redacted = str(text)
    for value in SECRETS_TO_SCRUB:
        if value:
            redacted = redacted.replace(value, "<redacted>")
    for name in ("OMNIROUTE_API_KEY", "OMNIROUTE_SESSION_COOKIE"):
        value = os.environ.get(name, "")
        if value:
            redacted = redacted.replace(value, "<redacted>")
    return redacted


def print_json(value):
    print(json.dumps(scrub(value), indent=2, sort_keys=True, ensure_ascii=False))


def header_get(headers, name):
    wanted = name.lower()
    for key, value in headers.items():
        if str(key).lower() == wanted:
            return value
    return None


def is_auth_001(status, data):
    if status == 403:
        return True
    if isinstance(data, dict):
        error = data.get("error")
        if isinstance(error, dict) and error.get("code") == "AUTH_001":
            return True
    return False


def print_management_result(status, data):
    payload = {"status": status, "body": data}
    if is_auth_001(status, data):
        payload["hint"] = AUTH_HINT
    print_json(payload)
    return 0 if status == 200 else 1


def models_from_catalog(data):
    if not isinstance(data, dict):
        return []
    entries = data.get("data")
    if not isinstance(entries, list):
        return []
    models = []
    for entry in entries:
        if isinstance(entry, dict) and entry.get("id") is not None:
            models.append(str(entry.get("id")))
    return models


def cmd_models(args):
    status, _, text = request(
        args.base_url,
        "/v1/models",
        bearer=read_key(args),
        user_agent=args.user_agent,
        timeout=args.timeout,
    )
    data = parse_json(text, "/v1/models")
    if status != 200:
        print_json({"status": status, "body": data})
        return 1
    print_json(data)
    return 0


def cmd_catalog(args):
    status, _, text = request(
        args.base_url,
        "/v1/models",
        bearer=read_key(args),
        user_agent=args.user_agent,
        timeout=args.timeout,
    )
    data = parse_json(text, "/v1/models")
    if status != 200:
        print_json({"status": status, "body": data})
        return 1
    models = models_from_catalog(data)
    counts = {}
    unprefixed = 0
    for model in models:
        if "/" in model:
            prefix = model.split("/", 1)[0]
            counts[prefix] = counts.get(prefix, 0) + 1
        else:
            unprefixed += 1
    print(f"total={len(models)}")
    for prefix, count in sorted(counts.items(), key=lambda item: (-item[1], item[0])):
        print(f"{prefix}\t{count}")
    if unprefixed:
        print(f"<unprefixed>\t{unprefixed}")
    return 0


def extract_message_content(data):
    if not isinstance(data, dict):
        return None
    choices = data.get("choices") or []
    if not choices or not isinstance(choices[0], dict):
        return None
    message = choices[0].get("message") or {}
    if isinstance(message, dict):
        return message.get("content")
    return None


def extract_stream_content(text):
    parts = []
    errors = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line.startswith("data:"):
            continue
        chunk = line[5:].strip()
        if not chunk or chunk == "[DONE]":
            continue
        try:
            data = json.loads(chunk)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict) and data.get("error"):
            errors.append(data.get("error"))
            continue
        choices = data.get("choices") if isinstance(data, dict) else None
        if not choices or not isinstance(choices[0], dict):
            continue
        delta = choices[0].get("delta") or {}
        if isinstance(delta, dict) and delta.get("content") is not None:
            parts.append(str(delta.get("content")))
    return "".join(parts) if parts else None, errors


def cmd_chat(args):
    body = {
        "model": args.model,
        "messages": [{"role": "user", "content": args.prompt}],
        "max_tokens": args.max_tokens,
        "stream": bool(args.stream),
    }
    status, headers, text = request(
        args.base_url,
        "/v1/chat/completions",
        bearer=read_key(args),
        method="POST",
        body=body,
        user_agent=args.user_agent,
        timeout=args.timeout,
    )
    result = {
        "status": status,
        "requestedModel": args.model,
        "routedProvider": header_get(headers, "X-Omniroute-Provider"),
        "routedModel": header_get(headers, "X-Omniroute-Model"),
    }
    if args.stream and text.lstrip().startswith("data:"):
        content, errors = extract_stream_content(text)
        result["content"] = content
        if errors:
            result["error"] = errors[0]
    else:
        data = parse_json_or_text(text)
        result["content"] = extract_message_content(data)
        if isinstance(data, dict) and data.get("error") is not None:
            result["error"] = data.get("error")
        elif isinstance(data, dict) and status >= 400 and data.get("raw") is not None:
            result["error"] = data.get("raw")
        if isinstance(data, dict) and data.get("usage") is not None:
            result["usage"] = data.get("usage")
    print_json(result)
    return 0 if 200 <= status < 300 and result.get("content") is not None and not result.get("error") else 1


def cmd_providers(args):
    status, _, text = request(
        args.base_url,
        "/api/providers",
        cookie=read_cookie(args),
        user_agent=args.user_agent,
        timeout=args.timeout,
    )
    data = parse_json_or_text(text)
    return print_management_result(status, data)


def cmd_quota(args):
    cookie = read_cookie(args)
    pools_status, _, pools_text = request(
        args.base_url,
        "/api/quota/pools",
        cookie=cookie,
        user_agent=args.user_agent,
        timeout=args.timeout,
    )
    plans_status, _, plans_text = request(
        args.base_url,
        "/api/quota/plans",
        cookie=cookie,
        user_agent=args.user_agent,
        timeout=args.timeout,
    )
    pools = parse_json_or_text(pools_text)
    plans = parse_json_or_text(plans_text)
    payload = {
        "quotaPools": {"status": pools_status, "body": pools},
        "quotaPlans": {"status": plans_status, "body": plans},
    }
    if is_auth_001(pools_status, pools) or is_auth_001(plans_status, plans):
        payload["hint"] = AUTH_HINT
    print_json(payload)
    return 0 if pools_status == 200 and plans_status == 200 else 1


def cmd_rate_limits(args):
    status, _, text = request(
        args.base_url,
        "/api/rate-limits",
        cookie=read_cookie(args),
        user_agent=args.user_agent,
        timeout=args.timeout,
    )
    data = parse_json_or_text(text)
    return print_management_result(status, data)


def print_public_spec(args, note):
    status, text = fetch_text(PUBLIC_SPEC_URL, user_agent=args.user_agent, timeout=args.timeout)
    if status != 200:
        print_json({"status": status, "source": PUBLIC_SPEC_URL, "body": text[:1000]})
        return 1
    print(f"# NOTE: {note}; printed public spec mirror from {PUBLIC_SPEC_URL}")
    print(scrub_text(text), end="" if text.endswith("\n") else "\n")
    return 0


def cmd_spec(args):
    cookie = read_cookie(args, required=False)
    if not cookie:
        return print_public_spec(args, "no management session cookie supplied")
    status, _, text = request(
        args.base_url,
        "/api/openapi/spec",
        cookie=cookie,
        user_agent=args.user_agent,
        timeout=args.timeout,
        accept="application/json, text/yaml, application/yaml, */*",
    )
    if status == 200:
        print(scrub_text(text), end="" if text.endswith("\n") else "\n")
        return 0
    data = None
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        pass
    if is_auth_001(status, data or {}) or status == 403:
        return print_public_spec(args, "management spec route returned 403/AUTH_001")
    if data is not None:
        print_json({"status": status, "body": data})
    else:
        print_json({"status": status, "body": scrub_text(text[:1000])})
    return 1


def add_global_flags(parser, *, suppress_defaults=False):
    default = argparse.SUPPRESS if suppress_defaults else None
    parser.add_argument(
        "--base-url",
        default=default if suppress_defaults else os.environ.get("OMNIROUTE_BASE_URL", DEFAULT_BASE_URL),
        help="OmniRoute origin; may include /v1 (env OMNIROUTE_BASE_URL, default: http://omniroute.lo)",
    )
    parser.add_argument(
        "--api-key",
        default=default if suppress_defaults else os.environ.get("OMNIROUTE_API_KEY"),
        help="OmniRoute Bearer API key for /v1/* proxy calls (env OMNIROUTE_API_KEY)",
    )
    parser.add_argument(
        "--api-key-file",
        default=default if suppress_defaults else os.environ.get("OMNIROUTE_API_KEY_FILE"),
        help="File containing the OmniRoute API key (env OMNIROUTE_API_KEY_FILE)",
    )
    parser.add_argument(
        "--cookie",
        default=default if suppress_defaults else os.environ.get("OMNIROUTE_SESSION_COOKIE"),
        help="Dashboard auth_token session value for /api/* management calls (env OMNIROUTE_SESSION_COOKIE)",
    )
    parser.add_argument(
        "--user-agent",
        default=default if suppress_defaults else DEFAULT_USER_AGENT,
        help=f"HTTP user-agent (default: {DEFAULT_USER_AGENT})",
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=default if suppress_defaults else 30,
        help="Request timeout seconds (default: 30)",
    )


def build_parser():
    parser = argparse.ArgumentParser(
        description=(
            "Inspect OmniRoute with Bearer auth for /v1/* and management-session cookie auth for /api/*."
        )
    )
    add_global_flags(parser)
    subcommand_globals = argparse.ArgumentParser(add_help=False)
    add_global_flags(subcommand_globals, suppress_defaults=True)
    sub = parser.add_subparsers(dest="command", required=True)

    models = sub.add_parser("models", parents=[subcommand_globals], help="GET /v1/models with Bearer auth and print scrubbed JSON")
    models.set_defaults(func=cmd_models)

    catalog = sub.add_parser("catalog", parents=[subcommand_globals], help="Summarize /v1/models by provider/model prefix")
    catalog.set_defaults(func=cmd_catalog)

    chat = sub.add_parser("chat", parents=[subcommand_globals], help="POST /v1/chat/completions and print route headers plus content/error")
    chat.add_argument("--model", required=True, help="OmniRoute model id, usually provider/model or auto/*")
    chat.add_argument(
        "--prompt",
        default="Calculate 95222+25820, and reply with the result only.",
        help="User prompt to send",
    )
    chat.add_argument("--max-tokens", type=int, default=64, help="max_tokens to request (default: 64)")
    chat.add_argument("--stream", action="store_true", help="Request streaming chat completions (default: false)")
    chat.set_defaults(func=cmd_chat)

    providers = sub.add_parser("providers", parents=[subcommand_globals], help="GET /api/providers with management session cookie")
    providers.set_defaults(func=cmd_providers)

    quota = sub.add_parser("quota", parents=[subcommand_globals], help="GET /api/quota/pools and /api/quota/plans with management session cookie")
    quota.set_defaults(func=cmd_quota)

    rate_limits = sub.add_parser("rate-limits", parents=[subcommand_globals], help="GET /api/rate-limits with management session cookie")
    rate_limits.set_defaults(func=cmd_rate_limits)

    spec = sub.add_parser(
        "spec",
        parents=[subcommand_globals],
        help="GET /api/openapi/spec with cookie; fall back to the public OpenAPI mirror on 403 or no cookie",
    )
    spec.set_defaults(func=cmd_spec)
    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()
    args.base_url = normalize_base_url(args.base_url)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
