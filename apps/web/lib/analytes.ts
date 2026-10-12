/**
 * The ten analytes named in KJS-HC-03, with the units and chart scales commonly
 * printed on 10-parameter urine reagent strip colour charts.
 *
 * IMPORTANT: scales are TYPICAL manufacturer chart blocks, included only so the
 * UI can show "supported scale" context. They must be confirmed against the
 * insert of the specific strip product before any use. They are NOT clinical
 * reference intervals — VITRA ships with no reference intervals configured.
 */
export const ANALYTE_KEYS = [
  "glucose",
  "protein",
  "ph",
  "ketones",
  "blood",
  "bilirubin",
  "urobilinogen",
  "nitrite",
  "leucocytes",
  "specific_gravity",
] as const;

export type AnalyteKey = (typeof ANALYTE_KEYS)[number];

export interface AnalyteDef {
  key: AnalyteKey;
  label: string;
  short: string;
  unit: string;
  /** "continuous" analytes can carry a regression output; "qualitative" ones are reported as categories. */
  kind: "continuous" | "qualitative";
  /** Typical chart blocks (unit as above). */
  chartScale: readonly (number | string)[];
  /** Plausible numeric span for plotting / range checks, in `unit`. */
  span: readonly [number, number];
  decimals: number;
  /** Synthetic colour ramp used ONLY for demo graphics and synthetic fixtures (low → high). */
  demoRamp: readonly [string, string, string];
  /** Marked in the KJS-HC-03 governance table as analytes where false negatives are critical. */
  critical: boolean;
}

export const ANALYTES: readonly AnalyteDef[] = [
  { key: "glucose", label: "Glucose", short: "GLU", unit: "mg/dL", kind: "continuous", chartScale: [0, 100, 250, 500, 1000, 2000], span: [0, 2000], decimals: 0, demoRamp: ["#7ec8c0", "#8fae4e", "#7a5a2c"], critical: true },
  { key: "protein", label: "Protein", short: "PRO", unit: "mg/dL", kind: "continuous", chartScale: [0, 15, 30, 100, 300, 2000], span: [0, 2000], decimals: 0, demoRamp: ["#e9e27a", "#b9cf72", "#5f9e8e"], critical: false },
  { key: "ph", label: "pH", short: "pH", unit: "pH", kind: "continuous", chartScale: [5.0, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5], span: [5, 9], decimals: 1, demoRamp: ["#e8823c", "#c8b84a", "#2f6f8f"], critical: false },
  { key: "ketones", label: "Ketones", short: "KET", unit: "mg/dL", kind: "continuous", chartScale: [0, 5, 15, 40, 80, 160], span: [0, 160], decimals: 0, demoRamp: ["#e7c9a8", "#c9798a", "#6b2a4a"], critical: false },
  { key: "blood", label: "Blood", short: "BLD", unit: "Ery/µL", kind: "continuous", chartScale: [0, 10, 25, 80, 200], span: [0, 250], decimals: 0, demoRamp: ["#e7c45a", "#8fae5a", "#2e5a3a"], critical: true },
  { key: "bilirubin", label: "Bilirubin", short: "BIL", unit: "mg/dL", kind: "continuous", chartScale: [0, 1, 2, 4], span: [0, 6], decimals: 1, demoRamp: ["#f1e3c4", "#dcb8a0", "#b5847e"], critical: false },
  { key: "urobilinogen", label: "Urobilinogen", short: "URO", unit: "mg/dL", kind: "continuous", chartScale: [0.2, 1, 2, 4, 8], span: [0, 12], decimals: 1, demoRamp: ["#f3d3b5", "#eaa58e", "#d16a6a"], critical: false },
  { key: "nitrite", label: "Nitrite", short: "NIT", unit: "qualitative", kind: "qualitative", chartScale: ["negative", "positive"], span: [0, 1], decimals: 0, demoRamp: ["#f5efe4", "#f0bfc8", "#d97a96"], critical: false },
  { key: "leucocytes", label: "Leucocytes", short: "LEU", unit: "Leu/µL", kind: "continuous", chartScale: [0, 15, 70, 125, 500], span: [0, 500], decimals: 0, demoRamp: ["#f1ebd6", "#c9b9c9", "#7b5e8e"], critical: false },
  { key: "specific_gravity", label: "Specific gravity", short: "SG", unit: "SG", kind: "continuous", chartScale: [1.0, 1.005, 1.01, 1.015, 1.02, 1.025, 1.03], span: [1.0, 1.035], decimals: 3, demoRamp: ["#2e5f6e", "#5f8a5a", "#b9a04a"], critical: false },
] as const;

export const ANALYTE_BY_KEY: Record<AnalyteKey, AnalyteDef> = Object.fromEntries(
  ANALYTES.map((a) => [a.key, a]),
) as Record<AnalyteKey, AnalyteDef>;

export function isAnalyteKey(v: string): v is AnalyteKey {
  return (ANALYTE_KEYS as readonly string[]).includes(v);
}

/** Default physical pad order (left → right, handle on the left). Configurable per strip product. */
export const DEFAULT_PAD_MAP: AnalyteKey[] = [...ANALYTE_KEYS];

/** Documented workflow default reaction time (KJS-HC-03: colour develops at 60–120 s; device waits 120 s). */
export const DEFAULT_REACTION_SECONDS = 120;

export function formatAnalyteValue(key: AnalyteKey, value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const def = ANALYTE_BY_KEY[key];
  if (def.kind === "qualitative") return value >= 0.5 ? "positive" : "negative";
  return value.toFixed(def.decimals);
}

/** Interpolates a demo ramp colour (synthetic graphics only). t in [0,1]. */
export function demoColor(key: AnalyteKey, t: number): string {
  const [a, b, c] = ANALYTE_BY_KEY[key].demoRamp;
  const clamp = Math.max(0, Math.min(1, t));
  const [from, to, local] = clamp < 0.5 ? [a, b, clamp * 2] : [b, c, (clamp - 0.5) * 2];
  return mixHex(from, to, local);
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function rgbToHex([r, g, b]: readonly number[]): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

export function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(ca.map((v, i) => v + (cb[i] - v) * t));
}
