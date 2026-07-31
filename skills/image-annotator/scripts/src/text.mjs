import { CLEAN_FONT_FILE, FONTCONFIG_FILE, SKETCH_FONT_FILE } from "./constants.mjs";
import { UsageError } from "./errors.mjs";

process.env.FONTCONFIG_FILE ??= FONTCONFIG_FILE;

const measurementCache = new Map();
const renderedCache = new Map();

export function pangoEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function fontSettings(options) {
  const sketchy = options.style === "sketchy";
  return {
    family: sketchy ? "ArchitectsDaughter-Regular" : "Inter",
    file: sketchy ? SKETCH_FONT_FILE : CLEAN_FONT_FILE,
  };
}

function markup(text, options, font) {
  const description = `${font.family} ${options.fontSize}`;
  return `<span font_desc="${pangoEscape(description)}" foreground="${pangoEscape(options.color)}" font_weight="${pangoEscape(options.fontWeight)}">${pangoEscape(text)}</span>`;
}

async function measureLine(sharp, line, options) {
  const font = fontSettings(options);
  const key = JSON.stringify([line, options.fontSize, options.fontWeight, options.color, font.file]);
  if (measurementCache.has(key)) return measurementCache.get(key);
  const rendered = await sharp({
    text: {
      text: markup(line || " ", options, font),
      font: `${font.family} ${options.fontSize}`,
      fontfile: font.file,
      rgba: true,
      dpi: 72,
      wrap: "none",
    },
  }).png().toBuffer({ resolveWithObject: true });
  const result = { width: rendered.info.width, height: rendered.info.height };
  measurementCache.set(key, result);
  return result;
}

async function splitToken(sharp, token, maxWidth, options) {
  const parts = [];
  let part = "";
  for (const character of Array.from(token)) {
    const candidate = `${part}${character}`;
    if (part && (await measureLine(sharp, candidate, options)).width > maxWidth) {
      parts.push(part);
      part = character;
    } else {
      part = candidate;
    }
  }
  if (part) parts.push(part);
  return parts;
}

export async function wrapTextExact(sharp, text, maxWidth, options) {
  const output = [];
  for (const paragraph of text.split("\n")) {
    const rawWords = paragraph.trim().split(/\s+/u).filter(Boolean);
    if (rawWords.length === 0) {
      output.push("");
      continue;
    }
    const words = [];
    for (const word of rawWords) {
      if ((await measureLine(sharp, word, options)).width > maxWidth) {
        words.push(...await splitToken(sharp, word, maxWidth, options));
      } else {
        words.push(word);
      }
    }
    let line = words[0];
    for (const word of words.slice(1)) {
      const candidate = `${line} ${word}`;
      if ((await measureLine(sharp, candidate, options)).width <= maxWidth) line = candidate;
      else {
        output.push(line);
        line = word;
      }
    }
    output.push(line);
  }
  return output;
}

export async function renderTextLayout(sharp, annotation, defaults = {}) {
  const text = annotation.text;
  if (typeof text !== "string" || text.length === 0) throw new UsageError("Label text must be a non-empty string.");
  const options = {
    fontSize: annotation.fontSize ?? defaults.fontSize ?? 28,
    fontWeight: annotation.fontWeight ?? ((annotation.style ?? defaults.style) === "sketchy" ? "normal" : "700"),
    color: annotation.color ?? "#ffffff",
    background: annotation.background ?? defaults.color ?? "#FF9F1C",
    padding: annotation.padding ?? 18,
    radius: annotation.radius ?? 10,
    opacity: annotation.opacity ?? 1,
    maxWidth: annotation.maxWidth ?? 420,
    style: annotation.style ?? defaults.style ?? "clean",
  };
  const key = JSON.stringify([text, options]);
  if (renderedCache.has(key)) return renderedCache.get(key);
  const lines = await wrapTextExact(sharp, text, options.maxWidth, options);
  const measurements = await Promise.all(lines.map((line) => measureLine(sharp, line, options)));
  const textWidth = Math.max(...measurements.map((item) => item.width), 1);
  const lineHeight = Math.max(...measurements.map((item) => item.height), Math.ceil(options.fontSize * 1.2));
  const spacing = Math.ceil(options.fontSize * 0.24);
  const textHeight = lineHeight * lines.length + spacing * Math.max(0, lines.length - 1);
  const font = fontSettings(options);
  const textBuffer = await sharp({
    text: {
      text: markup(lines.join("\n"), options, font),
      font: `${font.family} ${options.fontSize}`,
      fontfile: font.file,
      width: textWidth,
      rgba: true,
      dpi: 72,
      spacing,
      wrap: "none",
    },
  }).png().toBuffer({ resolveWithObject: true });
  const width = textBuffer.info.width + options.padding * 2;
  const height = textBuffer.info.height + options.padding * 2;
  const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${options.radius}" fill="${pangoEscape(options.background)}" opacity="${options.opacity}"/></svg>`);
  const buffer = await sharp(background)
    .composite([{ input: textBuffer.data, left: options.padding, top: options.padding, blend: "over" }])
    .png()
    .toBuffer();
  const result = Object.freeze({ buffer, width, height, textWidth: textBuffer.info.width, textHeight: textBuffer.info.height, lines });
  renderedCache.set(key, result);
  return result;
}

export function clearTextCaches() {
  measurementCache.clear();
  renderedCache.clear();
}
