# Annotation Specification

Last revised: 2026-07-16

Use this reference when creating, validating, or debugging JSON for
`scripts/annotate-image.mjs`. Validation is strict: unknown top-level,
default, output, canvas, legend, limit, and annotation fields are errors.

## Document Shape

A legacy annotation array remains valid. The full object form exposes coordinate
mapping, layout, output, and safety controls:

```json
{
  "version": 1,
  "coordinateSpace": { "width": 1568, "height": 868 },
  "defaults": {
    "color": "#FF9F1C",
    "negativeColor": "#E63946",
    "strokeWidth": 5,
    "fontSize": 28,
    "fontFamily": "Inter",
    "style": "clean",
    "seed": 1
  },
  "canvas": {
    "gutter": { "top": 0, "right": 360, "bottom": 0, "left": 0 },
    "background": "#FFFFFF"
  },
  "legend": {
    "position": "right",
    "width": 360,
    "title": "Review notes",
    "items": [{ "number": 1, "label": "Ownership and approval" }]
  },
  "output": { "quality": 90, "compressionLevel": 9 },
  "limits": {
    "encodedBytes": 52428800,
    "decodedPixels": 40000000,
    "labelLength": 500,
    "annotations": 500,
    "concurrency": 4
  },
  "annotations": []
}
```

`quality` applies to JPEG, WebP, AVIF, and TIFF. `compressionLevel` applies to
PNG. Supported outputs are PNG, JPEG, WebP, AVIF, and TIFF.

## Coordinates

Coordinates refer to the auto-oriented image shown to the model. The renderer
maps them to the decoded source:

```text
sourceX = viewedX × sourceWidth / coordinateSpace.width
sourceY = viewedY × sourceHeight / coordinateSpace.height
```

Omit `coordinateSpace` when coordinates already use decoded source pixels.
Rectangular primitives use `x`, `y`, `width`, and `height`. High-level targets,
zoom regions, and notation primitives use vendor-neutral pixel boxes:

```json
{ "bbox": [1180, 184, 1525, 374] }
```

The order is always `[x1, y1, x2, y2]`. Convert Gemini normalized y-first boxes
and other vendor formats before rendering. Canvas gutters are added after
coordinate mapping, so source coordinates do not change.

## High-Level Callouts

Prefer `callout` when a label explains a rectangular target:

```json
{
  "type": "callout",
  "id": "approval",
  "bbox": [1180, 184, 1525, 374],
  "label": "Ownership and approval",
  "style": "neutral",
  "placement": "auto",
  "mark": "rounded-box",
  "connector": "leader",
  "number": 1,
  "padding": 18,
  "avoid": []
}
```

- `style`: `neutral`, `bad`, `good`, or `warning`.
- `placement`: `auto` or `manual`. Manual placement requires `labelX` and
  `labelY`.
- `mark`: `rounded-box`, `ellipse`, `highlight`, or `none`.
- `connector`: `leader`, `straight`, `curved`, `elbow`, `bracket`, or `none`.
- `avoid`: additional `[x1,y1,x2,y2]` boxes that automatic placement must avoid.
- `number`: positive integer or short string.
- Text fields: `fontSize`, `fontWeight`, `labelColor`, `background`, `maxWidth`,
  `padding`, and `radius`.

Automatic placement measures and retains the same Sharp-rendered label buffer.
It searches candidate rectangles from 25 to 120 px around the target, rejects
target and breathing-zone overlaps, scores local brightness and variance,
prefers shorter leaders, and penalizes nearby labels and crossing connectors.
The leader starts at the exact rendered label edge.

## Canvas Gutters and Legends

`canvas.gutter` accepts one non-negative number or side-specific values. A
legend expands its selected side to at least `legend.width`. Legend entries
render as numbered badges and exact-font labels. Use a gutter for dense images
instead of obscuring source content.

## Raster Effects

Raster effects are extracted from one oriented base in bounded parallel work and
then composited once.

### Blur

```json
{ "type": "blur", "x": 520, "y": 42, "width": 250, "height": 42, "sigma": 18 }
```

`sigma` accepts `0.3` through `1000` and defaults to `14`.

### Pixelate

```json
{ "type": "pixelate", "x": 520, "y": 42, "width": 250, "height": 42, "blockSize": 12 }
```

`blockSize` accepts integers from `2` through `200`.

### Zoom Inset

```json
{
  "type": "zoom",
  "bbox": [1180, 184, 1525, 374],
  "inset": [1600, 120, 1900, 360],
  "connector": "elbow",
  "color": "#FF9F1C"
}
```

`bbox` identifies the source region. `inset` identifies the destination box,
which may sit in a gutter. The renderer resamples the source into the inset and
draws both borders and a connector.

## Privacy and Focus

### Redact

```json
{ "type": "redact", "x": 520, "y": 42, "width": 250, "height": 42, "fill": "#000000" }
```

Redaction replaces pixels with an opaque vector rectangle. Use it instead of
blur or pixelation when the output must contain no readable secret.

### Spotlight

```json
{ "type": "spotlight", "x": 80, "y": 140, "width": 360, "height": 120, "opacity": 0.58, "radius": 12 }
```

The spotlight dims the full canvas except the selected rounded rectangle.
`maskColor` defaults to black.

## Low-Level Clean Primitives

### Box, Ellipse, and Highlight

```json
{ "type": "box", "x": 80, "y": 140, "width": 360, "height": 120, "color": "#FF9F1C", "strokeWidth": 5, "fill": "none", "radius": 8 }
```

Change `type` to `ellipse` for an ellipse within the same bounds. Change it to
`highlight` for a translucent fill; `fill` defaults to `#FFEB3B` and `opacity`
defaults to `0.32`.

### Line and Arrow

```json
{ "type": "line", "x1": 40, "y1": 40, "x2": 320, "y2": 180, "color": "#2563EB" }
```

An unlabeled arrow uses the same points with `"type": "arrow"`. Add `headSize`
to control its arrowhead.

A labeled arrow uses `labelX`, `labelY`, `x2`, and `y2`. Its shaft ignores a
legacy `x1`/`y1` and begins at the nearest exact label edge:

```json
{
  "type": "arrow",
  "x2": 430,
  "y2": 190,
  "label": "Submit is disabled",
  "labelX": 680,
  "labelY": 30,
  "labelColor": "#FFFFFF",
  "background": "#E63946",
  "maxWidth": 220,
  "connector": "curved"
}
```

Connector styles are `straight`, `curved`, `elbow`, and `bracket`.

### Text and Badge

```json
{
  "type": "text",
  "x": 40,
  "y": 30,
  "text": "The validation message is missing",
  "maxWidth": 360,
  "fontSize": 26,
  "fontWeight": "700",
  "color": "#FFFFFF",
  "background": "#FF9F1C",
  "padding": 18,
  "radius": 10
}
```

Text wraps from exact bundled-font glyph measurements. The renderer composites
the same measured buffer, so layout and output dimensions cannot diverge.

A badge uses center coordinates:

```json
{ "type": "badge", "x": 64, "y": 64, "text": "1", "radius": 24, "fill": "#FF9F1C", "textColor": "#FFFFFF" }
```

## Sketchy and Organic Marks

Set `defaults.style` to `sketchy` and provide a stable `defaults.seed`. Rough.js
renders deterministic hand-drawn boxes, ellipses, connectors, and arrowheads.
Architects Daughter supplies sketch labels. Collision rectangles expand by the
roughness margin and stroke width.

A `freehand` annotation uses Perfect Freehand geometry:

```json
{
  "type": "freehand",
  "points": [[40, 180], [90, 150], [160, 190]],
  "color": "#FF9F1C",
  "strokeWidth": 8,
  "thinning": 0.45,
  "smoothing": 0.55,
  "streamline": 0.45,
  "taperStart": 6,
  "taperEnd": 4,
  "headSize": 18
}
```

`headSize` turns the final segment into a tapered freehand arrow.

## Rough-Notation Primitives

Each notation primitive takes `bbox`, `color`, `strokeWidth`, and optional
sketch parameters:

- `underline`: line below the box; `amplitude` controls offset.
- `bracket`: bracket on `top`, `right`, `bottom`, or `left`.
- `circle`: ellipse around the box.
- `notation-highlight`: translucent rectangular marker.
- `strike-through`: one line through the center.
- `crossed-off`: two diagonal lines.

These are server-side geometry. The renderer does not load Rough Notation's DOM
or animation runtime.

## Layering

Raster blur, pixelation, and zoom buffers are composited first. Other
annotations render in array order in one SVG overlay. Exact text and badge
buffers render above vector geometry. Put redaction before any label that must
remain visible.

## Resolved State and Debugging

`--emit-plan resolved.json` writes an editable specification with automatic
callouts converted to manual label positions. It also includes source, canvas,
scale, and a SHA-256 state hash. Re-rendering this file preserves the hash.

`--debug-layout debug.png` adds a 100 px grid, cyan label collision boxes, and
magenta leader diagnostics. `grid` creates a coordinate-only diagnostic image.

## Diff Command

```bash
node scripts/annotate-image.mjs diff \
  --before before.png --after after.png \
  --output changes.png --heatmap heatmap.png \
  --threshold 24 --dilation 2 --min-area 9
```

The diff computes each pixel's maximum RGBA channel difference, thresholds it,
dilates the mask, labels eight-connected components, sorts components by area,
and creates `Change #N` callouts plus a numbered legend. Large images are
normalized before raw RGBA allocation; boxes and heatmaps map back to source
size.

## Failure Cases

The renderer rejects:

- Input and output path equality.
- Existing outputs without `--force`.
- Unsupported output or debug-layout extensions.
- Animated GIF input.
- Unknown fields or unsupported annotation types.
- Invalid JSON, colors, rectangles, boxes, points, or numeric ranges.
- Rectangles or points outside the expanded canvas.
- Labels above configured length or containing control characters.
- Input above encoded-byte or decoded-pixel limits.
- Automatic callouts with no collision-free candidate. Add a gutter, specify
  `avoid` boxes, or switch that callout to manual placement.
