import {
  arrowHead,
  boxToRect,
  connectorPath,
  connectorPoints,
  inflateRect,
  rectangleEdgeToward,
} from "./geometry.mjs";
import { renderTextLayout } from "./text.mjs";
import {
  freehandPath,
  roughEllipse,
  roughLine,
  roughPath,
  roughPolygon,
  roughRectangle,
} from "./render-sketchy.mjs";
import { UsageError } from "./errors.mjs";

const xml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

const semanticColors = {
  neutral: "#FF9F1C",
  bad: "#E63946",
  good: "#2A9D8F",
  warning: "#F4A261",
};

function annotationColor(annotation, defaults) {
  return annotation.color ?? semanticColors[annotation.style] ?? defaults.color;
}

function styleFor(annotation, defaults, fill = "none") {
  return {
    color: annotationColor(annotation, defaults),
    fill,
    strokeWidth: annotation.strokeWidth ?? defaults.strokeWidth,
    roughness: annotation.roughness,
    bowing: annotation.bowing,
  };
}

function rectSvg(rect, style, radius = 8, opacity = 1) {
  return `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="${radius}" fill="${xml(style.fill)}" stroke="${xml(style.color)}" stroke-width="${style.strokeWidth}" opacity="${opacity}"/>`;
}

function ellipseSvg(rect, style, opacity = 1) {
  return `<ellipse cx="${rect.x + rect.width / 2}" cy="${rect.y + rect.height / 2}" rx="${rect.width / 2}" ry="${rect.height / 2}" fill="${xml(style.fill)}" stroke="${xml(style.color)}" stroke-width="${style.strokeWidth}" opacity="${opacity}"/>`;
}

function connectorSvg(start, end, annotation, defaults, index, arrow = false) {
  const connector = annotation.connector === "leader" ? "straight" : annotation.connector ?? "straight";
  const points = connectorPoints(start, end, connector);
  const path = connectorPath(points, connector);
  const style = styleFor(annotation, defaults);
  const seed = (annotation.seed ?? defaults.seed) + index * 37;
  const sketchy = defaults.style === "sketchy";
  const pieces = [sketchy
    ? roughPath(path, style, seed)
    : `<path d="${path}" fill="none" stroke="${xml(style.color)}" stroke-width="${style.strokeWidth}" stroke-linecap="round" stroke-linejoin="round" opacity="${annotation.opacity ?? 1}"/>`];
  if (arrow) {
    const previous = points.at(-2);
    const head = arrowHead(previous, end, annotation.headSize ?? Math.max(14, style.strokeWidth * 3.5));
    pieces.push(sketchy
      ? roughPolygon(head, { ...style, fill: style.color }, seed + 1)
      : `<polygon points="${head.map((point) => `${point.x},${point.y}`).join(" ")}" fill="${xml(style.color)}" opacity="${annotation.opacity ?? 1}"/>`);
  }
  return pieces.join("");
}

async function textOverlay(sharp, annotation, defaults, x, y, text = annotation.text) {
  const layout = annotation._textLayout ?? await renderTextLayout(sharp, { ...annotation, text }, defaults);
  return { input: layout.buffer, left: Math.round(x), top: Math.round(y), blend: "over", layout };
}

function notationSvg(annotation, defaults, index) {
  const rect = boxToRect(annotation.bbox);
  const color = annotationColor(annotation, defaults);
  const strokeWidth = annotation.strokeWidth ?? defaults.strokeWidth;
  const sketchy = defaults.style === "sketchy";
  const seed = (annotation.seed ?? defaults.seed) + index * 37;
  const style = { color, strokeWidth, fill: "none", roughness: annotation.roughness, bowing: annotation.bowing };
  if (annotation.type === "circle") return sketchy ? roughEllipse(inflateRect(rect, 6), style, seed) : ellipseSvg(inflateRect(rect, 6), style);
  if (annotation.type === "notation-highlight") {
    const fillStyle = { ...style, fill: annotation.fill ?? "#FFEB3B" };
    return sketchy ? roughRectangle(rect, fillStyle, seed) : `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="${annotation.radius ?? 5}" fill="${xml(fillStyle.fill)}" opacity="${annotation.opacity ?? 0.3}"/>`;
  }
  const line = (a, b, lineSeed = seed) => sketchy
    ? roughLine(a, b, style, lineSeed)
    : `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${xml(color)}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`;
  if (annotation.type === "underline") {
    const y = rect.y + rect.height + (annotation.amplitude ?? 4);
    return line({ x: rect.x, y }, { x: rect.x + rect.width, y });
  }
  if (annotation.type === "strike-through") {
    const y = rect.y + rect.height / 2;
    return line({ x: rect.x, y }, { x: rect.x + rect.width, y });
  }
  if (annotation.type === "crossed-off") {
    return line({ x: rect.x, y: rect.y }, { x: rect.x + rect.width, y: rect.y + rect.height })
      + line({ x: rect.x + rect.width, y: rect.y }, { x: rect.x, y: rect.y + rect.height }, seed + 1);
  }
  const side = annotation.side ?? "right";
  const offset = 8;
  if (side === "left" || side === "right") {
    const x = side === "left" ? rect.x - offset : rect.x + rect.width + offset;
    const direction = side === "left" ? 1 : -1;
    return `<path d="M ${x + direction * 10} ${rect.y} L ${x} ${rect.y} L ${x} ${rect.y + rect.height} L ${x + direction * 10} ${rect.y + rect.height}" fill="none" stroke="${xml(color)}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`;
  }
  const y = side === "top" ? rect.y - offset : rect.y + rect.height + offset;
  const direction = side === "top" ? 1 : -1;
  return `<path d="M ${rect.x} ${y + direction * 10} L ${rect.x} ${y} L ${rect.x + rect.width} ${y} L ${rect.x + rect.width} ${y + direction * 10}" fill="none" stroke="${xml(color)}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`;
}

export async function renderAnnotations(sharp, annotations, defaults, canvas) {
  const elements = [];
  const overlays = [];
  for (const [index, annotation] of annotations.entries()) {
    const type = annotation.type;
    if (["blur", "pixelate"].includes(type)) continue;
    const color = annotationColor(annotation, defaults);
    const strokeWidth = annotation.strokeWidth ?? defaults.strokeWidth;
    const seed = (annotation.seed ?? defaults.seed) + index * 37;
    const sketchy = defaults.style === "sketchy";
    if (["box", "highlight", "redact"].includes(type)) {
      const rect = { x: annotation.x, y: annotation.y, width: annotation.width, height: annotation.height };
      const fill = type === "box" ? annotation.fill ?? "none" : annotation.fill ?? (type === "redact" ? "#000000" : "#FFEB3B");
      const style = styleFor(annotation, defaults, fill);
      if (sketchy && type !== "redact") elements.push(roughRectangle(rect, style, seed));
      else if (type === "box") elements.push(rectSvg(rect, style, annotation.radius ?? 8, annotation.opacity ?? 1));
      else elements.push(`<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="${annotation.radius ?? 6}" fill="${xml(fill)}" opacity="${annotation.opacity ?? (type === "redact" ? 1 : 0.32)}"/>`);
      continue;
    }
    if (type === "ellipse") {
      const rect = { x: annotation.x, y: annotation.y, width: annotation.width, height: annotation.height };
      const style = styleFor(annotation, defaults, annotation.fill ?? "none");
      elements.push(sketchy ? roughEllipse(rect, style, seed) : ellipseSvg(rect, style, annotation.opacity ?? 1));
      continue;
    }
    if (type === "line" || type === "arrow") {
      const end = { x: annotation.x2, y: annotation.y2 };
      let start;
      if (annotation.label !== undefined) {
        const overlay = await textOverlay(sharp, {
          ...annotation,
          text: annotation.label,
          color: annotation.labelColor ?? "#ffffff",
        }, defaults, annotation.labelX, annotation.labelY, annotation.label);
        overlays.push(overlay);
        start = rectangleEdgeToward({ x: annotation.labelX, y: annotation.labelY, width: overlay.layout.width, height: overlay.layout.height }, end.x, end.y, `annotations[${index}].label`);
      } else start = { x: annotation.x1, y: annotation.y1 };
      elements.push(connectorSvg(start, end, annotation, defaults, index, type === "arrow"));
      continue;
    }
    if (type === "text") {
      overlays.push(await textOverlay(sharp, annotation, defaults, annotation.x, annotation.y));
      continue;
    }
    if (type === "badge") {
      const radius = annotation.radius ?? Math.max(18, (annotation.fontSize ?? defaults.fontSize) * 0.82);
      elements.push(`<circle cx="${annotation.x}" cy="${annotation.y}" r="${radius}" fill="${xml(annotation.fill ?? color)}" opacity="${annotation.opacity ?? 1}"/>`);
      const overlay = await textOverlay(sharp, {
        text: annotation.text,
        fontSize: annotation.fontSize ?? defaults.fontSize,
        color: annotation.textColor ?? "#ffffff",
        background: "transparent",
        padding: 0,
        radius: 0,
        maxWidth: radius * 1.5,
        style: defaults.style,
      }, defaults, 0, 0, annotation.text);
      overlay.left = Math.round(annotation.x - overlay.layout.width / 2);
      overlay.top = Math.round(annotation.y - overlay.layout.height / 2);
      overlays.push(overlay);
      continue;
    }
    if (type === "callout") {
      const targetRect = annotation.targetRect ?? boxToRect(annotation.bbox);
      const markRect = inflateRect(targetRect, annotation.padding ?? 18);
      const style = styleFor(annotation, defaults, annotation.mark === "highlight" ? (annotation.fill ?? "#FFEB3B") : "none");
      if (annotation.mark !== "none") {
        if (annotation.mark === "ellipse") elements.push(sketchy ? roughEllipse(markRect, style, seed) : ellipseSvg(markRect, style));
        else if (annotation.mark === "highlight") elements.push(sketchy ? roughRectangle(markRect, style, seed) : `<rect x="${markRect.x}" y="${markRect.y}" width="${markRect.width}" height="${markRect.height}" rx="${annotation.radius ?? 10}" fill="${xml(style.fill)}" opacity="${annotation.opacity ?? 0.28}"/>`);
        else elements.push(sketchy ? roughRectangle(markRect, style, seed) : rectSvg(markRect, style, annotation.radius ?? 12));
      }
      if (annotation.connector !== "none") elements.push(connectorSvg(annotation.connectorGeometry.start, annotation.connectorGeometry.end, annotation, defaults, index, true));
      overlays.push({ input: annotation._textLayout.buffer, left: Math.round(annotation.labelRect.x), top: Math.round(annotation.labelRect.y), blend: "over", layout: annotation._textLayout });
      if (annotation.number !== undefined) {
        const radius = Math.max(14, (annotation.fontSize ?? defaults.fontSize) * 0.62);
        const x = annotation.labelRect.x - radius * 0.25;
        const y = annotation.labelRect.y - radius * 0.25;
        elements.push(`<circle cx="${x}" cy="${y}" r="${radius}" fill="${xml(color)}"/>`);
        const badge = await textOverlay(sharp, { text: String(annotation.number), fontSize: radius, color: "#ffffff", background: "transparent", padding: 0, maxWidth: radius * 1.4, style: defaults.style }, defaults, 0, 0, String(annotation.number));
        badge.left = Math.round(x - badge.layout.width / 2);
        badge.top = Math.round(y - badge.layout.height / 2);
        overlays.push(badge);
      }
      continue;
    }
    if (type === "spotlight") {
      const rect = { x: annotation.x, y: annotation.y, width: annotation.width, height: annotation.height };
      const maskId = `spotlight-${index}`;
      elements.push(`<defs><mask id="${maskId}"><rect width="100%" height="100%" fill="white"/><rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="${annotation.radius ?? 12}" fill="black"/></mask></defs><rect width="100%" height="100%" fill="${xml(annotation.maskColor ?? "#000000")}" opacity="${annotation.opacity ?? 0.58}" mask="url(#${maskId})"/>`);
      continue;
    }
    if (type === "zoom") {
      const source = boxToRect(annotation.bbox);
      const inset = boxToRect(annotation.inset);
      const style = styleFor(annotation, defaults);
      elements.push(rectSvg(source, style, annotation.radius ?? 6));
      elements.push(rectSvg(inset, style, annotation.radius ?? 6));
      const start = rectangleEdgeToward(inset, source.x + source.width / 2, source.y + source.height / 2, `annotations[${index}].inset`);
      elements.push(connectorSvg(start, { x: source.x + source.width / 2, y: source.y + source.height / 2 }, annotation, defaults, index));
      continue;
    }
    if (type === "freehand") {
      elements.push(freehandPath(annotation.points, annotation, defaults));
      if (annotation.headSize) {
        const end = { x: annotation.points.at(-1)[0], y: annotation.points.at(-1)[1] };
        const previous = { x: annotation.points.at(-2)[0], y: annotation.points.at(-2)[1] };
        const head = arrowHead(previous, end, annotation.headSize);
        elements.push(`<line x1="${previous.x}" y1="${previous.y}" x2="${end.x}" y2="${end.y}" stroke="${xml(color)}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`);
        elements.push(`<polygon points="${head.map((point) => `${point.x},${point.y}`).join(" ")}" fill="${xml(color)}"/>`);
      }
      continue;
    }
    if (["underline", "bracket", "circle", "notation-highlight", "strike-through", "crossed-off"].includes(type)) {
      elements.push(notationSvg(annotation, defaults, index));
      continue;
    }
    throw new UsageError(`Unsupported annotation type: ${type}`);
  }
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}"><g shape-rendering="geometricPrecision">${elements.join("")}</g></svg>`);
  return { svg, overlays };
}
