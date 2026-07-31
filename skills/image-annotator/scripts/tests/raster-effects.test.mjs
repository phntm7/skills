import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { applyRasterEffects, mapLimit } from "../src/raster-effects.mjs";

function pixel(data, width, x, y) {
  const offset = (y * width + x) * 3;
  return [...data.subarray(offset, offset + 3)];
}

function changedPixels(before, after, width, rect) {
  let changed = 0;
  for (let y = rect.y; y < rect.y + rect.height; y += 1) {
    for (let x = rect.x; x < rect.x + rect.width; x += 1) {
      if (!Buffer.from(pixel(before, width, x, y)).equals(Buffer.from(pixel(after, width, x, y)))) changed += 1;
    }
  }
  return changed;
}

test("bounds parallel work at configured concurrency", async () => {
  let active = 0;
  let maximum = 0;
  const output = await mapLimit([1, 2, 3, 4, 5], 2, async (value) => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return value * 2;
  });
  assert.deepEqual(output, [2, 4, 6, 8, 10]);
  assert.equal(maximum, 2);
});

test("applies blur, pixelation, and zoom in one final composite", async () => {
  const width = 120;
  const height = 80;
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 3;
      raw[offset] = (x + y) % 4 < 2 ? 20 : 235;
      raw[offset + 1] = x % 6 < 3 ? 40 : 210;
      raw[offset + 2] = y % 6 < 3 ? 60 : 190;
    }
  }
  const base = await sharp(raw, { raw: { width, height, channels: 3 } }).png().toBuffer();
  const output = await applyRasterEffects(sharp, base, [
    { type: "blur", x: 5, y: 5, width: 30, height: 25, sigma: 4 },
    { type: "pixelate", x: 45, y: 5, width: 30, height: 25, blockSize: 8 },
    { type: "zoom", bbox: [5, 40, 30, 65], inset: [80, 40, 115, 75] },
  ], { width, height }, 2);
  const before = await sharp(base).removeAlpha().raw().toBuffer();
  const after = await sharp(output).removeAlpha().raw().toBuffer();
  assert.ok(changedPixels(before, after, width, { x: 5, y: 5, width: 30, height: 25 }) > 500);
  assert.ok(changedPixels(before, after, width, { x: 45, y: 5, width: 30, height: 25 }) > 100);
  assert.ok(changedPixels(before, after, width, { x: 80, y: 40, width: 35, height: 35 }) > 800);
  assert.deepEqual(pixel(after, width, 70, 35), pixel(before, width, 70, 35));
});
