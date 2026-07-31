import test from "node:test";
import assert from "node:assert/strict";
import { coordinateScale, mapAnnotations } from "../src/coordinates.mjs";
import {
  connectorPoints,
  rectangleEdgeToward,
  rectsOverlap,
  segmentsIntersect,
} from "../src/geometry.mjs";

test("maps model-visible coordinates to source pixels with canvas offset", () => {
  const scale = coordinateScale({ width: 200, height: 100 }, 800, 300);
  assert.deepEqual(scale, { x: 4, y: 3 });
  const [mapped] = mapAnnotations([{ type: "callout", bbox: [10, 20, 30, 40], label: "Mapped" }], scale, { x: 12, y: 8 });
  assert.deepEqual(mapped.bbox, [52, 68, 132, 128]);
});

test("connects a leader at the nearest rectangle edge", () => {
  assert.deepEqual(rectangleEdgeToward({ x: 10, y: 20, width: 100, height: 40 }, 200, 40), { x: 110, y: 40 });
  assert.throws(() => rectangleEdgeToward({ x: 0, y: 0, width: 100, height: 100 }, 50, 50), /outside its label box/);
});

test("detects overlaps and connector crossings", () => {
  assert.equal(rectsOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 9, y: 9, width: 3, height: 3 }), true);
  assert.equal(segmentsIntersect({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }), true);
  assert.equal(segmentsIntersect({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 6, y: 0 }, { x: 10, y: 0 }), false);
});

test("builds deterministic elbow and bracket connectors", () => {
  assert.deepEqual(connectorPoints({ x: 0, y: 0 }, { x: 100, y: 30 }, "elbow"), [
    { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 30 },
  ]);
  assert.deepEqual(connectorPoints({ x: 0, y: 0 }, { x: 100, y: 30 }, "bracket"), [
    { x: 0, y: 0 }, { x: 14, y: 0 }, { x: 14, y: 30 }, { x: 100, y: 30 },
  ]);
});
