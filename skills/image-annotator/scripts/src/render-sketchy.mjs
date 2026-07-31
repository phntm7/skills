import rough from "roughjs";
import { getStroke } from "perfect-freehand";
import { polygonPath } from "./geometry.mjs";

const generator = rough.generator();

function svgPath(path) {
  const fill = path.fill && path.fill !== "none" ? ` fill="${path.fill}"` : ' fill="none"';
  const stroke = path.stroke && path.stroke !== "none" ? ` stroke="${path.stroke}"` : ' stroke="none"';
  return `<path d="${path.d}"${fill}${stroke} stroke-width="${path.strokeWidth ?? 1}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function options(style, seed) {
  return {
    seed,
    stroke: style.color,
    strokeWidth: style.strokeWidth,
    ...(style.fill && style.fill !== "none" ? {
      fill: style.fill,
      fillStyle: style.fillStyle ?? "hachure",
    } : {}),
    roughness: style.roughness ?? 1.2,
    bowing: style.bowing ?? 1,
  };
}

export function roughRectangle(rect, style, seed) {
  return generator.toPaths(generator.rectangle(rect.x, rect.y, rect.width, rect.height, options(style, seed))).map(svgPath).join("");
}

export function roughEllipse(rect, style, seed) {
  return generator.toPaths(generator.ellipse(
    rect.x + rect.width / 2,
    rect.y + rect.height / 2,
    rect.width,
    rect.height,
    options(style, seed),
  )).map(svgPath).join("");
}

export function roughLine(start, end, style, seed) {
  return generator.toPaths(generator.line(start.x, start.y, end.x, end.y, options(style, seed))).map(svgPath).join("");
}

export function roughPath(path, style, seed) {
  return generator.toPaths(generator.path(path, options(style, seed))).map(svgPath).join("");
}

export function roughPolygon(points, style, seed) {
  const tuples = points.map((point) => [point.x, point.y]);
  return generator.toPaths(generator.polygon(tuples, options(style, seed))).map(svgPath).join("");
}

export function freehandPath(points, annotation, defaults) {
  const stroke = getStroke(points, {
    size: annotation.strokeWidth ?? defaults.strokeWidth,
    thinning: annotation.thinning ?? 0.45,
    smoothing: annotation.smoothing ?? 0.55,
    streamline: annotation.streamline ?? 0.45,
    simulatePressure: true,
    start: { taper: annotation.taperStart ?? 0, cap: true },
    end: { taper: annotation.headSize ? 0 : (annotation.taperEnd ?? 0), cap: true },
  });
  return `<path d="${polygonPath(stroke)}" fill="${annotation.color ?? defaults.color}" opacity="${annotation.opacity ?? 1}"/>`;
}
