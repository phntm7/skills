---
name: image-annotator
description: >
  Use when marking up or comparing existing raster images with callouts,
  highlights, redactions, zooms, or diff heatmaps; it produces polished image artifacts.
---

# Image Annotator

Last revised: 2026-07-16

Annotate an existing static image from a deterministic JSON specification. The
Node.js 24+ module uses Sharp for decoding, exact bundled-font text rendering,
raster effects, compositing, and encoding. It does not capture screenshots.

## Setup

Set `SKILL_DIR` to this skill's absolute directory. Install the pinned runtime
dependencies on the machine that will render the image:

```bash
npm install --prefix "$SKILL_DIR/scripts" --omit=dev --package-lock=false
```

Do not copy `node_modules` between operating systems or CPU architectures.
Sharp selects platform-specific optional packages during installation.

## Annotation Workflow

1. Inspect the source image and obtain its decoded dimensions. If the model saw
   a resized preview, record that preview in `coordinateSpace`; the renderer
   maps it to the decoded, auto-oriented source.
2. Describe each target with a vendor-neutral pixel box:
   `"bbox": [x1, y1, x2, y2]`. Convert normalized or y-first model output
   before it reaches the renderer.
3. Prefer high-level `callout` entries with `"placement": "auto"`. The layout
   engine measures the bundled font exactly, searches rings around each target,
   rejects breathing-zone overlaps, and penalizes nearby labels and crossing
   connectors.
4. Use low-level primitives only when the layout must be explicit. Read
   [references/annotation-spec.md](references/annotation-spec.md) for the
   complete contract. Start from
   [assets/example-annotations.json](assets/example-annotations.json).
5. Validate and resolve the layout without writing the main output:

   ```bash
   node "$SKILL_DIR/scripts/annotate-image.mjs" annotate \
     --input screenshot.png \
     --output screenshot-annotated.png \
     --spec annotations.json \
     --dry-run \
     --emit-plan resolved.json \
     --debug-layout debug.png
   ```

6. Render to a new path. Add `--force` only when replacement is intentional:

   ```bash
   node "$SKILL_DIR/scripts/annotate-image.mjs" annotate \
     --input screenshot.png \
     --output screenshot-annotated.png \
     --spec annotations.json
   ```

7. Inspect the output. Check clipping, readable contrast, arrow direction,
   label-to-shaft continuity, target ambiguity, privacy coverage, and clutter.
   For dense images, add a canvas gutter and numbered legend instead of stacking
   labels over content.
8. Report the output path, source and canvas dimensions, coordinate scale,
   annotation counts, and irreversible redactions. The CLI prints this summary
   as JSON.

## Grid and Diff Commands

Create a coordinate grid when model-visible coordinates are uncertain:

```bash
node "$SKILL_DIR/scripts/annotate-image.mjs" grid \
  --input screenshot.png --output screenshot-grid.png --spacing 100
```

Detect changed pixels, group them into connected components, annotate the later
image, and optionally write a heatmap:

```bash
node "$SKILL_DIR/scripts/annotate-image.mjs" diff \
  --before before.png --after after.png \
  --output changes.png --heatmap heatmap.png
```

The diff uses maximum RGBA channel distance, thresholding, dilation, and
connected components. It normalizes large raw comparisons before allocation and
maps detected boxes back to source coordinates.

## Module Interface

Scripts and tests cross the same small seam:

```js
import { annotateImage } from "./scripts/src/annotate.mjs";

const result = await annotateImage({ input, output, spec });
```

Pass a parsed spec object. `input` may be a path or buffer. Set `dryRun: true`
when no output should be written. Optional `emitPlan` and `debugLayout` paths
write editable state and layout diagnostics.

## Design Rules

- Keep labels short. Aim for about 18 px of label padding.
- Put arrow targets slightly inside the marked region. Do not merge an
  arrowhead with an outline.
- Keep badges, arrow endpoints, and unrelated regions separate.
- Use orange `#FF9F1C` for neutral emphasis. Reserve red `#E63946` for bad,
  removed, or destructive states. Pair color with text, shape, or numbering.
- Use `redact` when delivered pixels must contain no readable secret. Blur and
  pixelation are presentation effects, not guaranteed erasure.
- Use a stable `defaults.seed` for sketchy output. The renderer bundles Inter
  and Architects Daughter under the SIL Open Font License and registers them
  through the included Fontconfig file.
- Use `--emit-plan` for repeatable edits. Re-rendering the emitted state preserves
  manual callout positions and its deterministic state hash.

## Guardrails

- The renderer rejects unknown fields, control characters, excessive labels,
  unsupported output formats, input/output path equality, out-of-bounds
  regions, encoded-byte overflow, decoded-pixel overflow, and animated GIFs.
- Raster effects run with bounded concurrency and composite once over the
  oriented base image.
- Keep specs and outputs outside the skill directory.
- Do not claim sensitive content is hidden until the final artifact has been
  inspected.

## Trigger Examples

Should trigger:

- "Annotate this screenshot with automatic arrows and numbered callouts."
- "Pixelate the account ID, spotlight the approval control, and add a zoom inset."
- "Compare these two PNGs and label the changed regions."
- "Render these review notes in a deterministic sketchy style."

Should not trigger:

- "Take a screenshot of the settings page."
- "Add comments to this PDF."
- "Animate these GIF callouts."
- "Remove the background from this product photo."
