import { PLACEMENT } from "./constants.mjs";
import {
  center,
  distance,
  inflateRect,
  rectangleEdgeToward,
  rectsOverlap,
  rectWithin,
  segmentsIntersect,
} from "./geometry.mjs";
import { UsageError } from "./errors.mjs";

export function regionBrightness(image, rect) {
  const left = Math.max(0, Math.floor(rect.x - (image.offsetX ?? 0)));
  const top = Math.max(0, Math.floor(rect.y - (image.offsetY ?? 0)));
  const right = Math.min(image.width, Math.ceil(rect.x + rect.width - (image.offsetX ?? 0)));
  const bottom = Math.min(image.height, Math.ceil(rect.y + rect.height - (image.offsetY ?? 0)));
  if (right <= left || bottom <= top) return { mean: 147, std: 0 };
  let sum = 0;
  let sumSquares = 0;
  let count = 0;
  for (let y = top; y < bottom; y += 2) {
    for (let x = left; x < right; x += 2) {
      const value = image.data[y * image.width + x];
      sum += value;
      sumSquares += value * value;
      count += 1;
    }
  }
  const mean = sum / count;
  return { mean, std: Math.sqrt(Math.max(0, sumSquares / count - mean * mean)) };
}

export function generateLabelCandidates(targetRect, labelSize, canvas, options = {}) {
  const settings = { ...PLACEMENT, ...options };
  const target = center(targetRect);
  const candidates = [];
  for (let ring = settings.minArrow; ring <= settings.maxArrow; ring += 15) {
    for (let step = 0; step < 16; step += 1) {
      const angle = step * Math.PI / 8;
      const reachX = targetRect.width / 2 + labelSize.width / 2 + ring;
      const reachY = targetRect.height / 2 + labelSize.height / 2 + ring;
      const candidate = {
        x: target.x + Math.cos(angle) * reachX - labelSize.width / 2,
        y: target.y + Math.sin(angle) * reachY - labelSize.height / 2,
        width: labelSize.width,
        height: labelSize.height,
      };
      if (rectWithin(candidate, canvas.width, canvas.height)) candidates.push(candidate);
    }
  }
  return candidates;
}

function crossingCount(segment, placed) {
  return placed.reduce((count, item) => count + (segmentsIntersect(
    segment.start,
    segment.end,
    item.connectorGeometry.start,
    item.connectorGeometry.end,
  ) ? 1 : 0), 0);
}

export function scoreCandidate(candidate, targetRect, image, placed = [], avoid = [], options = {}) {
  const settings = { ...PLACEMENT, ...options };
  if (rectsOverlap(candidate, inflateRect(targetRect, settings.breath))) return -Infinity;
  if (avoid.some((rect) => rectsOverlap(candidate, inflateRect(rect, settings.breath)))) return -Infinity;
  const target = center(targetRect);
  const start = rectangleEdgeToward(candidate, target.x, target.y, "callout label");
  const segment = { start, end: target };
  const stats = regionBrightness(image, candidate);
  let score = Math.abs(stats.mean - 147) - stats.std * 0.3 - distance(start, target) * 0.02;
  for (const item of placed) {
    if (rectsOverlap(inflateRect(candidate, settings.proximityMargin), item.labelRect)) {
      score -= settings.proximityPenalty;
    }
  }
  score -= crossingCount(segment, placed) * settings.crossingPenalty;
  return score;
}

export function placeCallouts(callouts, image, canvas, options = {}) {
  const placed = [];
  for (const callout of callouts) {
    const targetRect = callout.targetRect;
    const target = center(targetRect);
    let labelRect;
    if (callout.placement === "manual") {
      labelRect = { x: callout.labelX, y: callout.labelY, ...callout.labelSize };
      if (!rectWithin(labelRect, canvas.width, canvas.height)) {
        throw new UsageError(`${callout.id} manual label is outside the canvas.`);
      }
    } else {
      const candidates = generateLabelCandidates(targetRect, callout.labelSize, canvas, options);
      let bestScore = -Infinity;
      for (const candidate of candidates) {
        const score = scoreCandidate(candidate, targetRect, image, placed, callout.avoid, options);
        if (score > bestScore) {
          bestScore = score;
          labelRect = candidate;
        }
      }
      if (!labelRect) throw new UsageError(`${callout.id} has no collision-free automatic label position; add a gutter or set manual placement.`);
    }
    const connectorGeometry = {
      start: rectangleEdgeToward(labelRect, target.x, target.y, `${callout.id} label`),
      end: target,
    };
    placed.push({ ...callout, labelRect, connectorGeometry });
  }
  return placed;
}
