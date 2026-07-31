import { boxToRect } from "./geometry.mjs";
import { UsageError } from "./errors.mjs";

export function validateRect(rect, width, height, label) {
  for (const key of ["x", "y", "width", "height"]) {
    if (!Number.isFinite(rect[key])) throw new UsageError(`${label}.${key} must be finite.`);
  }
  if (rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0
    || rect.x + rect.width > width || rect.y + rect.height > height) {
    throw new UsageError(`${label} rectangle exceeds the ${width}x${height} canvas.`);
  }
  return {
    x: Math.round(rect.x), y: Math.round(rect.y),
    width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)),
  };
}

export async function mapLimit(items, concurrency, operation) {
  const output = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      output[index] = await operation(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return output;
}

async function renderRegion(sharp, base, annotation, canvas, index) {
  const label = `annotations[${index}]`;
  if (annotation.type === "zoom") {
    const source = validateRect(boxToRect(annotation.bbox), canvas.width, canvas.height, `${label}.bbox`);
    const inset = validateRect(boxToRect(annotation.inset), canvas.width, canvas.height, `${label}.inset`);
    const input = await sharp(base)
      .extract({ left: source.x, top: source.y, width: source.width, height: source.height })
      .resize(inset.width, inset.height, { fit: "fill", kernel: "lanczos3" })
      .png()
      .toBuffer();
    return { input, left: inset.x, top: inset.y, blend: "over" };
  }
  const rect = validateRect(annotation, canvas.width, canvas.height, label);
  const region = sharp(base).extract({ left: rect.x, top: rect.y, width: rect.width, height: rect.height });
  let input;
  if (annotation.type === "blur") {
    input = await region.blur(annotation.sigma ?? 14).png().toBuffer();
  } else {
    const blockSize = annotation.blockSize ?? 12;
    const smallWidth = Math.max(1, Math.ceil(rect.width / blockSize));
    const smallHeight = Math.max(1, Math.ceil(rect.height / blockSize));
    const reduced = await region
      .resize(smallWidth, smallHeight, { fit: "fill", kernel: "nearest" })
      .png()
      .toBuffer();
    input = await sharp(reduced)
      .resize(rect.width, rect.height, { fit: "fill", kernel: "nearest" })
      .png()
      .toBuffer();
  }
  return { input, left: rect.x, top: rect.y, blend: "over" };
}

export async function applyRasterEffects(sharp, base, annotations, canvas, concurrency) {
  const effects = annotations
    .map((annotation, index) => ({ annotation, index }))
    .filter(({ annotation }) => ["blur", "pixelate", "zoom"].includes(annotation.type));
  if (effects.length === 0) return base;
  const overlays = await mapLimit(effects, concurrency, ({ annotation, index }) =>
    renderRegion(sharp, base, annotation, canvas, index));
  return sharp(base).composite(overlays).png().toBuffer();
}
