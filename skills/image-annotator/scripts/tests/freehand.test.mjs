import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { renderAnnotations } from "../src/render-clean.mjs";

test("tapered freehand arrow remains connected through its final segment", async () => {
  const width = 300;
  const height = 150;
  const defaults = { color: "#FF9F1C", strokeWidth: 8, fontSize: 20, style: "sketchy", seed: 17 };
  const { svg } = await renderAnnotations(sharp, [{
    type: "freehand",
    points: [[20, 100], [100, 60], [180, 90], [240, 40]],
    color: "#FF9F1C",
    strokeWidth: 10,
    taperStart: 8,
    taperEnd: 6,
    headSize: 20,
  }], defaults, { width, height });
  const image = await sharp({ create: { width, height, channels: 3, background: "white" } })
    .composite([{ input: svg }])
    .removeAlpha()
    .raw()
    .toBuffer();
  let covered = 0;
  const samples = 25;
  for (let sample = 0; sample < samples; sample += 1) {
    const progress = sample / (samples - 1);
    const x = Math.round(180 + (240 - 180) * progress);
    const y = Math.round(90 + (40 - 90) * progress);
    let colored = false;
    for (let dy = -3; dy <= 3 && !colored; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) {
        const offset = ((y + dy) * width + x + dx) * 3;
        if (image[offset] > 180 && image[offset + 1] > 70 && image[offset + 1] < 210 && image[offset + 2] < 100) {
          colored = true;
          break;
        }
      }
    }
    if (colored) covered += 1;
  }
  assert.ok(covered / samples >= 0.96, `Freehand final-segment coverage was ${(covered / samples * 100).toFixed(1)}%.`);
});
