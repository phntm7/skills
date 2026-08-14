#!/usr/bin/env node
// FrontierCode leaderboard fetcher for the coding-benchmarks skill.
//
// Fetches https://cognition.com/data/frontiercode-leaderboard/data.json — the
// same file the leaderboard page (cognition.com/frontiercode) loads
// client-side (referenced from the page's Next.js chunks). The file carries
// both benchmark revisions: v1_1 (current) and v1 (archived, superseded).
//
// Data model per revision:
//   models:  [name]
//   harness: {model: harnessName}        (claude-code, codex, grok-build,
//                                         chisel, cursor-cli, mini-swe-agent)
//   efforts: {model: [effort levels]}    ('none' where no effort dial)
//   subsets: {main: 100, extended: 150}  task counts
//   data:    {model: {effort: {subset: {correct, new_score, tokens, cost,
//             tool_calls, steps, ote, flagged_rate}}}}
//
// Metrics per run (site's own definitions):
//   correct      pass rate — fraction of trials satisfying every blocker
//                rubric criterion (all-or-nothing per trial)
//   new_score    score — weighted aggregate of the rubric items; solutions
//                failing blocking criteria score 0
//   tokens       mean output tokens per rollout
//   cost         mean USD spend per rollout
//   flagged_rate v1_1 — share of runs detected consulting solution-bearing
//                sources; those runs are scored zero
// tool_calls/steps/ote are always null in the current payload.
//
// Caching: raw JSON is cached at ${XDG_CACHE_HOME:-~/.cache}/frontiercode-bench/
// and refetched when older than 24h (file mtime). If the refetch fails and a
// stale cache exists, the stale copy is used with a warning on stderr.
//
// Usage:
//   node frontiercode_leaderboard.mjs [--fresh] [--json]
//                                     [--version v1_1|v1] [--subset main|extended]
//                                     [--metric pass|score] [--all]
//                                     [--models <patterns>] [--effort <patterns>]
//     --fresh     ignore cache TTL and refetch now
//     --json      print compact JSON rows instead of markdown
//     --version   benchmark revision id (default: v1_1; v1 is archived)
//     --subset    task subset (default: main; extended = 150 tasks)
//     --metric    ranking metric (default: pass; score = rubric score)
//     --all       one row per model x effort instead of best-effort-per-model
//     --models    comma-separated model ids, names, families, or globs
//     --effort    comma-separated effort levels or globs
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

const BASE = "https://cognition.com/data/frontiercode-leaderboard/data.json";

const args = process.argv.slice(2);
const VERSION = optionValue(args, "--version", "v1_1");
const SUBSET = optionValue(args, "--subset", "main");
const METRIC = optionValue(args, "--metric", "pass");
const ALL = hasFlag(args, "--all");
const MODEL_PATTERNS = listOptionValues(args, "--models");
const EFFORT_PATTERNS = listOptionValues(args, "--effort");
const CACHE_DIR = join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "frontiercode-bench");
const CACHE_FILE = join(CACHE_DIR, `${VERSION}.json`);

if (!["v1_1", "v1"].includes(VERSION)) {
  console.error(`unknown version "${VERSION}" (expected v1_1 or v1)`);
  process.exit(1);
}
if (!["main", "extended"].includes(SUBSET)) {
  console.error(`unknown subset "${SUBSET}" (expected main or extended)`);
  process.exit(1);
}
if (!["pass", "score"].includes(METRIC)) {
  console.error(`unknown metric "${METRIC}" (expected pass or score)`);
  process.exit(1);
}

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
  const url = `${BASE}?t=${Date.now()}`;
  const r = await fetch(url, { cache: "no-store", headers: { "cache-control": "no-cache" } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`);
  const json = await r.json();
  const rev = json[VERSION];
  if (!rev || !Array.isArray(rev.models)) throw new Error(`unexpected payload shape: missing revision "${VERSION}"`);
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(rev));
  return { json: rev, fetchedAt: new Date().toISOString() };
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

function rawRows(rev, models = rev.models) {
  const rows = [];
  for (const model of models) {
    for (const effort of rev.efforts[model] || []) {
      const row = rev.data[model]?.[effort]?.[SUBSET];
      if (!row) continue;
      const val = METRIC === "score" ? row.new_score : row.correct;
      rows.push({ model, effort, val, row });
    }
  }
  return rows;
}

function bestRows(rows) {
  const best = new Map();
  for (const candidate of rows) {
    if (candidate.val == null) continue;
    const current = best.get(candidate.model);
    if (!current || candidate.val > current.val) {
      best.set(candidate.model, candidate);
    }
  }
  return [...best.values()];
}

const pct = (x) => (x == null ? "" : (x * 100).toFixed(1));
const usd = (x) => (x == null ? "" : x.toFixed(2));
const kt = (x) => (x == null ? "" : x >= 1000 ? (x / 1000).toFixed(x >= 100_000 ? 0 : 1) + "k" : String(Math.round(x)));
const effortLabel = (e) => (e == null || e === "none" ? "-" : e);

function compactRow(rev, model, effort, row) {
  return {
    model,
    model_id: canonicalModelId(model),
    harness: rev.harness[model] || null,
    effort: effort === "none" ? null : effort,
    pass_pct: row.correct == null ? null : +(row.correct * 100).toFixed(1),
    score_pct: row.new_score == null ? null : +(row.new_score * 100).toFixed(1),
    cost_usd: row.cost == null ? null : +row.cost.toFixed(2),
    tokens: row.tokens == null ? null : Math.round(row.tokens),
    flagged_pct: row.flagged_rate == null ? null : +(row.flagged_rate * 100).toFixed(1),
  };
}

function selectRows(rev) {
  const modelSelection = selectModels(rev.models, MODEL_PATTERNS);
  const raw = rawRows(rev, modelSelection.names);
  const effortSelection = filterRowsByEffort(raw, EFFORT_PATTERNS, (candidate) => candidate.effort);
  return {
    rows: ALL ? effortSelection.rows : bestRows(effortSelection.rows),
    unmatchedModels: modelSelection.unmatched,
    unmatchedEfforts: effortSelection.unmatched,
  };
}

function reportUnmatched(selection) {
  if (selection.unmatchedModels.length) console.error(`WARN: unmatched models: ${selection.unmatchedModels.join(", ")}`);
  if (selection.unmatchedEfforts.length) console.error(`WARN: unmatched efforts: ${selection.unmatchedEfforts.join(", ")}`);
}

function markdown(rev, meta, selection) {
  const rows = selection.rows
    .sort((a, b) => b.val - a.val || (a.row.cost ?? 0) - (b.row.cost ?? 0));

  let md = `# FrontierCode ${VERSION} leaderboard — ${SUBSET} subset (${rev.subsets[SUBSET] ?? "?"} tasks)\n\n`;
  const flaggedNote = VERSION === "v1_1" ? "Flagged% = runs zeroed for unfair internet use. " : "";
  md += `${meta} Ranked by best ${METRIC} per model${ALL ? " (every model × effort row)" : ""}. `;
  md += `Pass% = trials passing all blocker rubric criteria; Score% = weighted rubric aggregate (blockers → 0). ${flaggedNote}$/rollout and tokens are means per rollout.\n\n`;
  md += `| # | Model | Harness | Effort | Pass% | Score% | $/rollout | Tokens | Flagged% |\n`;
  md += `|--:|---|---|--:|--:|--:|--:|--:|--:|\n`;
  md += rows
    .map(
      (r, i) =>
        `| ${i + 1} | ${r.model} | ${rev.harness[r.model] || "-"} | ${effortLabel(r.effort)} | ${pct(r.row.correct)} | ${pct(
          r.row.new_score
        )} | ${usd(r.row.cost)} | ${kt(r.row.tokens)} | ${pct(r.row.flagged_rate)} |`
    )
    .join("\n");
  return md;
}

const { json: rev, fromCache, age, stale, fetchedAt } = await load();
const selection = selectRows(rev);
reportUnmatched(selection);
const meta = fromCache ? `Cached ${(age / 3.6e6).toFixed(1)}h ago.` : "Fetched now.";
if (hasFlag(args, "--json")) {
  const rows = selection.rows
    .sort((a, b) => b.val - a.val || (a.row.cost ?? 0) - (b.row.cost ?? 0))
    .map((r) => compactRow(rev, r.model, r.effort, r.row));
  console.log(
    JSON.stringify(
      {
        version: VERSION,
        subset: SUBSET,
        n_tasks: rev.subsets[SUBSET],
        metric: METRIC,
        ...cacheMetadata({ fromCache, age, stale, fetchedAt }),
        row_mode: ALL ? "all" : "best-effort",
        requested_models: MODEL_PATTERNS,
        unmatched_models: selection.unmatchedModels,
        requested_efforts: EFFORT_PATTERNS,
        unmatched_efforts: selection.unmatchedEfforts,
        rows,
      },
      null,
      1
    )
  );
} else {
  console.log(markdown(rev, meta, selection));
}
