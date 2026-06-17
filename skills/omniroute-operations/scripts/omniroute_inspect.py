#!/usr/bin/env python3
"""Inspect OmniRoute models, providers, limits, and chat routes."""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Mapping
from datetime import datetime, timezone
from typing import Any

DEFAULT_BASE_URL = "http://omniroute.lo"
DEFAULT_USER_AGENT = "OpenAI/JS 6.9.1"
SENSITIVE_FRAGMENTS = ("key", "token", "secret", "password", "authorization", "cookie")


def normalize_base_url(raw: str) -> str:
    base = raw.rstrip("/")
    if base.endswith("/v1"):
        return base[:-3]
    return base


def read_key(args: argparse.Namespace) -> str:
    if args.api_key:
        return args.api_key.strip()
    env_key = os.environ.get("OMNIROUTE_API_KEY", "").strip()
    if env_key:
        return env_key
    key_file = args.api_key_file or os.environ.get("OMNIROUTE_API_KEY_FILE")
    if key_file:
        try:
            return open(key_file, "r", encoding="utf-8").read().strip()
        except OSError as exc:
            raise SystemExit(f"Cannot read API key file {key_file}: {exc}") from exc
    raise SystemExit("Missing OmniRoute API key. Set OMNIROUTE_API_KEY, pass --api-key, or pass --api-key-file.")


def request(
    base_url: str,
    path: str,
    key: str,
    *,
    method: str = "GET",
    body: Any | None = None,
    user_agent: str = DEFAULT_USER_AGENT,
    timeout: int = 30,
) -> tuple[int, Mapping[str, str], str]:
    url = normalize_base_url(base_url) + path
    data = None if body is None else json.dumps(body).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "User-Agent": user_agent,
    }
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


def parse_json(text: str, context: str) -> Any:
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        sample = text[:500].replace("\n", " ")
        raise SystemExit(f"{context} returned non-JSON: {exc}; body={sample!r}") from exc


def scrub(value: Any) -> Any:
    if isinstance(value, Mapping):
        out: dict[str, Any] = {}
        for key, item in value.items():
            lower = str(key).lower()
            if any(fragment in lower for fragment in SENSITIVE_FRAGMENTS):
                out[str(key)] = "<redacted>"
            else:
                out[str(key)] = scrub(item)
        return out
    if isinstance(value, list):
        return [scrub(item) for item in value]
    return value


def fmt_time(value: Any) -> str:
    if not value:
        return "unknown"
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    except ValueError:
        return str(value)


def print_json(value: Any) -> None:
    print(json.dumps(scrub(value), indent=2, sort_keys=True, ensure_ascii=False))


def cmd_models(args: argparse.Namespace) -> int:
    key = read_key(args)
    status, _, text = request(args.base_url, "/v1/models", key, user_agent=args.user_agent, timeout=args.timeout)
    data = parse_json(text, "/v1/models")
    if status != 200:
        print_json({"status": status, "body": data})
        return 1
    models = [entry.get("id") for entry in data.get("data", []) if isinstance(entry, dict)]
    if args.filter:
        needle = args.filter.lower()
        models = [model for model in models if needle in str(model).lower()]
    if args.json:
        print_json({"status": status, "count": len(models), "models": models})
    else:
        print(f"status={status} count={len(models)}")
        for model in models:
            print(model)
    return 0


def cmd_providers(args: argparse.Namespace) -> int:
    key = read_key(args)
    status, _, text = request(args.base_url, "/api/providers", key, user_agent=args.user_agent, timeout=args.timeout)
    data = parse_json(text, "/api/providers")
    if args.json or status != 200:
        print_json({"status": status, "body": data})
        return 0 if status == 200 else 1
    print(f"status={status} connections={len(data.get('connections', []))}")
    for connection in data.get("connections", []):
        provider = connection.get("provider")
        name = connection.get("name")
        state = connection.get("testStatus") or connection.get("status") or "unknown"
        active = connection.get("isActive")
        last_error = connection.get("lastError")
        print(f"{provider}\tname={name}\tactive={active}\tstatus={state}\tlastError={last_error}")
    return 0


def cmd_rate_limits(args: argparse.Namespace) -> int:
    key = read_key(args)
    status, _, text = request(args.base_url, "/api/rate-limits", key, user_agent=args.user_agent, timeout=args.timeout)
    data = parse_json(text, "/api/rate-limits")
    print_json({"status": status, "body": data})
    return 0 if status == 200 else 1


def provider_name_map(base_url: str, key: str, args: argparse.Namespace) -> dict[str, str]:
    status, _, text = request(base_url, "/api/providers", key, user_agent=args.user_agent, timeout=args.timeout)
    if status != 200:
        return {}
    data = parse_json(text, "/api/providers")
    return {str(entry.get("id")): str(entry.get("provider") or entry.get("name") or entry.get("id")) for entry in data.get("connections", [])}


def cmd_limits(args: argparse.Namespace) -> int:
    key = read_key(args)
    status, _, text = request(
        args.base_url,
        "/api/usage/provider-limits",
        key,
        user_agent=args.user_agent,
        timeout=args.timeout,
    )
    data = parse_json(text, "/api/usage/provider-limits")
    if status != 200:
        print_json({"status": status, "body": data})
        return 1
    if args.json:
        print_json({"status": status, "body": data})
        return 0

    names = provider_name_map(args.base_url, key, args)
    caches = data.get("caches", {}) if isinstance(data, Mapping) else {}
    print(f"status={status} caches={len(caches)} lastAutoSyncAt={fmt_time(data.get('lastAutoSyncAt'))}")
    for cache_id, cache in caches.items():
        provider = names.get(str(cache_id), str(cache_id))
        plan = cache.get("plan") if isinstance(cache, Mapping) else None
        message = cache.get("message") if isinstance(cache, Mapping) else None
        print(f"{provider}: plan={plan or 'unknown'}" + (f" message={message}" if message else ""))
        quotas = cache.get("quotas", {}) if isinstance(cache, Mapping) else {}
        if not quotas:
            print("  no quota counters exposed")
            continue
        for quota_name, quota in quotas.items():
            if not isinstance(quota, Mapping):
                print(f"  {quota_name}: {quota}")
                continue
            used = quota.get("used", "?")
            total = quota.get("total", "?")
            remaining = quota.get("remaining", "?")
            reset = fmt_time(quota.get("resetAt"))
            pct = quota.get("remainingPercentage")
            pct_text = f" ({pct}%)" if pct is not None else ""
            print(f"  {quota_name}: used={used}/{total} remaining={remaining}{pct_text} resets={reset}")
    return 0


def cmd_test_chat(args: argparse.Namespace) -> int:
    key = read_key(args)
    body = {
        "model": args.model,
        "messages": [{"role": "user", "content": args.prompt}],
        "max_tokens": args.max_tokens,
        "stream": False,
    }
    status, headers, text = request(
        args.base_url,
        "/v1/chat/completions",
        key,
        method="POST",
        body=body,
        user_agent=args.user_agent,
        timeout=args.timeout,
    )
    data = parse_json(text, "/v1/chat/completions") if text.strip().startswith("{") else {"raw": text[:1000]}
    content = None
    if isinstance(data, Mapping):
        choices = data.get("choices") or []
        if choices and isinstance(choices[0], Mapping):
            message = choices[0].get("message") or {}
            if isinstance(message, Mapping):
                content = message.get("content")
    result = {
        "status": status,
        "requestedModel": args.model,
        "routedProvider": headers.get("x-omniroute-provider"),
        "routedModel": headers.get("x-omniroute-model"),
        "content": content,
        "usage": data.get("usage") if isinstance(data, Mapping) else None,
        "error": data.get("error") if isinstance(data, Mapping) else None,
    }
    print_json(result)
    return 0 if status == 200 and content is not None else 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base-url",
        default=os.environ.get("OMNIROUTE_BASE_URL", DEFAULT_BASE_URL),
        help="OmniRoute origin; may include /v1 (default: env OMNIROUTE_BASE_URL or http://omniroute.lo)",
    )
    parser.add_argument("--api-key", help="OmniRoute API key; prefer env/file over CLI for shell history safety")
    parser.add_argument("--api-key-file", help="File containing the OmniRoute API key")
    parser.add_argument("--user-agent", default=DEFAULT_USER_AGENT, help=f"HTTP user-agent (default: {DEFAULT_USER_AGENT})")
    parser.add_argument("--timeout", type=int, default=30, help="Request timeout seconds")
    sub = parser.add_subparsers(dest="command", required=True)

    models = sub.add_parser("models", help="List /v1/models")
    models.add_argument("--filter", help="Case-insensitive substring filter")
    models.add_argument("--json", action="store_true", help="Emit JSON")
    models.set_defaults(func=cmd_models)

    providers = sub.add_parser("providers", help="Summarize /api/providers")
    providers.add_argument("--json", action="store_true", help="Emit full redacted JSON")
    providers.set_defaults(func=cmd_providers)

    limits = sub.add_parser("limits", help="Summarize /api/usage/provider-limits")
    limits.add_argument("--json", action="store_true", help="Emit full redacted JSON")
    limits.set_defaults(func=cmd_limits)

    rate_limits = sub.add_parser("rate-limits", help="Dump /api/rate-limits redacted JSON")
    rate_limits.set_defaults(func=cmd_rate_limits)

    test_chat = sub.add_parser("test-chat", help="Smoke-test /v1/chat/completions")
    test_chat.add_argument("--model", required=True, help="Model ID to test")
    test_chat.add_argument("--prompt", default="Calculate 95222+25820, and reply with the result only.")
    test_chat.add_argument("--max-tokens", type=int, default=64)
    test_chat.set_defaults(func=cmd_test_chat)
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    args.base_url = normalize_base_url(args.base_url)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
