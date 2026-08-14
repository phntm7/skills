#!/usr/bin/env node
// DeepSWE leaderboard fetcher for the coding-benchmarks skill.
//
// Fetches https://deepswe.datacurve.ai/artifacts/<version>/leaderboard-live.json
// (v1.1 by default; v1 is a frozen, outdated benchmark) and prints a compact,
// token-efficient markdown leaderboard to stdout.
//
// Vercel serves the artifact with `max-age=0, must-revalidate` but intermediate
// caches can still return stale copies, so the fetch uses no-store + a
// cache-busting query param.
//
// Caching: raw JSON is cached at ${XDG_CACHE_HOME:-~/.cache}/deepswe-bench/
// and refetched when older than 24h (file mtime). If the refetch fails and a
// stale cache exists, the stale copy is used with a warning on stderr.
//
// Usage:
//   node deepswe_leaderboard.mjs [--fresh] [--json] [--version <id>]
//     --fresh    ignore cache TTL and refetch now
//     --json     print compact JSON rows instead of markdown
//     --version  benchmark version id (default: v1.1)
// Requires Node >= 18 (global fetch).

import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const BASE = "https://deepswe.datacurve.ai";
const TTL_MS = 24 * 60 * 60 * 1000;

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f, d) => {
  const i = args.indexOf(f);
  return i !== -1 && args[i + 1] ? args[i + 1] : d;
};
const VERSION = opt("--version", "v1.1");
const CACHE_DIR = join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "deepswe-bench");
const CACHE_FILE = join(CACHE_DIR, `${VERSION}.json`);

function readCache() {
  try {
    const age = Date.now() - statSync(CACHE_FILE).mtimeMs;
    return { json: JSON.parse(readFileSync(CACHE_FILE, "utf8")), age };
  } catch {
    return null;
  }
}

async function fetchLive() {
  const url = `${BASE}/artifacts/${VERSION}/leaderboard-live.json?t=${Date.now()}`;
  const r = await fetch(url, { cache: "no-store", headers: { "cache-control": "no-cache" } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`);
  const json = await r.json();
  if (!Array.isArray(json.rows)) throw new Error("unexpected artifact shape: missing rows[]");
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(json));
  return json;
}

async function load() {
  const cached = readCache();
  if (cached && cached.age < TTL_MS && !flag("--fresh")) return { json: cached.json, fromCache: true, age: cached.age };
  try {
    return { json: await fetchLive(), fromCache: false, age: 0 };
  } catch (e) {
    if (cached) {
      console.error(`WARN: fetch failed (${e.message}); using stale cache (${(cached.age / 3.6e6).toFixed(1)}h old)`);
      return { json: cached.json, fromCache: true, age: cached.age };
    }
    throw e;
  }
}

// Compact formatting: 1-decimal percentages, 2-decimal dollars, k-tokens.
const pct = (x) => (x == null ? "" : (x * 100).toFixed(1));
const usd = (x) => (x == null ? "" : x.toFixed(2));
const kt = (x) => (x == null ? "" : x >= 1000 ? (x / 1000).toFixed(x >= 100_000 ? 0 : 1) + "k" : String(Math.round(x)));
const int = (x) => (x == null ? "" : String(Math.round(x)));
const min = (x) => (x == null ? "" : (x / 60).toFixed(1));

function compactRow(r) {
  return {
    model: r.model,
    effort: r.reasoning_effort || null,
    pass1_pct: r.pass_rate == null ? null : +(r.pass_rate * 100).toFixed(1),
    ci_pct: r.ci_half == null ? null : +(r.ci_half * 100).toFixed(1),
    pass4_pct: r.pass_at_4 == null ? null : +(r.pass_at_4 * 100).toFixed(1),
    attempts: r.n_attempted ?? null,
    cost_usd: r.mean_cost_usd == null ? null : +r.mean_cost_usd.toFixed(2),
    out_tokens: r.mean_output_tokens == null ? null : Math.round(r.mean_output_tokens),
    steps: r.mean_agent_steps == null ? null : Math.round(r.mean_agent_steps),
    duration_min: r.mean_duration_seconds == null ? null : +(r.mean_duration_seconds / 60).toFixed(1),
    peak_ctx_tokens: r.median_peak_context_tokens ?? null,
  };
}

function markdown(json, meta) {
  const rows = [...json.rows].sort((a, b) => b.pass_rate - a.pass_rate);
  let md = `# DeepSWE ${VERSION} leaderboard\n\n`;
  md += `${json.n_tasks_in_set} tasks, generated ${json.generated_at?.slice(0, 10)}${meta}. `;
  md += `Pass@1 = attempt pass rate; pass@4 = tasks solved by any of 4 attempts. `;
  md += `Cost/out-tok/steps/duration are means per attempt; ctx = median peak context tokens. Ranked by pass@1.\n\n`;
  md += `| # | Model | Effort | Pass@1% | ± | Pass@4% | $/task | Out-tok | Steps | Min | Ctx |\n`;
  md += `|--:|---|---|--:|--:|--:|--:|--:|--:|--:|--:|\n`;
  md += rows
    .map((r, i) =>
      `| ${i + 1} | ${r.model} | ${r.reasoning_effort || "-"} | ${pct(r.pass_rate)} | ${pct(r.ci_half)} | ${pct(
        r.pass_at_4
      )} | ${usd(r.mean_cost_usd)} | ${kt(r.mean_output_tokens)} | ${int(r.mean_agent_steps)} | ${min(
        r.mean_duration_seconds
      )} | ${kt(r.median_peak_context_tokens)} |`
    )
    .join("\n");
  return md;
}

const { json, fromCache, age } = await load();
const meta = fromCache ? ` (cached ${(age / 3.6e6).toFixed(1)}h ago)` : " (fetched now)";
if (flag("--json")) {
  console.log(
    JSON.stringify(
      {
        version: VERSION,
        generated_at: json.generated_at,
        n_tasks: json.n_tasks_in_set,
        rows: [...json.rows].sort((a, b) => b.pass_rate - a.pass_rate).map(compactRow),
      },
      null,
      1
    )
  );
} else {
  console.log(markdown(json, meta));
}
