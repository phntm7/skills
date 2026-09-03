// Shared CLI, model-identity, filter, and cache helpers for the
// coding-benchmarks scripts.

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export function hasFlag(args, name) {
  return args.includes(name);
}

export function optionValues(args, name) {
  const values = [];
  const prefix = `${name}=`;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === name) {
      const value = args[i + 1];
      if (!value || value.startsWith("--")) throw new Error(`missing value for ${name}`);
      values.push(value);
      i += 1;
    } else if (arg.startsWith(prefix)) {
      const value = arg.slice(prefix.length);
      if (!value) throw new Error(`missing value for ${name}`);
      values.push(value);
    }
  }

  return values;
}

export function optionValue(args, name, fallback) {
  const values = optionValues(args, name);
  return values.length ? values[values.length - 1] : fallback;
}

export function listOptionValues(args, name) {
  return unique(
    optionValues(args, name)
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean)
  );
}

function unique(values) {
  return [...new Set(values)];
}

function compactKey(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// These aliases are deliberately explicit for models that appear on both
// boards with different punctuation or display-name conventions. Unknown
// future models still get a deterministic slug via canonicalModelId().
//
// Identity policy: version-distinct models are NEVER merged. `claude-fable-5`
// stays distinct from Fable 5.1, and bare `deepseek-v4-flash` / `deepseek-v4-pro`
// stay distinct from `deepseek-v4-flash-0731` / `deepseek-v4-pro-0813`. Add an
// alias only when both boards confirm the two names are the same model; a
// roster model absent from a board surfaces as an explicit absent/missing row,
// never as a silent merge or silent gap.
const CANONICAL_BY_KEY = new Map([
  ["claudeopus5", "claude-opus-5"],
  ["claudeopus48", "claude-opus-4.8"],
  ["claudeopus47", "claude-opus-4.7"],
  ["claudeopus46", "claude-opus-4.6"],
  ["claudefable5", "claude-fable-5"],
  ["claudesonnet5", "claude-sonnet-5"],
  ["claudesonnet46", "claude-sonnet-4.6"],
  ["gpt56sol", "gpt-5.6-sol"],
  ["gpt56luna", "gpt-5.6-luna"],
  ["gpt56terra", "gpt-5.6-terra"],
  ["gpt55", "gpt-5.5"],
  ["gpt54", "gpt-5.4"],
  ["gpt54mini", "gpt-5.4-mini"],
  ["grok46", "grok-4.6"],
  ["grok45", "grok-4.5"],
  ["gemini37flash", "gemini-3.7-flash"],
  ["gemini36flash", "gemini-3.6-flash"],
  ["gemini35flash", "gemini-3.5-flash"],
  ["gemini31propreview", "gemini-3.1-pro-preview"],
  ["deepseekv4pro", "deepseek-v4-pro"],
  ["deepseekv4flash", "deepseek-v4-flash"],
  ["deepseekv4flash0731", "deepseek-v4-flash-0731"],
  ["kimmik3", "kimi-k3"],
  ["kimmik27", "kimi-k2.7"],
  ["kimmik27code", "kimi-k2.7-code"],
  ["qwen38max", "qwen3-8-max"],
  ["qwen37plus", "qwen-3.7-plus"],
  ["glm52", "glm-5.2"],
  ["swe17", "swe-1.7"],
  ["swe16", "swe-1.6"],
  ["composer25", "composer-2.5"],
  ["minimaxm3", "minimax-m3"],
  ["musespark12", "muse-spark-1.2"],
  ["musespark11", "muse-spark-1.1"],
  ["mistral35medium", "mistral-3.5-medium"],
]);

export function canonicalModelId(name) {
  const raw = String(name ?? "").trim();
  return CANONICAL_BY_KEY.get(compactKey(raw)) || slugify(raw);
}

function patternSlug(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9*?./-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function modelVariants(name) {
  const raw = String(name ?? "").trim().toLowerCase();
  const canonical = canonicalModelId(name);
  return unique([raw, slugify(raw), canonical, slugify(canonical)]);
}

function patternVariants(pattern) {
  const raw = String(pattern ?? "").trim().toLowerCase();
  const slug = patternSlug(raw);
  const variants = [raw, slug];
  if (!raw.includes("*") && !raw.includes("?")) {
    variants.push(canonicalModelId(raw), slugify(canonicalModelId(raw)));
  }
  return unique(variants.filter(Boolean));
}

function globRegex(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped.replace(/\*/g, ".*").replace(/\?/g, ".")}$`, "i");
}

function matchesTextPattern(pattern, value, { fuzzy = false } = {}) {
  if (pattern.includes("*") || pattern.includes("?")) return globRegex(pattern).test(value);
  return value === pattern || (fuzzy && (value.startsWith(`${pattern}-`) || value.includes(pattern)));
}

export function matchesModelPattern(pattern, modelName) {
  return patternVariants(pattern).some((candidatePattern) =>
    modelVariants(modelName).some((candidate) => matchesTextPattern(candidatePattern, candidate, { fuzzy: true }))
  );
}

export function selectModels(modelNames, patterns) {
  const names = unique(modelNames);
  if (!patterns.length) return { names, unmatched: [] };

  return {
    names: names.filter((name) => patterns.some((pattern) => matchesModelPattern(pattern, name))),
    unmatched: patterns.filter((pattern) => !names.some((name) => matchesModelPattern(pattern, name))),
  };
}

function effortVariants(effort) {
  const value = effort == null || effort === "none" ? "none" : String(effort).toLowerCase();
  return value === "none" ? ["none", "-", ""] : [value];
}

export function matchesEffortPattern(pattern, effort) {
  const normalized = String(pattern ?? "").trim().toLowerCase();
  if (!normalized) return false;
  return effortVariants(effort).some((candidate) =>
    matchesTextPattern(normalized, candidate, { fuzzy: false })
  );
}

export function filterRowsByEffort(rows, patterns, getEffort) {
  if (!patterns.length) return { rows, unmatched: [] };
  return {
    rows: rows.filter((row) => patterns.some((pattern) => matchesEffortPattern(pattern, getEffort(row)))),
    unmatched: patterns.filter((pattern) => !rows.some((row) => matchesEffortPattern(pattern, getEffort(row)))),
  };
}

export function effortKey(effort) {
  return effort == null || effort === "none" ? "none" : String(effort);
}

export function rowKey(modelId, effort) {
  return `${modelId}@${effortKey(effort)}`;
}

export function roundHours(ageMs) {
  return Number((Math.max(0, ageMs) / 3.6e6).toFixed(1));
}

export function cacheMetadata({ fromCache, age, stale, fetchedAt }) {
  return {
    fromCache,
    age_hours: roundHours(age),
    stale,
    fetched_at: fetchedAt ?? null,
  };
}
