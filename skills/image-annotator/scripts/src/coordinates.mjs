import { UsageError } from "./errors.mjs";

const round = (value) => Math.round(value * 1_000_000) / 1_000_000;

export function coordinateScale(coordinateSpace, sourceWidth, sourceHeight) {
  if (coordinateSpace === undefined) return { x: 1, y: 1 };
  if (!coordinateSpace || typeof coordinateSpace !== "object") {
    throw new UsageError("coordinateSpace must be an object.");
  }
  const { width, height } = coordinateSpace;
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
    throw new UsageError("coordinateSpace.width and coordinateSpace.height must be positive numbers.");
  }
  return { x: sourceWidth / width, y: sourceHeight / height };
}

export function mapPoint([x, y], scale, offset = { x: 0, y: 0 }) {
  return [round(x * scale.x + offset.x), round(y * scale.y + offset.y)];
}

export function mapBox([x1, y1, x2, y2], scale, offset = { x: 0, y: 0 }) {
  const [left, top] = mapPoint([x1, y1], scale, offset);
  const [right, bottom] = mapPoint([x2, y2], scale, offset);
  return [left, top, right, bottom];
}

export function rectFromBox([x1, y1, x2, y2]) {
  if (![x1, y1, x2, y2].every(Number.isFinite) || x2 <= x1 || y2 <= y1) {
    throw new UsageError("bbox must be [x1, y1, x2, y2] with x2 > x1 and y2 > y1.");
  }
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

export function mapAnnotations(annotations, scale, offset = { x: 0, y: 0 }) {
  return annotations.map((annotation) => {
    const mapped = { ...annotation };
    const pointPairs = [["x", "y"], ["x1", "y1"], ["x2", "y2"], ["labelX", "labelY"]];
    for (const [xKey, yKey] of pointPairs) {
      if (mapped[xKey] !== undefined && mapped[yKey] !== undefined) {
        [mapped[xKey], mapped[yKey]] = mapPoint([mapped[xKey], mapped[yKey]], scale, offset);
      }
    }
    if (mapped.width !== undefined) mapped.width = round(mapped.width * scale.x);
    if (mapped.height !== undefined) mapped.height = round(mapped.height * scale.y);
    for (const key of ["bbox", "inset"]) {
      if (mapped[key] !== undefined) mapped[key] = mapBox(mapped[key], scale, offset);
    }
    if (Array.isArray(mapped.avoid)) mapped.avoid = mapped.avoid.map((box) => mapBox(box, scale, offset));
    if (Array.isArray(mapped.points)) mapped.points = mapped.points.map((point) => mapPoint(point, scale, offset));
    return mapped;
  });
}

export function normalizeGutter(gutter = 0) {
  if (typeof gutter === "number") {
    if (!Number.isFinite(gutter) || gutter < 0) throw new UsageError("canvas.gutter must be non-negative.");
    return { top: gutter, right: gutter, bottom: gutter, left: gutter };
  }
  const result = {};
  for (const side of ["top", "right", "bottom", "left"]) {
    const value = gutter?.[side] ?? 0;
    if (!Number.isFinite(value) || value < 0) throw new UsageError(`canvas.gutter.${side} must be non-negative.`);
    result[side] = value;
  }
  return result;
}
