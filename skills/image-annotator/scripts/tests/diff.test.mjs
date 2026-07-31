import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  connectedComponents,
  dilateMask,
  diffImages,
  renderHeatmap,
  thresholdDifference,
} from "../src/diff.mjs";

test("thresholds by maximum RGBA channel difference", () => {
  const before = Uint8Array.from([0, 0, 0, 255, 10, 10, 10, 255]);
  const after = Uint8Array.from([0, 0, 25, 255, 20, 20, 20, 255]);
  const result = thresholdDifference(before, after, 20);
  assert.deepEqual([...result.mask], [1, 0]);
  assert.deepEqual([...result.intensity], [25, 10]);
});

test("dilates changes and returns components sorted by area", () => {
  const width = 12;
  const height = 8;
  const mask = new Uint8Array(width * height);
  for (const [x, y] of [[1, 1], [2, 1], [1, 2], [8, 5]]) mask[y * width + x] = 1;
  const dilated = dilateMask(mask, width, height, 1);
  const components = connectedComponents(dilated, width, height, 1);
  assert.equal(components.length, 2);
  assert.ok(components[0].area > components[1].area);
  assert.deepEqual(components[0].bbox, [0, 0, 4, 4]);
});

test("renders a black-background heatmap with visible changed pixels", async () => {
  const buffer = await renderHeatmap(Uint8Array.from([0, 255]), 2, 1);
  const { data } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([...data.subarray(0, 3)], [0, 0, 0]);
  assert.deepEqual([...data.subarray(3, 6)], [255, 159, 0]);
});

test("normalizes large raw comparisons and maps boxes back to source coordinates", async () => {
  const before = await sharp({ create: { width: 100, height: 60, channels: 3, background: "white" } }).png().toBuffer();
  const after = await sharp(before)
    .composite([{ input: Buffer.from('<svg width="100" height="60" xmlns="http://www.w3.org/2000/svg"><rect x="60" y="20" width="20" height="20" fill="black"/></svg>') }])
    .png()
    .toBuffer();
  const result = await diffImages({ before, after, threshold: 20, dilation: 0, minArea: 1, rawMaxDimension: 50 });
  assert.equal(result.processingScale, 0.5);
  assert.equal(result.width, 100);
  assert.equal(result.height, 60);
  assert.ok(result.boxes[0].bbox[0] >= 58 && result.boxes[0].bbox[0] <= 62);
  assert.ok(result.boxes[0].bbox[2] >= 78 && result.boxes[0].bbox[2] <= 82);
});
