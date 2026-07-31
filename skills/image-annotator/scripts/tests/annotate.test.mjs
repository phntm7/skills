import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { annotateImage } from "../src/annotate.mjs";

async function fixture(directory) {
  const input = join(directory, "input.png");
  await sharp({ create: { width: 360, height: 240, channels: 3, background: "#E5E7EB" } })
    .composite([{ input: Buffer.from('<svg width="360" height="240" xmlns="http://www.w3.org/2000/svg"><rect x="120" y="85" width="100" height="50" fill="#2563EB"/></svg>') }])
    .png()
    .toFile(input);
  return input;
}

test("annotateImage maps coordinates, resolves callouts, and round-trips state", async () => {
  const directory = await mkdtemp(join(tmpdir(), "image-annotator-e2e-"));
  try {
    const input = await fixture(directory);
    const output = join(directory, "first.png");
    const statePath = join(directory, "state.json");
    const first = await annotateImage({
      input,
      output,
      emitPlan: statePath,
      spec: {
        coordinateSpace: { width: 180, height: 120 },
        canvas: { gutter: 80, background: "#ffffff" },
        annotations: [{
          type: "callout", bbox: [60, 42.5, 110, 67.5], label: "Mapped target",
          placement: "auto", mark: "rounded-box", connector: "leader", number: 1,
        }],
      },
    });
    assert.deepEqual(first.coordinateScale, { x: 2, y: 2 });
    assert.deepEqual([first.width, first.height], [520, 400]);
    const state = JSON.parse(await readFile(statePath, "utf8"));
    assert.equal(state.annotations[0].placement, "manual");
    assert.ok(Number.isFinite(state.annotations[0].labelX));
    const second = await annotateImage({ input, output: join(directory, "second.png"), spec: state });
    assert.equal(second.stateHash, first.stateHash);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("sketch rendering is byte-for-byte deterministic for a stable seed", async () => {
  const directory = await mkdtemp(join(tmpdir(), "image-annotator-seed-"));
  try {
    const input = await fixture(directory);
    const spec = {
      defaults: { style: "sketchy", seed: 99 },
      annotations: [
        { type: "box", x: 40, y: 40, width: 100, height: 60 },
        { type: "text", x: 160, y: 40, text: "Stable sketch", maxWidth: 150 },
        { type: "freehand", points: [[30, 180], [90, 150], [160, 190]], strokeWidth: 8, headSize: 16 },
      ],
    };
    const left = join(directory, "left.png");
    const right = join(directory, "right.png");
    await annotateImage({ input, output: left, spec });
    await annotateImage({ input, output: right, spec });
    assert.deepEqual(await readFile(left), await readFile(right));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("enforces encoded-byte and decoded-pixel safety limits", async () => {
  const input = await sharp({ create: { width: 20, height: 20, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(
    annotateImage({ input, dryRun: true, spec: { limits: { encodedBytes: 1 }, annotations: [] } }),
    /encoded limit/,
  );
  await assert.rejects(
    annotateImage({ input, dryRun: true, spec: { limits: { decodedPixels: 100 }, annotations: [] } }),
    /pixel limit|exceeds/,
  );
  await assert.rejects(
    annotateImage({
      input,
      output: "/tmp/image-annotator-collision.png",
      emitPlan: "/tmp/image-annotator-collision.png",
      force: true,
      spec: { annotations: [] },
    }),
    /paths must differ/,
  );
});
