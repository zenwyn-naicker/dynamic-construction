export type ProjectTypeId =
  | "Boundary wall"
  | "Deck"
  | "Pool"
  | "Room addition"
  | "Other";

export type Dimension = {
  label: string;
  /** Limits the API accepts. */
  min: number;
  max: number;
  /** A comfortable slider range; typed values may go beyond it. */
  range: [number, number];
  initial: number;
};

export type ProjectType = {
  id: ProjectTypeId;
  label: string;
  question: string;
  /** What the published rate covers, as listed by the business. */
  includes: string[];
  length?: Dimension;
  width?: Dimension;
};

export const OTHER: ProjectTypeId = "Other";
export const MAX_AREA = 1000;
/** Each project type has a single rate; the API still records it per finish. */
export const FINISH = "Standard";

export const PROJECT_TYPES: ProjectType[] = [
  {
    id: "Boundary wall",
    label: "Boundary wall",
    question: "How long and how high is the wall?",
    includes: [
      "foundation",
      "plastering",
      "undercoat paint",
      "materials and labour",
    ],
    length: { label: "Length", min: 1, max: 100, range: [1, 60], initial: 12 },
    width: { label: "Height", min: 0.5, max: 3, range: [0.5, 3], initial: 1.8 },
  },
  {
    id: "Deck",
    label: "Concrete deck",
    question: "How big is the concrete deck?",
    includes: [
      "scaffolding and deck plates",
      "steel reinforcement",
      "200\u00a0mm concrete",
    ],
    length: { label: "Length", min: 1, max: 100, range: [1, 20], initial: 6 },
    width: { label: "Width", min: 0.5, max: 100, range: [1, 15], initial: 4 },
  },
  {
    id: "Pool",
    label: "Gunite pool",
    question: "How big is the gunite pool?",
    includes: ["excavation", "marble plaster", "a pool pump", "labour"],
    length: { label: "Length", min: 1, max: 100, range: [2, 15], initial: 8 },
    width: { label: "Width", min: 0.5, max: 100, range: [1.5, 8], initial: 4 },
  },
  {
    id: "Room addition",
    label: "Room addition",
    question: "How big is the new room?",
    includes: [
      "foundation",
      "walls",
      "ceiling",
      "roofing",
      "standard electrical and plumbing fittings",
      "plastering",
      "undercoat paint",
    ],
    length: { label: "Length", min: 1, max: 100, range: [2, 12], initial: 5 },
    width: { label: "Width", min: 0.5, max: 100, range: [2, 10], initial: 4 },
  },
  {
    id: "Other",
    label: "Something else",
    question: "Tell us about your project.",
    includes: [],
  },
];

const listFormat = new Intl.ListFormat("en-GB");

/** "Includes foundation, plastering and labour." */
export const includesText = (type: ProjectType) =>
  `Includes ${listFormat.format(type.includes)}.`;

export function projectType(id: string | null | undefined) {
  return PROJECT_TYPES.find((type) => type.id === id);
}

export type Size = { length: number; width: number };

export function initialSize(type: ProjectType): Size {
  return { length: type.length!.initial, width: type.width!.initial };
}

/** Mirrors the API's dimension rules so problems show before a request. */
export function sizeError(type: ProjectType, size: Size) {
  for (const [dimension, value] of [
    [type.length!, size.length],
    [type.width!, size.width],
  ] as const) {
    if (
      !Number.isFinite(value) ||
      value < dimension.min ||
      value > dimension.max
    )
      return `${dimension.label} must be between ${decimal(dimension.min)} and ${decimal(dimension.max)} m.`;
  }
  if (size.length * size.width > MAX_AREA)
    return `Online estimates cover up to ${decimal(MAX_AREA)} m². Choose "Something else" for larger work.`;
  return "";
}

const decimalFormat = new Intl.NumberFormat("en-ZA", {
  maximumFractionDigits: 2,
});
const metreFormat = new Intl.NumberFormat("en-ZA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const decimal = (value: number) => decimalFormat.format(value);
export const metres = (value: number) => metreFormat.format(value) + " m";
export const squareMetres = (value: number) => decimal(value) + " m²";

export const area = (size: Size) =>
  Math.round(size.length * size.width * 100) / 100;

export function sizeSummary(type: ProjectType, size: Size) {
  const total = squareMetres(area(size));
  return type.id === "Boundary wall"
    ? `${metres(size.length)} long × ${metres(size.width)} high · ${total}`
    : `${metres(size.length)} × ${metres(size.width)} · ${total}`;
}

/** Accepts "6,5" as well as "6.5", since both are common in South Africa. */
export function parseDecimal(text: string) {
  const normalised = text.trim().replace(/\s/g, "").replace(",", ".");
  return /^\d*\.?\d+$|^\d+\.$/.test(normalised) ? Number(normalised) : NaN;
}
