import { access, readFile, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { createHash } from "node:crypto";
import { extname, resolve } from "node:path";
import sharp from "sharp";
import { DEFAULTS, SUPPORTED_OUTPUTS } from "./constants.mjs";
import { coordinateScale, mapAnnotations, normalizeGutter } from "./coordinates.mjs";
import { boxToRect, center, rectangleEdgeToward } from "./geometry.mjs";
import { placeCallouts } from "./placement.mjs";
import { renderAnnotations } from "./render-clean.mjs";
import { applyRasterEffects, validateRect } from "./raster-effects.mjs";
import { normalizeSpec } from "./specification.mjs";
import { renderTextLayout } from "./text.mjs";
import { UsageError } from "./errors.mjs";

const semanticColors = { neutral: "#FF9F1C", bad: "#E63946", good: "#2A9D8F", warning: "#F4A261" };

async function pathExists(path) {
  try {
    await access(path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function inputSize(input) {
  if (Buffer.isBuffer(input) || input instanceof Uint8Array) return input.byteLength;
  return (await stat(input)).size;
}

function configureOutput(pipeline, extension, options) {
  if (extension === ".png") return pipeline.png({ compressionLevel: options.compressionLevel });
  if (extension === ".jpg" || extension === ".jpeg") return pipeline.jpeg({ quality: options.quality });
  if (extension === ".webp") return pipeline.webp({ quality: options.quality });
  if (extension === ".avif") return pipeline.avif({ quality: options.quality });
  return pipeline.tiff({ quality: options.quality, compression: "lzw" });
}

function countTypes(annotations) {
  const counts = annotations.reduce((result, annotation) => {
    result[annotation.type] = (result[annotation.type] ?? 0) + 1;
    return result;
  }, {});
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function applyLegendGutter(gutter, legend) {
  if (!legend) return gutter;
  const position = legend.position ?? "right";
  const size = legend.width ?? 360;
  return { ...gutter, [position]: Math.max(gutter[position], size) };
}

function legendAnnotations(legend, canvas, gutter, defaults) {
  if (!legend) return [];
  const position = legend.position ?? "right";
  const vertical = position === "left" || position === "right";
  const startX = position === "left" ? 24 : position === "right" ? canvas.width - gutter.right + 24 : 24;
  const startY = position === "top" ? 24 : position === "bottom" ? canvas.height - gutter.bottom + 24 : 24;
  const maxWidth = vertical ? (position === "left" ? gutter.left : gutter.right) - 80 : canvas.width - 80;
  const annotations = [];
  let x = startX;
  let y = startY;
  if (legend.title) {
    annotations.push({ type: "text", x, y, text: legend.title, maxWidth, background: "transparent", color: defaults.color, padding: 0, fontSize: defaults.fontSize + 2 });
    y += defaults.fontSize * 2.2;
  }
  for (const item of legend.items) {
    annotations.push({ type: "badge", x: x + 20, y: y + 20, text: String(item.number), radius: 18, fontSize: 18, fill: item.color ?? defaults.color });
    annotations.push({ type: "text", x: x + 52, y, text: item.label, maxWidth: Math.max(80, maxWidth - 52), background: "transparent", color: "#111111", padding: 0, fontSize: Math.max(16, defaults.fontSize * 0.72) });
    if (vertical) y += defaults.fontSize * 2.2;
    else x += Math.max(180, maxWidth / legend.items.length);
  }
  return annotations;
}

async function resolveCallouts(annotations, defaults, grayscale, canvas) {
  const callouts = [];
  for (const [index, annotation] of annotations.entries()) {
    if (annotation.type !== "callout") continue;
    const color = annotation.color ?? semanticColors[annotation.style] ?? defaults.color;
    const layout = await renderTextLayout(sharp, {
      text: annotation.label,
      maxWidth: annotation.maxWidth ?? 360,
      fontSize: annotation.fontSize ?? defaults.fontSize,
      fontWeight: annotation.fontWeight,
      color: annotation.labelColor ?? "#ffffff",
      background: annotation.background ?? color,
      padding: annotation.labelPadding ?? annotation.padding ?? 18,
      radius: annotation.radius ?? 10,
      style: defaults.style,
    }, defaults);
    const collisionInflation = defaults.style === "sketchy"
      ? (annotation.strokeWidth ?? defaults.strokeWidth) + 2
      : 0;
    callouts.push({
      ...annotation,
      id: annotation.id ?? `annotations[${index}]`,
      targetRect: boxToRect(annotation.bbox),
      labelSize: { width: layout.width + collisionInflation * 2, height: layout.height + collisionInflation * 2 },
      labelX: annotation.labelX === undefined ? undefined : annotation.labelX - collisionInflation,
      labelY: annotation.labelY === undefined ? undefined : annotation.labelY - collisionInflation,
      collisionInflation,
      placement: annotation.placement ?? "auto",
      mark: annotation.mark ?? "rounded-box",
      connector: annotation.connector ?? "leader",
      avoid: (annotation.avoid ?? []).map(boxToRect),
      _textLayout: layout,
      _index: index,
    });
  }
  const placed = placeCallouts(callouts, grayscale, canvas);
  const byIndex = new Map(placed.map((item) => [item._index, item]));
  return annotations.map((annotation, index) => {
    const item = byIndex.get(index);
    if (!item) return annotation;
    const labelRect = {
      x: item.labelRect.x + item.collisionInflation,
      y: item.labelRect.y + item.collisionInflation,
      width: item._textLayout.width,
      height: item._textLayout.height,
    };
    const target = center(item.targetRect);
    return {
      ...annotation,
      id: item.id,
      targetRect: item.targetRect,
      labelRect,
      collisionRect: item.labelRect,
      connectorGeometry: {
        start: rectangleEdgeToward(labelRect, target.x, target.y, `${item.id} label`),
        end: target,
      },
      placement: item.placement,
      mark: item.mark,
      connector: item.connector,
      _textLayout: item._textLayout,
    };
  });
}

function validateMappedAnnotations(annotations, canvas) {
  for (const [index, annotation] of annotations.entries()) {
    if (["box", "ellipse", "highlight", "blur", "redact", "pixelate", "spotlight"].includes(annotation.type)) {
      validateRect(annotation, canvas.width, canvas.height, `annotations[${index}]`);
    }
    if (["callout", "zoom", "underline", "bracket", "circle", "notation-highlight", "strike-through", "crossed-off"].includes(annotation.type)) {
      validateRect(boxToRect(annotation.bbox), canvas.width, canvas.height, `annotations[${index}].bbox`);
    }
    for (const keys of [["x1", "y1"], ["x2", "y2"], ["x", "y"], ["labelX", "labelY"]]) {
      if (annotation[keys[0]] === undefined || annotation[keys[1]] === undefined) continue;
      if (annotation[keys[0]] < 0 || annotation[keys[1]] < 0 || annotation[keys[0]] > canvas.width || annotation[keys[1]] > canvas.height) {
        throw new UsageError(`annotations[${index}] point ${keys.join("/")} is outside the canvas.`);
      }
    }
  }
}

function serializableState(spec, resolved, source, canvas, scale, gutter) {
  const unmapPoint = (x, y) => [(x - gutter.left) / scale.x, (y - gutter.top) / scale.y];
  const annotations = resolved.slice(0, spec.annotations.length).map((annotation) => {
    const clean = Object.fromEntries(Object.entries(annotation).filter(([key]) =>
      !key.startsWith("_") && !["targetRect", "labelRect", "collisionRect", "connectorGeometry"].includes(key)));
    for (const [xKey, yKey] of [["x", "y"], ["x1", "y1"], ["x2", "y2"], ["labelX", "labelY"]]) {
      if (clean[xKey] !== undefined && clean[yKey] !== undefined) {
        [clean[xKey], clean[yKey]] = unmapPoint(clean[xKey], clean[yKey]);
      }
    }
    if (clean.width !== undefined) clean.width /= scale.x;
    if (clean.height !== undefined) clean.height /= scale.y;
    for (const key of ["bbox", "inset"]) {
      if (clean[key]) {
        const [x1, y1] = unmapPoint(clean[key][0], clean[key][1]);
        const [x2, y2] = unmapPoint(clean[key][2], clean[key][3]);
        clean[key] = [x1, y1, x2, y2];
      }
    }
    if (clean.points) clean.points = clean.points.map(([x, y]) => unmapPoint(x, y));
    if (clean.avoid) clean.avoid = clean.avoid.map(([x1, y1, x2, y2]) => [
      ...unmapPoint(x1, y1),
      ...unmapPoint(x2, y2),
    ]);
    if (annotation.type === "callout") {
      clean.placement = "manual";
      [clean.labelX, clean.labelY] = unmapPoint(annotation.labelRect.x, annotation.labelRect.y);
    }
    return clean;
  });
  const state = {
    version: 1,
    coordinateSpace: spec.coordinateSpace ?? { width: source.width, height: source.height },
    defaults: spec.defaults,
    output: spec.output,
    canvas: spec.canvas,
    ...(spec.legend ? { legend: spec.legend } : {}),
    annotations,
  };
  const stateHash = createHash("sha256").update(JSON.stringify(state)).digest("hex");
  return { ...state, stateHash, resolved: { source, canvas, scale } };
}

function debugSvg(resolved, canvas, spacing = 100) {
  const lines = [];
  for (let x = 0; x <= canvas.width; x += spacing) lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${canvas.height}"/>`);
  for (let y = 0; y <= canvas.height; y += spacing) lines.push(`<line x1="0" y1="${y}" x2="${canvas.width}" y2="${y}"/>`);
  for (const annotation of resolved) {
    if (annotation.labelRect) {
      lines.push(`<rect x="${annotation.labelRect.x}" y="${annotation.labelRect.y}" width="${annotation.labelRect.width}" height="${annotation.labelRect.height}" fill="none" stroke="#00FFFF" stroke-width="2"/>`);
      lines.push(`<line x1="${annotation.connectorGeometry.start.x}" y1="${annotation.connectorGeometry.start.y}" x2="${annotation.connectorGeometry.end.x}" y2="${annotation.connectorGeometry.end.y}" stroke="#FF00FF" stroke-width="2"/>`);
    }
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}"><g stroke="#00A6FB" stroke-width="1" opacity="0.35">${lines.join("")}</g></svg>`);
}

export async function annotateImage({ input, output, spec: rawSpec, force = false, dryRun = false, emitPlan, debugLayout }) {
  if (!input) throw new UsageError("input is required.");
  if (!rawSpec) throw new UsageError("spec is required.");
  const spec = normalizeSpec(rawSpec);
  const resolvedInput = typeof input === "string" ? resolve(input) : input;
  const resolvedOutput = output ? resolve(output) : undefined;
  const resolvedEmitPlan = emitPlan ? resolve(emitPlan) : undefined;
  const resolvedDebugLayout = debugLayout ? resolve(debugLayout) : undefined;
  if (typeof resolvedInput === "string" && resolvedOutput && resolvedInput === resolvedOutput) throw new UsageError("Input and output paths must differ.");
  if (typeof resolvedInput === "string" && !(await pathExists(resolvedInput))) throw new UsageError(`Input image not found: ${resolvedInput}`);
  if (await inputSize(resolvedInput) > spec.limits.encodedBytes) throw new UsageError(`Input exceeds the ${spec.limits.encodedBytes}-byte encoded limit.`);
  if (!dryRun && !resolvedOutput) throw new UsageError("output is required unless dryRun is true.");
  let extension;
  if (resolvedOutput) {
    extension = extname(resolvedOutput).toLowerCase();
    if (!SUPPORTED_OUTPUTS.has(extension)) throw new UsageError(`Unsupported output extension "${extension || "(none)"}".`);
    if (!dryRun && !force && await pathExists(resolvedOutput)) throw new UsageError(`Output already exists: ${resolvedOutput}. Pass force to replace it.`);
  }
  const destinations = [resolvedOutput, resolvedEmitPlan, resolvedDebugLayout].filter(Boolean);
  if (new Set(destinations).size !== destinations.length) throw new UsageError("Output, emitPlan, and debugLayout paths must differ.");
  if (typeof resolvedInput === "string" && destinations.includes(resolvedInput)) throw new UsageError("Input and destination paths must differ.");
  for (const destination of [resolvedEmitPlan, resolvedDebugLayout].filter(Boolean)) {
    if (!force && await pathExists(destination)) throw new UsageError(`Sidecar already exists: ${destination}. Pass force to replace it.`);
  }
  if (resolvedDebugLayout) {
    const debugExtension = extname(resolvedDebugLayout).toLowerCase();
    if (!SUPPORTED_OUTPUTS.has(debugExtension)) throw new UsageError(`Unsupported debug layout extension "${debugExtension || "(none)"}".`);
  }
  const metadata = await sharp(resolvedInput, { limitInputPixels: spec.limits.decodedPixels }).metadata();
  if (metadata.format === "gif") throw new UsageError("Animated GIF input is not supported; convert a single frame to PNG first.");
  const oriented = await sharp(resolvedInput, { limitInputPixels: spec.limits.decodedPixels }).rotate().png().toBuffer({ resolveWithObject: true });
  const source = { width: oriented.info.width, height: oriented.info.height };
  if (source.width * source.height > spec.limits.decodedPixels) throw new UsageError(`Decoded image exceeds the ${spec.limits.decodedPixels}-pixel limit.`);
  const scale = coordinateScale(spec.coordinateSpace, source.width, source.height);
  let gutter = normalizeGutter(spec.canvas?.gutter ?? 0);
  gutter = applyLegendGutter(gutter, spec.legend);
  const canvas = { width: source.width + gutter.left + gutter.right, height: source.height + gutter.top + gutter.bottom };
  const background = spec.canvas?.background ?? "#ffffff";
  const expanded = gutter.top + gutter.right + gutter.bottom + gutter.left > 0
    ? await sharp(oriented.data).extend({ ...gutter, background }).png().toBuffer()
    : oriented.data;
  const mapped = mapAnnotations(spec.annotations, scale, { x: gutter.left, y: gutter.top });
  const withLegend = [...mapped, ...legendAnnotations(spec.legend, canvas, gutter, spec.defaults)];
  validateMappedAnnotations(withLegend, canvas);
  const grayscale = await sharp(oriented.data).greyscale().raw().toBuffer();
  const resolved = await resolveCallouts(withLegend, spec.defaults, {
    data: grayscale,
    width: source.width,
    height: source.height,
    offsetX: gutter.left,
    offsetY: gutter.top,
  }, canvas);
  const rasterBase = await applyRasterEffects(sharp, expanded, resolved, canvas, spec.limits.concurrency);
  const rendered = await renderAnnotations(sharp, resolved, spec.defaults, canvas);
  const composites = [
    { input: rendered.svg, left: 0, top: 0, blend: "over" },
    ...rendered.overlays.map(({ layout: _layout, ...overlay }) => overlay),
  ];
  const state = serializableState(spec, resolved, source, canvas, scale, gutter);
  if (!dryRun) {
    await configureOutput(sharp(rasterBase).composite(composites), extension, spec.output).toFile(resolvedOutput);
  }
  if (resolvedEmitPlan) await writeFile(resolvedEmitPlan, `${JSON.stringify(state, null, 2)}\n`);
  if (resolvedDebugLayout) {
    const debugExtension = extname(resolvedDebugLayout).toLowerCase();
    const debug = sharp(rasterBase).composite([
      ...composites,
      { input: debugSvg(resolved, canvas), left: 0, top: 0, blend: "over" },
    ]);
    await configureOutput(debug, debugExtension, spec.output).toFile(resolvedDebugLayout);
  }
  return {
    status: dryRun ? "validated" : "written",
    input: typeof resolvedInput === "string" ? resolvedInput : "<buffer>",
    output: resolvedOutput,
    width: canvas.width,
    height: canvas.height,
    sourceWidth: source.width,
    sourceHeight: source.height,
    coordinateScale: scale,
    annotations: resolved.length,
    types: countTypes(resolved),
    stateHash: state.stateHash,
    plan: state,
  };
}

export async function loadJsonSpec(path) {
  const source = path === "-" ? await readFile(0, "utf8") : await readFile(path, "utf8");
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new UsageError(`Invalid JSON in annotation spec: ${error.message}`);
  }
}

export async function renderGrid({ input, output, spacing = 100, force = false }) {
  if (!Number.isInteger(spacing) || spacing < 10 || spacing > 2000) throw new UsageError("spacing must be an integer from 10 through 2000.");
  if (!force && await pathExists(output)) throw new UsageError(`Output already exists: ${output}. Pass force to replace it.`);
  const oriented = await sharp(input).rotate().png().toBuffer({ resolveWithObject: true });
  const { width, height } = oriented.info;
  const elements = [];
  for (let x = 0; x <= width; x += spacing) elements.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}"/><text x="${x + 4}" y="18">${x}</text>`);
  for (let y = 0; y <= height; y += spacing) elements.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}"/><text x="4" y="${Math.max(18, y - 4)}">${y}</text>`);
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g stroke="#00A6FB" stroke-width="1" opacity="0.7">${elements.join("")}</g></svg>`);
  await sharp(oriented.data).composite([{ input: svg }]).png().toFile(output);
  return { status: "written", input: resolve(input), output: resolve(output), width, height, spacing };
}
