import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { renderTextLayout, wrapTextExact } from "../src/text.mjs";

const defaults = { color: "#FF9F1C", fontSize: 24, style: "clean" };

test("wraps using rendered glyph widths rather than character counts", async () => {
  const options = { fontSize: 24, fontWeight: "700", color: "#ffffff", style: "clean" };
  const lines = await wrapTextExact(sharp, "WWWW iiiii deterministic-measurement", 145, options);
  assert.ok(lines.length >= 2);
  assert.equal(lines.join("").replaceAll(/\s+/g, ""), "WWWWiiiiideterministic-measurement");
});

test("returns and reuses the exact buffer dimensions it composites", async () => {
  const annotation = { text: "Exact rendered dimensions", maxWidth: 190, fontSize: 24, padding: 18, color: "#ffffff", background: "#FF9F1C" };
  const first = await renderTextLayout(sharp, annotation, defaults);
  const second = await renderTextLayout(sharp, annotation, defaults);
  const metadata = await sharp(first.buffer).metadata();
  assert.equal(first, second);
  assert.equal(metadata.width, first.width);
  assert.equal(metadata.height, first.height);
  assert.ok(first.lines.length >= 2);
});

test("uses distinct bundled clean and sketch fonts", async () => {
  const clean = await renderTextLayout(sharp, { text: "Handwritten proof", maxWidth: 400, style: "clean", background: "transparent" }, defaults);
  const sketch = await renderTextLayout(sharp, { text: "Handwritten proof", maxWidth: 400, style: "sketchy", background: "transparent" }, defaults);
  assert.notEqual(`${clean.textWidth}x${clean.textHeight}`, `${sketch.textWidth}x${sketch.textHeight}`);
});
