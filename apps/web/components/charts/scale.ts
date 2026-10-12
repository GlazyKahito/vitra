/**
 * Shared scale / tick helpers for the SVG chart kit. Pure functions, usable in
 * server components.
 */
export type ChartTone = "signal" | "notice" | "neutral" | "muted" | "fault";

/** Tone → CSS colour. `fault` exists only for image/system fault overlays — never for result values. */
export const TONE_COLOR: Record<ChartTone, string> = {
  signal: "var(--color-signal)",
  notice: "var(--color-notice)",
  neutral: "var(--color-neutral)",
  muted: "var(--color-fg-4)",
  fault: "var(--color-fault)",
};

/** Series colour cycle (never red/green). */
export const SERIES_TONES: ChartTone[] = ["signal", "notice", "neutral", "muted"];

export interface Domain {
  min: number;
  max: number;
}

export function extent(values: readonly number[], fallback: Domain = { min: 0, max: 1 }): Domain {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return fallback;
  let min = Infinity;
  let max = -Infinity;
  for (const v of finite) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (min === max) {
    const pad = min === 0 ? 1 : Math.abs(min) * 0.1;
    return { min: min - pad, max: max + pad };
  }
  return { min, max };
}

/** Expands a domain to "nice" tick boundaries and returns the tick values. */
export function niceTicks(d: Domain, count = 4): { domain: Domain; ticks: number[] } {
  const span = d.max - d.min;
  if (!(span > 0)) return { domain: { min: d.min - 1, max: d.max + 1 }, ticks: [d.min - 1, d.min, d.max + 1] };
  const rawStep = span / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const min = Math.floor(d.min / step) * step;
  const max = Math.ceil(d.max / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(round(v, step));
  return { domain: { min, max }, ticks };
}

function round(v: number, step: number): number {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  return Number(v.toFixed(decimals));
}

export function makeScale(domain: Domain, range: [number, number]): (v: number) => number {
  const span = domain.max - domain.min || 1;
  return (v: number) => range[0] + ((v - domain.min) / span) * (range[1] - range[0]);
}

export function formatTick(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(Math.abs(v) < 1 ? 2 : 1);
}

export const MONO_TEXT_STYLE = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fill: "var(--color-fg-3)",
  fontVariantNumeric: "tabular-nums",
} as const;
