import Ajv from "ajv";
import { DEFAULTS, LIMITS } from "./constants.mjs";
import { UsageError } from "./errors.mjs";

const number = { type: "number" };
const positive = { type: "number", exclusiveMinimum: 0 };
const nonNegative = { type: "number", minimum: 0 };
const color = { type: "string", minLength: 1, maxLength: 100, pattern: "^(?:#[0-9a-fA-F]{3,8}|(?:rgb|hsl)a?\\([0-9.,%+\\-\\s]+\\)|[a-zA-Z]+|none)$" };
const bbox = { type: "array", items: number, minItems: 4, maxItems: 4 };
const point = { type: "array", items: number, minItems: 2, maxItems: 2 };
const gutter = {
  anyOf: [nonNegative, {
    type: "object",
    additionalProperties: false,
    properties: { top: nonNegative, right: nonNegative, bottom: nonNegative, left: nonNegative },
  }],
};

const annotationProperties = {
  id: { type: "string", minLength: 1, maxLength: 100 },
  type: { enum: [
    "box", "ellipse", "line", "arrow", "text", "badge", "highlight", "blur", "redact",
    "callout", "pixelate", "spotlight", "zoom", "freehand", "underline", "bracket", "circle",
    "notation-highlight", "strike-through", "crossed-off",
  ] },
  x: number, y: number, width: positive, height: positive,
  x1: number, y1: number, x2: number, y2: number,
  labelX: number, labelY: number,
  bbox, inset: bbox,
  avoid: { type: "array", items: bbox, maxItems: 100 },
  points: { type: "array", items: point, minItems: 2, maxItems: 10_000 },
  text: { type: "string", minLength: 1, maxLength: LIMITS.labelLength },
  label: { type: "string", minLength: 1, maxLength: LIMITS.labelLength },
  color, labelColor: color, background: color, fill: color, textColor: color, borderColor: color, maskColor: color,
  opacity: { type: "number", minimum: 0, maximum: 1 },
  strokeWidth: { type: "number", minimum: 0.5, maximum: 100 },
  fontSize: { type: "number", minimum: 6, maximum: 1000 },
  fontFamily: { type: "string", minLength: 1, maxLength: 100 },
  fontWeight: { type: "string", pattern: "^(?:[1-9]00|normal|bold)$" },
  padding: { type: "number", minimum: 0, maximum: 500 },
  radius: { type: "number", minimum: 0, maximum: 1000 },
  maxWidth: { type: "number", exclusiveMinimum: 0 },
  headSize: { type: "number", minimum: 3, maximum: 500 },
  sigma: { type: "number", minimum: 0.3, maximum: 1000 },
  blockSize: { type: "integer", minimum: 2, maximum: 200 },
  scale: { type: "number", minimum: 1, maximum: 10 },
  seed: { type: "integer", minimum: 0, maximum: 2_147_483_647 },
  roughness: { type: "number", minimum: 0, maximum: 10 },
  bowing: { type: "number", minimum: 0, maximum: 10 },
  thinning: { type: "number", minimum: -1, maximum: 1 },
  smoothing: { type: "number", minimum: 0, maximum: 1 },
  streamline: { type: "number", minimum: 0, maximum: 1 },
  taperStart: { type: "number", minimum: 0 },
  taperEnd: { type: "number", minimum: 0 },
  placement: { enum: ["auto", "manual"] },
  mark: { enum: ["rounded-box", "ellipse", "highlight", "none"] },
  connector: { enum: ["straight", "leader", "curved", "elbow", "bracket", "none"] },
  style: { enum: ["neutral", "bad", "good", "warning", "clean", "sketchy"] },
  number: { anyOf: [{ type: "integer", minimum: 1 }, { type: "string", minLength: 1, maxLength: 12 }] },
  side: { enum: ["top", "right", "bottom", "left", "both"] },
  amplitude: { type: "number", minimum: 0, maximum: 100 },
};

const annotationSchema = {
  type: "object",
  additionalProperties: false,
  required: ["type"],
  properties: annotationProperties,
  allOf: [
    { if: { properties: { type: { enum: ["box", "ellipse", "highlight", "blur", "redact", "pixelate", "spotlight"] } } }, then: { required: ["x", "y", "width", "height"] } },
    { if: { properties: { type: { const: "line" } } }, then: { required: ["x1", "y1", "x2", "y2"] } },
    { if: { properties: { type: { const: "arrow" } } }, then: { required: ["x2", "y2"], anyOf: [{ required: ["x1", "y1"] }, { required: ["label", "labelX", "labelY"] }] } },
    { if: { properties: { type: { const: "text" } } }, then: { required: ["x", "y", "text"] } },
    { if: { properties: { type: { const: "badge" } } }, then: { required: ["x", "y", "text"] } },
    { if: { properties: { type: { const: "callout" } } }, then: { required: ["bbox", "label"] } },
    { if: { properties: { type: { const: "zoom" } } }, then: { required: ["bbox", "inset"] } },
    { if: { properties: { type: { const: "freehand" } } }, then: { required: ["points"] } },
    { if: { properties: { type: { enum: ["underline", "bracket", "circle", "notation-highlight", "strike-through", "crossed-off"] } } }, then: { required: ["bbox"] } },
    { if: { properties: { type: { const: "arrow" } }, required: ["label"] }, then: { required: ["labelX", "labelY"] } },
    { if: { properties: { type: { const: "callout" }, placement: { const: "manual" } }, required: ["placement"] }, then: { required: ["labelX", "labelY"] } },
  ],
};

const schema = {
  $id: "https://phntm.local/image-annotator.schema.json",
  type: "object",
  additionalProperties: false,
  required: ["annotations"],
  properties: {
    version: { const: 1 },
    stateHash: { type: "string", pattern: "^[0-9a-f]{64}$" },
    resolved: {
      type: "object",
      additionalProperties: false,
      required: ["source", "canvas", "scale"],
      properties: {
        source: {
          type: "object", additionalProperties: false, required: ["width", "height"],
          properties: { width: positive, height: positive },
        },
        canvas: {
          type: "object", additionalProperties: false, required: ["width", "height"],
          properties: { width: positive, height: positive },
        },
        scale: {
          type: "object", additionalProperties: false, required: ["x", "y"],
          properties: { x: positive, y: positive },
        },
      },
    },
    coordinateSpace: {
      type: "object", additionalProperties: false, required: ["width", "height"],
      properties: { width: positive, height: positive },
    },
    defaults: {
      type: "object", additionalProperties: false,
      properties: {
        color, negativeColor: color,
        strokeWidth: { type: "number", minimum: 0.5, maximum: 100 },
        fontSize: { type: "number", minimum: 6, maximum: 1000 },
        fontFamily: { type: "string", minLength: 1, maxLength: 100 },
        style: { enum: ["clean", "sketchy"] },
        seed: { type: "integer", minimum: 0, maximum: 2_147_483_647 },
      },
    },
    output: {
      type: "object", additionalProperties: false,
      properties: {
        quality: { type: "integer", minimum: 1, maximum: 100 },
        compressionLevel: { type: "integer", minimum: 0, maximum: 9 },
      },
    },
    canvas: {
      type: "object", additionalProperties: false,
      properties: { gutter, background: color },
    },
    legend: {
      type: "object", additionalProperties: false, required: ["items"],
      properties: {
        position: { enum: ["right", "left", "top", "bottom"] },
        width: { type: "number", minimum: 160, maximum: 2000 },
        title: { type: "string", maxLength: LIMITS.labelLength },
        background: color,
        items: {
          type: "array", minItems: 1, maxItems: 100,
          items: {
            type: "object", additionalProperties: false, required: ["number", "label"],
            properties: {
              number: { anyOf: [{ type: "integer", minimum: 1 }, { type: "string", minLength: 1, maxLength: 12 }] },
              label: { type: "string", minLength: 1, maxLength: LIMITS.labelLength },
              color,
            },
          },
        },
      },
    },
    limits: {
      type: "object", additionalProperties: false,
      properties: {
        encodedBytes: { type: "integer", minimum: 1 },
        decodedPixels: { type: "integer", minimum: 1 },
        labelLength: { type: "integer", minimum: 1, maximum: 10_000 },
        annotations: { type: "integer", minimum: 1, maximum: 10_000 },
        concurrency: { type: "integer", minimum: 1, maximum: 32 },
      },
    },
    annotations: { type: "array", maxItems: LIMITS.annotations, items: annotationSchema },
  },
};

const ajv = new Ajv({ allErrors: true, strict: true, strictRequired: false });
const validate = ajv.compile(schema);
const controlCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;

function formatErrors(errors) {
  return errors.map((error) => `${error.instancePath || "/"} ${error.message}`).join("; ");
}

export function normalizeSpec(value) {
  const normalized = Array.isArray(value)
    ? { version: 1, defaults: {}, output: {}, annotations: value }
    : { version: 1, defaults: {}, output: {}, ...value };
  if (!validate(normalized)) throw new UsageError(`Invalid annotation spec: ${formatErrors(validate.errors)}`);
  const limits = { ...LIMITS, ...normalized.limits };
  if (normalized.annotations.length > limits.annotations) {
    throw new UsageError(`annotations exceeds the configured limit of ${limits.annotations}.`);
  }
  for (const [index, annotation] of normalized.annotations.entries()) {
    for (const key of ["text", "label"]) {
      const valueAtKey = annotation[key];
      if (valueAtKey !== undefined && (valueAtKey.length > limits.labelLength || controlCharacters.test(valueAtKey))) {
        throw new UsageError(`annotations[${index}].${key} exceeds limits or contains control characters.`);
      }
    }
  }
  return {
    ...normalized,
    defaults: { ...DEFAULTS, ...normalized.defaults },
    output: { quality: 90, compressionLevel: 9, ...normalized.output },
    limits,
  };
}

export { schema as annotationSchema };
