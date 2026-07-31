#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { annotateImage, loadJsonSpec, renderGrid } from "./src/annotate.mjs";
import { diffCallouts, diffImages } from "./src/diff.mjs";
import { UsageError } from "./src/errors.mjs";

function printHelp() {
  console.log(`Annotate, grid, or diff existing static images.

Usage:
  node annotate-image.mjs [annotate] --input <image> --output <image> --spec <json|-> [options]
  node annotate-image.mjs grid --input <image> --output <png> [--spacing 100] [--force]
  node annotate-image.mjs diff --before <image> --after <image> --output <image> [options]

Annotate options:
  --dry-run                 Decode, resolve, and validate without writing output
  --force                   Replace existing outputs
  --emit-plan <json>        Write deterministic, editable resolved state
  --debug-layout <image>    Write grid, collision boxes, and connector geometry

Diff options:
  --threshold <0-255>       Maximum-channel difference threshold (default 24)
  --dilation <pixels>       Dilation radius (default 2)
  --min-area <pixels>       Minimum connected component area (default 9)
  --heatmap <png>           Write a difference heatmap

The input and output paths must differ. Coordinates use the auto-oriented image's top-left corner.`);
}

function commandAndArgs() {
  const [first, ...rest] = process.argv.slice(2);
  return [first && !first.startsWith("-") ? first : "annotate", first && !first.startsWith("-") ? rest : process.argv.slice(2)];
}

function parse(command, args) {
  const shared = { force: { type: "boolean", default: false }, help: { type: "boolean", default: false } };
  const commandOptions = command === "annotate" ? {
    input: { type: "string" }, output: { type: "string" }, spec: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    "emit-plan": { type: "string" }, "debug-layout": { type: "string" },
  } : command === "grid" ? {
    input: { type: "string" }, output: { type: "string" }, spacing: { type: "string", default: "100" },
  } : command === "diff" ? {
    before: { type: "string" }, after: { type: "string" }, output: { type: "string" }, heatmap: { type: "string" },
    threshold: { type: "string", default: "24" }, dilation: { type: "string", default: "2" }, "min-area": { type: "string", default: "9" },
  } : null;
  if (!commandOptions) throw new UsageError(`Unknown command "${command}".`);
  const { values } = parseArgs({ args, options: { ...shared, ...commandOptions }, strict: true, allowPositionals: false });
  if (values.help) {
    printHelp();
    process.exit(0);
  }
  return values;
}

function requireOptions(values, names) {
  for (const name of names) if (!values[name]) throw new UsageError(`Missing required option --${name}. Use --help for usage.`);
}

function integerOption(value, name, min, max) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new UsageError(`--${name} must be an integer from ${min} through ${max}.`);
  return parsed;
}

async function main() {
  const [command, args] = commandAndArgs();
  const values = parse(command, args);
  let result;
  if (command === "annotate") {
    requireOptions(values, ["input", "output", "spec"]);
    result = await annotateImage({
      input: resolve(values.input),
      output: resolve(values.output),
      spec: await loadJsonSpec(values.spec === "-" ? "-" : resolve(values.spec)),
      dryRun: values["dry-run"],
      force: values.force,
      emitPlan: values["emit-plan"] ? resolve(values["emit-plan"]) : undefined,
      debugLayout: values["debug-layout"] ? resolve(values["debug-layout"]) : undefined,
    });
  } else if (command === "grid") {
    requireOptions(values, ["input", "output"]);
    result = await renderGrid({
      input: resolve(values.input), output: resolve(values.output), force: values.force,
      spacing: integerOption(values.spacing, "spacing", 10, 2000),
    });
  } else {
    requireOptions(values, ["before", "after", "output"]);
    const diff = await diffImages({
      before: resolve(values.before), after: resolve(values.after),
      threshold: integerOption(values.threshold, "threshold", 0, 255),
      dilation: integerOption(values.dilation, "dilation", 0, 100),
      minArea: integerOption(values["min-area"], "min-area", 1, 10_000_000),
    });
    if (values.heatmap) await writeFile(resolve(values.heatmap), diff.heatmap);
    result = await annotateImage({
      input: resolve(values.after), output: resolve(values.output), force: values.force,
      spec: {
        version: 1,
        coordinateSpace: { width: diff.width, height: diff.height },
        canvas: { gutter: { right: 360 }, background: "#ffffff" },
        legend: {
          position: "right", width: 360, title: "Detected changes",
          items: diff.boxes.map((_, index) => ({ number: index + 1, label: `Change #${index + 1}` })),
        },
        annotations: diffCallouts(diff.boxes),
      },
    });
    result.diff = { boxes: diff.boxes, threshold: diff.threshold, dilation: diff.dilation, heatmap: values.heatmap ? resolve(values.heatmap) : undefined };
  }
  const { plan: _plan, ...summary } = result;
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  const prefix = error instanceof UsageError ? "Error" : "Unexpected error";
  console.error(`${prefix}: ${error.message}`);
  process.exitCode = 1;
});
