#!/usr/bin/env node
// Compare DeepSWE and FrontierCode in one bounded, model-identity-aware view.
// The two board scripts remain the source of truth for fetching and shaping
// their data; this wrapper joins their compact JSON rows.
//
// Usage:
//   node compare_benchmarks.mjs [--help] [--json] [--fresh] [--all]
//                              [--models <patterns>] [--effort <patterns>]
//                              [--subset main|extended] [--metric pass|score]
//                              [--deepswe-version <id>]
//                              [--frontiercode-version v1_1|v1]
//     --help                 show this usage and exit
//
// Without --all, each board contributes one best row per requested model.
// With --all, the comparison is keyed by model × effort and FrontierCode is
// explicitly asked for every effort level. Use --models for context-bounded
// comparisons; a missing pattern is reported in JSON and on stderr.

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalModelId,
  effortKey,
  hasFlag,
  listOptionValues,
  optionValue,
  rowKey,
} from "./benchmark_common.mjs";

const args = process.argv.slice(2);
if (hasFlag(args, "--help") || hasFlag(args, "-h")) {
  console.log(`Usage: node compare_benchmarks.mjs [--help] [--json] [--fresh] [--all]
                             [--models <patterns>] [--effort <patterns>]
                             [--subset main|extended] [--metric pass|score]
                             [--deepswe-version <id>]
                             [--frontiercode-version v1_1|v1]
  --help                 show this usage and exit
  --json                 print compact JSON instead of a markdown table
  --fresh                ignore cache TTL and refetch both boards now
  --all                  one row per model x effort (FrontierCode every level)
  --models <patterns>    comma-separated model ids, names, families, or globs
  --effort <patterns>    comma-separated effort levels or globs
  --subset main|extended FrontierCode task subset (default: main)
  --metric pass|score    FrontierCode ranking metric (default: pass)
  --deepswe-version <id> benchmark revision (default: v1.1)
  --frontiercode-version v1_1|v1
                         benchmark revision (default: v1_1)`);
  process.exit(0);
}
const ALL = hasFlag(args, "--all");
const FRESH = hasFlag(args, "--fresh");
const JSON_OUTPUT = hasFlag(args, "--json");
const MODEL_PATTERNS = listOptionValues(args, "--models");
const EFFORT_PATTERNS = listOptionValues(args, "--effort");
const SUBSET = optionValue(args, "--subset", "main");
const METRIC = optionValue(args, "--metric", "pass");
const DEEPSWE_VERSION = optionValue(args, "--deepswe-version", "v1.1");
const FRONTIERCODE_VERSION = optionValue(args, "--frontiercode-version", "v1_1");
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

function boardArgs(board) {
  const boardArgs = ["--json"];
  if (FRESH) boardArgs.push("--fresh");
  if (MODEL_PATTERNS.length) boardArgs.push("--models", MODEL_PATTERNS.join(","));
  if (EFFORT_PATTERNS.length) boardArgs.push("--effort", EFFORT_PATTERNS.join(","));

  if (board === "deepswe") {
    boardArgs.push("--version", DEEPSWE_VERSION);
  } else {
    boardArgs.push("--version", FRONTIERCODE_VERSION, "--subset", SUBSET, "--metric", METRIC);
    if (ALL) boardArgs.push("--all");
  }

  return boardArgs;
}

function runBoard(board, scriptName) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(SCRIPT_DIR, scriptName), ...boardArgs(board)], {
      cwd: SCRIPT_DIR,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolve({ board, error: error.message, stderr });
    });
    child.on("close", (code) => {
      if (stderr) process.stderr.write(`[${board}] ${stderr}`);
      if (code !== 0) {
        resolve({ board, error: `exited with status ${code}`, stderr });
        return;
      }
      try {
        resolve({ board, payload: JSON.parse(stdout), stderr });
      } catch (error) {
        resolve({ board, error: `invalid JSON output: ${error.message}`, stderr });
      }
    });
  });
}

function bestDeepSweRows(rows) {
  const best = new Map();
  for (const row of rows) {
    const current = best.get(row.model_id);
    if (!current || row.pass1_pct > current.pass1_pct || (row.pass1_pct === current.pass1_pct && (row.cost_usd ?? 0) < (current.cost_usd ?? 0))) {
      best.set(row.model_id, row);
    }
  }
  return [...best.values()];
}

function selectedRows(board, result) {
  if (!result?.payload) return [];
  const rows = result.payload.rows || [];
  if (ALL || board === "frontiercode") return rows;
  return bestDeepSweRows(rows);
}

function boardRowsByKey(board, rows) {
  const entries = new Map();
  for (const row of rows) {
    const modelId = row.model_id || canonicalModelId(row.model);
    const key = ALL ? rowKey(modelId, row.effort) : modelId;
    entries.set(key, { ...row, model_id: modelId });
  }
  return entries;
}

function rowIdentifier(row) {
  return rowKey(row.model_id || canonicalModelId(row.model), row.effort);
}

function interval(row) {
  if (row?.pass1_pct == null || row?.ci_pct == null) return null;
  return [row.pass1_pct - row.ci_pct, row.pass1_pct + row.ci_pct];
}

function overlaps(a, b) {
  const left = interval(a);
  const right = interval(b);
  return left && right && left[0] <= right[1] && right[0] <= left[1];
}

function clearlySeparated(a, b) {
  const left = interval(a);
  const right = interval(b);
  return left && right && (left[1] < right[0] || right[1] < left[0]);
}

function deepSweSignals(row, peers) {
  if (!row) return { ci_overlaps_with: [], dominated_by: [] };
  const comparable = peers.filter((peer) => peer.model_id !== row.model_id && effortKey(peer.effort) === effortKey(row.effort));
  return {
    ci_overlaps_with: comparable.filter((peer) => overlaps(row, peer)).map(rowIdentifier),
    dominated_by: comparable
      .filter(
        (peer) =>
          peer.pass1_pct != null &&
          peer.cost_usd != null &&
          row.pass1_pct != null &&
          row.cost_usd != null &&
          peer.pass1_pct > row.pass1_pct &&
          peer.cost_usd < row.cost_usd &&
          clearlySeparated(row, peer)
      )
      .map(rowIdentifier),
  };
}

function compareRows(deepsweResult, frontiercodeResult) {
  const deepsweRows = selectedRows("deepswe", deepsweResult);
  const frontiercodeRows = selectedRows("frontiercode", frontiercodeResult);
  const deepswe = boardRowsByKey("deepswe", deepsweRows);
  const frontiercode = boardRowsByKey("frontiercode", frontiercodeRows);
  const keys = new Set([...deepswe.keys(), ...frontiercode.keys()]);
  // A requested pattern matched by neither board still gets an explicit row.
  const dsUnmatched = new Set(deepsweResult?.payload?.unmatched_models || []);
  const absentEverywhere = (frontiercodeResult?.payload?.unmatched_models || []).filter((p) => dsUnmatched.has(p));
  for (const pattern of absentEverywhere) keys.add(pattern);
  const allDeepSweRows = [...deepswe.values()];

  return [...keys]
    .map((key) => {
      const ds = deepswe.get(key) || null;
      const fc = frontiercode.get(key) || null;
      const signals = deepSweSignals(ds, allDeepSweRows);
      return {
        model_id: ds?.model_id || fc?.model_id || key,
        models: { deepswe: ds?.model || null, frontiercode: fc?.model || null },
        efforts: { deepswe: ds?.effort || null, frontiercode: fc?.effort || null },
        deepswe: ds,
        frontiercode: fc,
        missing_from_board: [ds ? null : "deepswe", fc ? null : "frontiercode"].filter(Boolean),
        ci_overlaps_with: signals.ci_overlaps_with,
        dominated_by: signals.dominated_by,
      };
    })
    .sort((a, b) => {
      const aQuality = Math.max(a.deepswe?.pass1_pct ?? -1, a.frontiercode?.pass_pct ?? -1);
      const bQuality = Math.max(b.deepswe?.pass1_pct ?? -1, b.frontiercode?.pass_pct ?? -1);
      return bQuality - aQuality || a.model_id.localeCompare(b.model_id);
    });
}

function boardSummary(result) {
  if (!result?.payload) return null;
  const { rows, ...summary } = result.payload;
  return { ...summary, n_rows: rows?.length ?? 0 };
}

function outputObject(deepsweResult, frontiercodeResult) {
  const results = { deepswe: deepsweResult, frontiercode: frontiercodeResult };
  const errors = Object.values(results)
    .filter((result) => result?.error)
    .map((result) => ({ board: result.board, error: result.error }));

  return {
    requested_models: MODEL_PATTERNS,
    requested_efforts: EFFORT_PATTERNS,
    row_mode: ALL ? "all" : "best-effort",
    boards: {
      deepswe: boardSummary(deepsweResult),
      frontiercode: boardSummary(frontiercodeResult),
    },
    unmatched_models: {
      deepswe: deepsweResult?.payload?.unmatched_models || [],
      frontiercode: frontiercodeResult?.payload?.unmatched_models || [],
    },
    unmatched_efforts: {
      deepswe: deepsweResult?.payload?.unmatched_efforts || [],
      frontiercode: frontiercodeResult?.payload?.unmatched_efforts || [],
    },
    errors,
    rows: compareRows(deepsweResult, frontiercodeResult),
    notes: [
      "model_id is the normalized cross-board join key; model preserves each board's display name.",
      "ci_overlaps_with and dominated_by are DeepSWE-only signals among selected rows at the same effort; FrontierCode has no confidence-interval field.",
      "FrontierCode fetched_at is the local fetch/cache-write timestamp because its payload has no board generated_at.",
    ],
  };
}

function pct(value) {
  return value == null ? "-" : `${value.toFixed(1)}%`;
}

function dollars(value) {
  return value == null ? "-" : `$${value.toFixed(2)}`;
}

function markdown(output) {
  let md = "# Coding benchmark comparison\n\n";
  md += `Rows: ${output.row_mode}. Use --all for every FrontierCode reasoning level.\n\n`;
  md += "| Model ID | Effort (DS) | DeepSWE Pass@1 | DS $/task | Effort (FC) | FrontierCode Pass% | FC $/rollout | Missing |\n";
  md += "|---|---|---:|---:|---|---:|---:|---|\n";
  md += output.rows
    .map(
      (row) =>
        `| ${row.model_id} | ${row.efforts.deepswe || "-"} | ${pct(row.deepswe?.pass1_pct)} | ${dollars(
          row.deepswe?.cost_usd
        )} | ${row.efforts.frontiercode || "-"} | ${pct(row.frontiercode?.pass_pct)} | ${dollars(
          row.frontiercode?.cost_usd
        )} | ${row.missing_from_board.map((b) => `absent on ${b}`).join(", ") || "-"} |`
    )
    .join("\n");
  if (output.errors.length) {
    md += `\n\nErrors: ${output.errors.map((error) => `${error.board}: ${error.error}`).join("; ")}`;
  }
  return md;
}

const [deepsweResult, frontiercodeResult] = await Promise.all([
  runBoard("deepswe", "deepswe_leaderboard.mjs"),
  runBoard("frontiercode", "frontiercode_leaderboard.mjs"),
]);
const output = outputObject(deepsweResult, frontiercodeResult);

if (JSON_OUTPUT) console.log(JSON.stringify(output, null, 1));
else console.log(markdown(output));

if (output.errors.length) process.exitCode = 1;
