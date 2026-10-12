/**
 * Small, dependency-free SVG charts used by the calibration / model-lab screens.
 * Pure server-safe components (no hooks). The shared chart kit (components/charts/*)
 * is built in parallel; these are deliberately local so the screens never depend
 * on a component that may not exist yet. Colours only ever come from the design
 * tokens; red is never used for values.
 */
import { extent, formatTick, makeScale, niceTicks, MONO_TEXT_STYLE, TONE_COLOR, type ChartTone } from "@/components/charts/scale";

export interface MiniHistogramProps {
  values: readonly number[];
  bins?: number;
  width?: number;
  height?: number;
  tone?: ChartTone;
  /** Fixed domain (e.g. 0–255 for colour channels). */
  domain?: { min: number; max: number };
  title?: string;
  unit?: string;
}

export function binValues(values: readonly number[], bins: number, domain: { min: number; max: number }): { x0: number; x1: number; n: number }[] {
  const span = domain.max - domain.min || 1;
  const out = Array.from({ length: bins }, (_, i) => ({ x0: domain.min + (span * i) / bins, x1: domain.min + (span * (i + 1)) / bins, n: 0 }));
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    let i = Math.floor(((v - domain.min) / span) * bins);
    if (i >= bins) i = bins - 1;
    if (i < 0) i = 0;
    out[i].n++;
  }
  return out;
}

export function MiniHistogram({ values, bins = 16, width = 220, height = 90, tone = "signal", domain, title, unit }: MiniHistogramProps) {
  const finite = values.filter((v) => Number.isFinite(v));
  const pad = { l: 6, r: 6, t: 14, b: 16 };
  const d = domain ?? niceTicks(extent(finite)).domain;
  const buckets = binValues(finite, bins, d);
  const maxN = Math.max(1, ...buckets.map((b) => b.n));
  const x = makeScale(d, [pad.l, width - pad.r]);
  const y = makeScale({ min: 0, max: maxN }, [height - pad.b, pad.t]);
  const color = TONE_COLOR[tone];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title ? `${title} histogram` : "histogram"} className="block">
      {title ? (
        <text x={pad.l} y={10} style={MONO_TEXT_STYLE}>
          {title}
          {unit ? ` · ${unit}` : ""}
          {` · n=${finite.length}`}
        </text>
      ) : null}
      <line x1={pad.l} x2={width - pad.r} y1={height - pad.b} y2={height - pad.b} stroke="var(--color-line-strong)" />
      {finite.length === 0 ? (
        <text x={width / 2} y={height / 2 + 4} textAnchor="middle" style={MONO_TEXT_STYLE}>
          no values
        </text>
      ) : (
        buckets.map((b, i) => {
          const x0 = x(b.x0);
          const x1 = x(b.x1);
          const top = y(b.n);
          return <rect key={i} x={x0 + 0.5} y={top} width={Math.max(1, x1 - x0 - 1)} height={height - pad.b - top} fill={color} opacity={b.n === 0 ? 0 : 0.85} />;
        })
      )}
      <text x={pad.l} y={height - 4} style={MONO_TEXT_STYLE}>
        {formatTick(d.min)}
      </text>
      <text x={width - pad.r} y={height - 4} textAnchor="end" style={MONO_TEXT_STYLE}>
        {formatTick(d.max)}
      </text>
    </svg>
  );
}

export interface ScatterSeries {
  label: string;
  tone: ChartTone;
  points: readonly { x: number; y: number; label?: string }[];
}

export interface MiniScatterProps {
  series: ScatterSeries[];
  width?: number;
  height?: number;
  xLabel?: string;
  yLabel?: string;
  /** Draw the y = x identity line (predicted vs reference). */
  identity?: boolean;
  /** Draw a horizontal y = 0 line (residual plots). */
  zeroLine?: boolean;
  /** Draw a least-squares fitted line through all points. */
  fitted?: boolean;
  title?: string;
}

export function leastSquares(points: readonly { x: number; y: number }[]): { slope: number; intercept: number } | null {
  const n = points.length;
  if (n < 2) return null;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
    sxx += p.x * p.x;
    sxy += p.x * p.y;
  }
  const den = n * sxx - sx * sx;
  if (den === 0) return null;
  const slope = (n * sxy - sx * sy) / den;
  return { slope, intercept: (sy - slope * sx) / n };
}

export function MiniScatter({ series, width = 420, height = 260, xLabel, yLabel, identity, zeroLine, fitted, title }: MiniScatterProps) {
  const pad = { l: 44, r: 12, t: 18, b: 30 };
  const all = series.flatMap((s) => s.points).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  let xd = niceTicks(extent(all.map((p) => p.x)));
  let yd = niceTicks(extent(all.map((p) => p.y)));
  if (identity) {
    const min = Math.min(xd.domain.min, yd.domain.min);
    const max = Math.max(xd.domain.max, yd.domain.max);
    xd = niceTicks({ min, max });
    yd = xd;
  }
  if (zeroLine) yd = niceTicks({ min: Math.min(0, yd.domain.min), max: Math.max(0, yd.domain.max) });
  const x = makeScale(xd.domain, [pad.l, width - pad.r]);
  const y = makeScale(yd.domain, [height - pad.b, pad.t]);
  const fit = fitted ? leastSquares(all) : null;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title ?? "scatter plot"} className="block max-w-full">
      {title ? (
        <text x={pad.l} y={11} style={MONO_TEXT_STYLE}>
          {title}
        </text>
      ) : null}
      {yd.ticks.map((t) => (
        <g key={`y${t}`}>
          <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
          <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" style={MONO_TEXT_STYLE}>
            {formatTick(t)}
          </text>
        </g>
      ))}
      {xd.ticks.map((t) => (
        <text key={`x${t}`} x={x(t)} y={height - pad.b + 14} textAnchor="middle" style={MONO_TEXT_STYLE}>
          {formatTick(t)}
        </text>
      ))}
      <line x1={pad.l} x2={pad.l} y1={pad.t} y2={height - pad.b} stroke="var(--color-line-strong)" />
      <line x1={pad.l} x2={width - pad.r} y1={height - pad.b} y2={height - pad.b} stroke="var(--color-line-strong)" />
      {identity ? <line x1={x(xd.domain.min)} y1={y(xd.domain.min)} x2={x(xd.domain.max)} y2={y(xd.domain.max)} stroke="var(--color-fg-3)" strokeDasharray="4 4" /> : null}
      {zeroLine ? <line x1={pad.l} x2={width - pad.r} y1={y(0)} y2={y(0)} stroke="var(--color-fg-3)" strokeDasharray="4 4" /> : null}
      {fit ? (
        <line
          x1={x(xd.domain.min)}
          y1={y(fit.intercept + fit.slope * xd.domain.min)}
          x2={x(xd.domain.max)}
          y2={y(fit.intercept + fit.slope * xd.domain.max)}
          stroke="var(--color-notice)"
          strokeWidth={1}
        />
      ) : null}
      {all.length === 0 ? (
        <text x={(pad.l + width - pad.r) / 2} y={height / 2} textAnchor="middle" style={MONO_TEXT_STYLE}>
          no points
        </text>
      ) : null}
      {series.map((s) =>
        s.points
          .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
          .map((p, i) => (
            <circle key={`${s.label}-${i}`} cx={x(p.x)} cy={y(p.y)} r={2.6} fill={TONE_COLOR[s.tone]} opacity={0.8}>
              <title>{`${s.label}${p.label ? ` ${p.label}` : ""}: ${p.x}, ${p.y}`}</title>
            </circle>
          )),
      )}
      {xLabel ? (
        <text x={width - pad.r} y={height - 4} textAnchor="end" style={MONO_TEXT_STYLE}>
          {xLabel}
        </text>
      ) : null}
      {yLabel ? (
        <text x={pad.l} y={pad.t - 6} style={MONO_TEXT_STYLE}>
          {yLabel}
        </text>
      ) : null}
      {series.length > 1 ? (
        <g>
          {series.map((s, i) => (
            <g key={s.label} transform={`translate(${width - pad.r - 90 - i * 0}, ${pad.t + 10 + i * 12})`}>
              <circle r={3} fill={TONE_COLOR[s.tone]} />
              <text x={8} y={3} style={MONO_TEXT_STYLE}>
                {s.label}
              </text>
            </g>
          ))}
        </g>
      ) : null}
    </svg>
  );
}
