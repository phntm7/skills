import { resolve } from "node:path";

export const SUPPORTED_OUTPUTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".tif", ".tiff"]);

export const CLEAN_FONT_FILE = resolve(import.meta.dirname, "../../assets/fonts/Inter-Variable.ttf");
export const SKETCH_FONT_FILE = resolve(import.meta.dirname, "../../assets/fonts/ArchitectsDaughter-Regular.ttf");
export const FONTCONFIG_FILE = resolve(import.meta.dirname, "../../assets/fonts/fonts.conf");

export const DEFAULTS = Object.freeze({
  color: "#FF9F1C",
  negativeColor: "#E63946",
  strokeWidth: 5,
  fontSize: 28,
  fontFamily: "Inter",
  style: "clean",
  seed: 1,
});

export const LIMITS = Object.freeze({
  encodedBytes: 50 * 1024 * 1024,
  decodedPixels: 40_000_000,
  labelLength: 500,
  annotations: 500,
  concurrency: 4,
});

export const PLACEMENT = Object.freeze({
  minArrow: 25,
  maxArrow: 120,
  breath: 18,
  proximityMargin: 40,
  proximityPenalty: 50,
  crossingPenalty: 50,
  textPad: 6,
});

export const RASTER_TYPES = new Set(["blur", "pixelate", "zoom"]);
export const NOTATION_TYPES = new Set([
  "underline",
  "bracket",
  "circle",
  "notation-highlight",
  "strike-through",
  "crossed-off",
]);
