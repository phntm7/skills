import { UsageError } from "./errors.mjs";

export function center(rect) {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

export function boxToRect([x1, y1, x2, y2]) {
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

export function rectToBox(rect) {
  return [rect.x, rect.y, rect.x + rect.width, rect.y + rect.height];
}

export function inflateRect(rect, amount) {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
  };
}

export function rectsOverlap(left, right) {
  return left.x < right.x + right.width
    && left.x + left.width > right.x
    && left.y < right.y + right.height
    && left.y + left.height > right.y;
}

export function rectWithin(rect, width, height) {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= width && rect.y + rect.height <= height;
}

export function distance(left, right) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

export function rectangleEdgeToward(rectangle, targetX, targetY, label = "label") {
  const origin = center(rectangle);
  const deltaX = targetX - origin.x;
  const deltaY = targetY - origin.y;
  const targetInside = targetX >= rectangle.x
    && targetX <= rectangle.x + rectangle.width
    && targetY >= rectangle.y
    && targetY <= rectangle.y + rectangle.height;
  if (targetInside) throw new UsageError(`${label} target must be outside its label box.`);
  const horizontalScale = deltaX === 0 ? Infinity : rectangle.width / 2 / Math.abs(deltaX);
  const verticalScale = deltaY === 0 ? Infinity : rectangle.height / 2 / Math.abs(deltaY);
  const scale = Math.min(horizontalScale, verticalScale);
  return { x: origin.x + deltaX * scale, y: origin.y + deltaY * scale };
}

function orientation(a, b, c) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  return Math.abs(value) < 1e-9 ? 0 : value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
  return b.x <= Math.max(a.x, c.x) && b.x >= Math.min(a.x, c.x)
    && b.y <= Math.max(a.y, c.y) && b.y >= Math.min(a.y, c.y);
}

export function segmentsIntersect(a1, a2, b1, b2) {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  if (o1 !== o2 && o3 !== o4) return true;
  return (o1 === 0 && onSegment(a1, b1, a2))
    || (o2 === 0 && onSegment(a1, b2, a2))
    || (o3 === 0 && onSegment(b1, a1, b2))
    || (o4 === 0 && onSegment(b1, a2, b2));
}

export function polylineSegments(points) {
  return points.slice(1).map((point, index) => [points[index], point]);
}

export function connectorPoints(start, end, style = "straight") {
  if (style === "straight" || style === "curved") return [start, end];
  if (style === "elbow") {
    const horizontalFirst = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
    return horizontalFirst
      ? [start, { x: end.x, y: start.y }, end]
      : [start, { x: start.x, y: end.y }, end];
  }
  const vertical = Math.abs(end.y - start.y) > Math.abs(end.x - start.x);
  const offset = 14;
  if (vertical) {
    const direction = Math.sign(end.y - start.y) || 1;
    return [start, { x: start.x, y: start.y + offset * direction }, { x: end.x, y: start.y + offset * direction }, end];
  }
  const direction = Math.sign(end.x - start.x) || 1;
  return [start, { x: start.x + offset * direction, y: start.y }, { x: start.x + offset * direction, y: end.y }, end];
}

export function connectorPath(points, style = "straight") {
  if (style === "curved") {
    const [start, end] = points;
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const control = Math.abs(deltaX) > Math.abs(deltaY)
      ? { x: start.x + deltaX * 0.5, y: start.y - Math.sign(deltaX || 1) * Math.min(60, Math.abs(deltaX) * 0.2) }
      : { x: start.x + Math.sign(deltaY || 1) * Math.min(60, Math.abs(deltaY) * 0.2), y: start.y + deltaY * 0.5 };
    return `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;
  }
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

export function arrowHead(start, end, size) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const spread = Math.PI / 7;
  return [
    end,
    { x: end.x - size * Math.cos(angle - spread), y: end.y - size * Math.sin(angle - spread) },
    { x: end.x - size * Math.cos(angle + spread), y: end.y - size * Math.sin(angle + spread) },
  ];
}

export function polygonPath(points) {
  if (points.length === 0) return "";
  return `M ${points.map(([x, y]) => `${x} ${y}`).join(" L ")} Z`;
}
