import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSpec } from "../src/specification.mjs";

test("normalizes legacy arrays with deterministic defaults", () => {
  const spec = normalizeSpec([{ type: "box", x: 1, y: 2, width: 3, height: 4 }]);
  assert.equal(spec.version, 1);
  assert.equal(spec.defaults.color, "#FF9F1C");
  assert.equal(spec.defaults.style, "clean");
});

test("rejects unknown top-level and annotation fields", () => {
  assert.throws(() => normalizeSpec({ annotations: [], surprise: true }), /additional properties/);
  assert.throws(() => normalizeSpec({ annotations: [{ type: "box", x: 0, y: 0, width: 10, height: 10, surprise: true }] }), /additional properties/);
});

test("rejects control characters and configured count overflow", () => {
  assert.throws(() => normalizeSpec({ annotations: [{ type: "text", x: 0, y: 0, text: "bad\u0007label" }] }), /control characters/);
  assert.throws(() => normalizeSpec({
    limits: { annotations: 1 },
    annotations: [
      { type: "box", x: 0, y: 0, width: 1, height: 1 },
      { type: "box", x: 1, y: 1, width: 1, height: 1 },
    ],
  }), /configured limit of 1/);
});

test("requires complete manual label coordinates", () => {
  assert.throws(() => normalizeSpec({
    annotations: [{ type: "callout", bbox: [0, 0, 10, 10], label: "Manual", placement: "manual" }],
  }), /labelX|labelY/);
  assert.throws(() => normalizeSpec({
    annotations: [{ type: "arrow", x1: 0, y1: 0, x2: 10, y2: 10, label: "Attached" }],
  }), /labelX|labelY/);
});

test("accepts every expanded primitive and strict coordinate space", () => {
  const spec = normalizeSpec({
    coordinateSpace: { width: 100, height: 100 },
    annotations: [
      { type: "callout", bbox: [1, 2, 30, 40], label: "Callout" },
      { type: "pixelate", x: 1, y: 2, width: 30, height: 40 },
      { type: "spotlight", x: 1, y: 2, width: 30, height: 40 },
      { type: "zoom", bbox: [1, 2, 30, 40], inset: [50, 50, 90, 90] },
      { type: "freehand", points: [[1, 1], [2, 2]] },
      { type: "underline", bbox: [1, 2, 30, 40] },
      { type: "bracket", bbox: [1, 2, 30, 40] },
      { type: "circle", bbox: [1, 2, 30, 40] },
      { type: "notation-highlight", bbox: [1, 2, 30, 40] },
      { type: "strike-through", bbox: [1, 2, 30, 40] },
      { type: "crossed-off", bbox: [1, 2, 30, 40] }
    ],
  });
  assert.equal(spec.annotations.length, 11);
});
