#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const temporaryDirectory = await mkdtemp(join(tmpdir(), "image-annotator-arrow-"));
const inputPath = join(temporaryDirectory, "input.png");
const outputPath = join(temporaryDirectory, "output.png");
const specPath = join(temporaryDirectory, "spec.json");

try {
  await sharp({
    create: {
      width: 600,
      height: 180,
      channels: 3,
      background: "#111827",
    },
  }).png().toFile(inputPath);

  await writeFile(specPath, JSON.stringify({
    defaults: {
      color: "#22d3ee",
      strokeWidth: 4,
      fontSize: 22,
      fontFamily: "Arial, Helvetica, sans-serif",
    },
    annotations: [{
      type: "arrow",
      // A distant legacy start must not detach a labeled arrow from its label.
      x1: 300,
      y1: 82,
      x2: 500,
      y2: 82,
      headSize: 16,
      label: "Assignee",
      labelX: 50,
      labelY: 60,
      maxWidth: 140,
      fontSize: 22,
      padding: 8,
      background: "#0e7490",
    }],
  }));

  const result = spawnSync(process.execPath, [
    join(scriptDirectory, "annotate-image.mjs"),
    "--input", inputPath,
    "--output", outputPath,
    "--spec", specPath,
  ], { encoding: "utf8" });

  assert.equal(result.status, 0, result.stderr || result.stdout);

  const { data, info } = await sharp(outputPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let connectedColumns = 0;
  const firstConnectorX = 170;
  const lastConnectorX = 280;

  for (let x = firstConnectorX; x <= lastConnectorX; x += 1) {
    let hasCyan = false;
    for (let y = 79; y <= 85; y += 1) {
      const offset = (y * info.width + x) * info.channels;
      const [red, green, blue] = data.subarray(offset, offset + 3);
      if (red < 100 && green > 150 && blue > 170) {
        hasCyan = true;
        break;
      }
    }
    if (hasCyan) connectedColumns += 1;
  }

  const coverage = connectedColumns / (lastConnectorX - firstConnectorX + 1);
  assert.ok(
    coverage >= 0.9,
    `Expected the arrow to connect to its label; connector coverage was ${(coverage * 100).toFixed(1)}%.`,
  );

  console.log("arrow label connector: pass");
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
