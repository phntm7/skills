import sharp from "sharp";
import { UsageError } from "./errors.mjs";

export function thresholdDifference(before, after, threshold = 24) {
  if (before.length !== after.length || before.length % 4 !== 0) {
    throw new UsageError("Diff inputs must be equally sized RGBA buffers.");
  }
  const pixels = before.length / 4;
  const mask = new Uint8Array(pixels);
  const intensity = new Uint8Array(pixels);
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    const offset = pixel * 4;
    const maximum = Math.max(
      Math.abs(before[offset] - after[offset]),
      Math.abs(before[offset + 1] - after[offset + 1]),
      Math.abs(before[offset + 2] - after[offset + 2]),
      Math.abs(before[offset + 3] - after[offset + 3]),
    );
    intensity[pixel] = maximum;
    if (maximum >= threshold) mask[pixel] = 1;
  }
  return { mask, intensity };
}

export function dilateMask(mask, width, height, radius = 2) {
  if (radius === 0) return mask.slice();
  const horizontal = new Uint8Array(mask.length);
  const output = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    let active = 0;
    for (let x = -radius; x < width + radius; x += 1) {
      const entering = x + radius;
      const leaving = x - radius - 1;
      if (entering < width) active += mask[y * width + entering];
      if (leaving >= 0) active -= mask[y * width + leaving];
      if (x >= 0 && x < width && active > 0) horizontal[y * width + x] = 1;
    }
  }
  for (let x = 0; x < width; x += 1) {
    let active = 0;
    for (let y = -radius; y < height + radius; y += 1) {
      const entering = y + radius;
      const leaving = y - radius - 1;
      if (entering < height) active += horizontal[entering * width + x];
      if (leaving >= 0) active -= horizontal[leaving * width + x];
      if (y >= 0 && y < height && active > 0) output[y * width + x] = 1;
    }
  }
  return output;
}

export function connectedComponents(mask, width, height, minArea = 9) {
  const visited = new Uint8Array(mask.length);
  const components = [];
  const queue = new Int32Array(mask.length);
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let area = 0;
    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      area += 1;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const neighbor = ny * width + nx;
          if (mask[neighbor] && !visited[neighbor]) {
            visited[neighbor] = 1;
            queue[tail++] = neighbor;
          }
        }
      }
    }
    if (area >= minArea) components.push({ bbox: [minX, minY, maxX + 1, maxY + 1], area });
  }
  return components.sort((left, right) => right.area - left.area || left.bbox[1] - right.bbox[1] || left.bbox[0] - right.bbox[0]);
}

export function renderHeatmap(intensity, width, height) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let pixel = 0; pixel < intensity.length; pixel += 1) {
    const value = intensity[pixel];
    const offset = pixel * 4;
    rgba[offset] = value;
    rgba[offset + 1] = Math.max(0, value - 96);
    rgba[offset + 2] = 0;
    rgba[offset + 3] = 255;
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } }).png().toBuffer();
}

export async function diffImages({
  before,
  after,
  threshold = 24,
  dilation = 2,
  minArea = 9,
  decodedPixels = 40_000_000,
  rawMaxDimension = 4096,
}) {
  const [leftMetadata, rightMetadata] = await Promise.all([
    sharp(before, { limitInputPixels: decodedPixels }).metadata(),
    sharp(after, { limitInputPixels: decodedPixels }).metadata(),
  ]);
  const leftSource = leftMetadata.autoOrient;
  const rightSource = rightMetadata.autoOrient;
  if (leftSource.width !== rightSource.width || leftSource.height !== rightSource.height) {
    throw new UsageError(`Diff image dimensions differ: ${leftSource.width}x${leftSource.height} vs ${rightSource.width}x${rightSource.height}.`);
  }
  const processingScale = Math.min(1, rawMaxDimension / leftSource.width, rawMaxDimension / leftSource.height);
  const processedWidth = Math.max(1, Math.round(leftSource.width * processingScale));
  const processedHeight = Math.max(1, Math.round(leftSource.height * processingScale));
  const decode = (input) => sharp(input, { limitInputPixels: decodedPixels })
    .rotate()
    .resize(processedWidth, processedHeight, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const [left, right] = await Promise.all([decode(before), decode(after)]);
  const { mask, intensity } = thresholdDifference(left.data, right.data, threshold);
  const processedDilation = dilation === 0 ? 0 : Math.max(1, Math.round(dilation * processingScale));
  const dilated = dilateMask(mask, processedWidth, processedHeight, processedDilation);
  const processedArea = Math.max(1, Math.round(minArea * processingScale * processingScale));
  const components = connectedComponents(dilated, processedWidth, processedHeight, processedArea);
  const inverseScale = 1 / processingScale;
  const boxes = components.map((component) => ({
    bbox: [
      Math.floor(component.bbox[0] * inverseScale),
      Math.floor(component.bbox[1] * inverseScale),
      Math.min(leftSource.width, Math.ceil(component.bbox[2] * inverseScale)),
      Math.min(leftSource.height, Math.ceil(component.bbox[3] * inverseScale)),
    ],
    area: Math.round(component.area * inverseScale * inverseScale),
  }));
  const processedHeatmap = await renderHeatmap(intensity, processedWidth, processedHeight);
  const heatmap = processingScale === 1
    ? processedHeatmap
    : await sharp(processedHeatmap).resize(leftSource.width, leftSource.height, { fit: "fill", kernel: "nearest" }).png().toBuffer();
  return {
    width: leftSource.width,
    height: leftSource.height,
    processingScale,
    threshold,
    dilation,
    boxes,
    heatmap,
  };
}

export function diffCallouts(boxes) {
  return boxes.map((component, index) => ({
    type: "callout",
    id: `change-${index + 1}`,
    bbox: component.bbox,
    label: `Change #${index + 1}`,
    number: index + 1,
    style: "neutral",
    placement: "auto",
    mark: "rounded-box",
    connector: "leader",
    padding: 10,
  }));
}
