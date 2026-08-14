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
//                              [--models <patterns>] [--effort <patterns>]
//     --fresh    ignore cache TTL and refetch now
//     --json     print compact JSON rows instead of markdown
//     --version  benchmark version id (default: v1.1)
//     --models   comma-separated model ids, names, families, or globs
//     --effort   comma-separated effort levels or globs
// Requires Node >= 18 (global fetch).

import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import {
  CACHE_TTL_MS,
  cacheMetadata,
  filterRowsByEffort,
  hasFlag,
  listOptionValues,
  optionValue,
  selectModels,
  canonicalModelId,
} from "./benchmark_common.mjs";

const BASE = "https://deepswe.datacurve.ai";
const args = process.argv.slice(2);
const VERSION = optionValue(args, "--version", "v1.1");
const MODEL_PATTERNS = listOptionValues(args, "--models");
const EFFORT_PATTERNS = listOptionValues(args, "--effort");
const CACHE_DIR = join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "deepswe-bench");
const CACHE_FILE = join(CACHE_DIR, `${VERSION}.json`);

function readCache() {
  try {
    const age = Math.max(0, Date.now() - statSync(CACHE_FILE).mtimeMs);
    return {
      json: JSON.parse(readFileSync(CACHE_FILE, "utf8")),
      age,
      fetchedAt: new Date(Date.now() - age).toISOString(),
    };
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
  return { json, fetchedAt: new Date().toISOString() };
}

async function load() {
  const cached = readCache();
  if (cached && cached.age < CACHE_TTL_MS && !hasFlag(args, "--fresh")) {
    return { ...cached, fromCache: true, stale: false };
  }
  try {
    const live = await fetchLive();
    return { ...live, fromCache: false, age: 0, stale: false };
  } catch (e) {
    if (cached) {
      console.error(`WARN: fetch failed (${e.message}); using stale cache (${(cached.age / 3.6e6).toFixed(1)}h old)`);
      return { ...cached, fromCache: true, stale: true };
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
    model_id: canonicalModelId(r.model),
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

function selectRows(json) {
  const modelSelection = selectModels(json.rows.map((row) => row.model), MODEL_PATTERNS);
  const selectedModels = new Set(modelSelection.names);
  const modelRows = json.rows.filter((row) => selectedModels.has(row.model));
  const effortSelection = filterRowsByEffort(modelRows, EFFORT_PATTERNS, (row) => row.reasoning_effort);
  return {
    rows: effortSelection.rows,
    unmatchedModels: modelSelection.unmatched,
    unmatchedEfforts: effortSelection.unmatched,
  };
}

function reportUnmatched(selection) {
  if (selection.unmatchedModels.length) console.error(`WARN: unmatched models: ${selection.unmatchedModels.join(", ")}`);
  if (selection.unmatchedEfforts.length) console.error(`WARN: unmatched efforts: ${selection.unmatchedEfforts.join(", ")}`);
}

function markdown(json, meta, selection) {
  const rows = [...selection.rows].sort((a, b) => b.pass_rate - a.pass_rate);
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

const { json, fromCache, age, stale, fetchedAt } = await load();
const selection = selectRows(json);
reportUnmatched(selection);
const meta = fromCache ? ` (cached ${(age / 3.6e6).toFixed(1)}h ago)` : " (fetched now)";
if (hasFlag(args, "--json")) {
  console.log(
    JSON.stringify(
      {
        version: VERSION,
        generated_at: json.generated_at ?? null,
        ...cacheMetadata({ fromCache, age, stale, fetchedAt }),
        n_tasks: json.n_tasks_in_set,
        row_mode: "all",
        requested_models: MODEL_PATTERNS,
        unmatched_models: selection.unmatchedModels,
        requested_efforts: EFFORT_PATTERNS,
        unmatched_efforts: selection.unmatchedEfforts,
        rows: [...selection.rows].sort((a, b) => b.pass_rate - a.pass_rate).map(compactRow),
      },
      null,
      1
    )
  );
} else {
  console.log(markdown(json, meta, selection));
}
