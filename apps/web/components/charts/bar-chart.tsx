import { ChartEmpty } from "./chart-frame";
import { MONO_TEXT_STYLE, TONE_COLOR, formatTick, makeScale, niceTicks, type ChartTone } from "./scale";

export interface BarDatum {
  label: string;
  value: number;
  /** Optional overlaid sub-value (e.g. invalid runs within the day's total). */
  overlay?: number;
  title?: string;
}

export interface BarChartProps {
  data: BarDatum[];
  width?: number;
  height?: number;
  tone?: ChartTone;
  overlayTone?: ChartTone;
  yFormat?: (v: number) => string;
  /** Show every n-th x label (dense categorical axes). */
  xLabelEvery?: number;
  ariaLabel?: string;
  emptyMessage?: string;
}

const PAD = { top: 10, right: 12, bottom: 24, left: 36 };

/** Categorical bar chart with an optional overlay series drawn inside each bar. */
export function BarChart({ data, width = 640, height = 200, tone = "signal", overlayTone = "notice", yFormat = formatTick, xLabelEvery = 1, ariaLabel, emptyMessage = "No data" }: BarChartProps) {
  if (data.length === 0) return <ChartEmpty height={height} message={emptyMessage} />;
  const max = Math.max(1, ...data.map((d) => Math.max(d.value, d.overlay ?? 0)));
  const { domain, ticks } = niceTicks({ min: 0, max }, 3);
  const sy = makeScale(domain, [height - PAD.bottom, PAD.top]);
  const plotW = width - PAD.left - PAD.right;
  const slot = plotW / data.length;
  const barW = Math.max(2, Math.min(28, slot * 0.62));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={ariaLabel ?? "Bar chart"} className="block overflow-visible">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={width - PAD.right} y1={sy(t)} y2={sy(t)} stroke="var(--color-line)" shapeRendering="crispEdges" />
          <text x={PAD.left - 6} y={sy(t) + 3} textAnchor="end" style={MONO_TEXT_STYLE}>
            {yFormat(t)}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const cx = PAD.left + slot * i + slot / 2;
        const y = sy(d.value);
        const base = height - PAD.bottom;
        return (
          <g key={d.label + i}>
            <title>{d.title ?? `${d.label}: ${d.value}${d.overlay ? ` (${d.overlay} overlay)` : ""}`}</title>
            <rect className="ws-bar" style={{ animationDelay: `${120 + i * 26}ms` }} x={cx - barW / 2} y={y} width={barW} height={Math.max(0, base - y)} fill={TONE_COLOR[tone]} opacity={0.85} rx={1} />
            {d.overlay ? <rect className="ws-bar" style={{ animationDelay: `${220 + i * 26}ms` }} x={cx - barW / 2} y={sy(d.overlay)} width={barW} height={Math.max(0, base - sy(d.overlay))} fill={TONE_COLOR[overlayTone]} rx={1} /> : null}
            {i % xLabelEvery === 0 ? (
              <text x={cx} y={height - 6} textAnchor="middle" style={MONO_TEXT_STYLE}>
                {d.label}
              </text>
            ) : null}
          </g>
        );
      })}
      <line x1={PAD.left} x2={width - PAD.right} y1={height - PAD.bottom} y2={height - PAD.bottom} stroke="var(--color-line-strong)" shapeRendering="crispEdges" />
    </svg>
  );
}
