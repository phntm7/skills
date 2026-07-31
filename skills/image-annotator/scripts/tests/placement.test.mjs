import test from "node:test";
import assert from "node:assert/strict";
import {
  generateLabelCandidates,
  placeCallouts,
  regionBrightness,
  scoreCandidate,
} from "../src/placement.mjs";

const image = { data: Uint8Array.from({ length: 400 * 300 }, (_, index) => index % 256), width: 400, height: 300 };

test("samples deterministic brightness statistics", () => {
  const first = regionBrightness(image, { x: 10, y: 10, width: 80, height: 40 });
  const second = regionBrightness(image, { x: 10, y: 10, width: 80, height: 40 });
  assert.deepEqual(first, second);
  assert.ok(first.mean > 0 && first.std > 0);
});

test("ring candidates remain within canvas and outside target", () => {
  const target = { x: 150, y: 120, width: 80, height: 40 };
  const candidates = generateLabelCandidates(target, { width: 100, height: 40 }, { width: 400, height: 300 });
  assert.ok(candidates.length > 20);
  for (const candidate of candidates) {
    assert.ok(candidate.x >= 0 && candidate.y >= 0);
    assert.ok(candidate.x + candidate.width <= 400 && candidate.y + candidate.height <= 300);
  }
});

test("rejects breathing-zone overlap and penalizes connector crossings", () => {
  const target = { x: 150, y: 120, width: 80, height: 40 };
  assert.equal(scoreCandidate({ x: 145, y: 115, width: 100, height: 40 }, target, image), -Infinity);
  const candidate = { x: 20, y: 120, width: 100, height: 40 };
  const clear = scoreCandidate(candidate, target, image);
  const crossing = scoreCandidate(candidate, target, image, [{
    labelRect: { x: 260, y: 20, width: 80, height: 30 },
    connectorGeometry: { start: { x: 200, y: 80 }, end: { x: 80, y: 200 } },
  }]);
  assert.ok(crossing < clear);
});

test("places callouts greedily without label overlap", () => {
  const placed = placeCallouts([
    { id: "first", targetRect: { x: 100, y: 100, width: 40, height: 30 }, labelSize: { width: 90, height: 35 }, placement: "auto", avoid: [] },
    { id: "second", targetRect: { x: 220, y: 130, width: 40, height: 30 }, labelSize: { width: 90, height: 35 }, placement: "auto", avoid: [] },
  ], image, { width: 400, height: 300 });
  assert.equal(placed.length, 2);
  assert.notDeepEqual(placed[0].labelRect, placed[1].labelRect);
  for (const item of placed) assert.ok(Number.isFinite(item.connectorGeometry.start.x));
});
