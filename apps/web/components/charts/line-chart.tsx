import type { ResultState } from "@/lib/inference/policy";
import { ChartEmpty } from "./chart-frame";
import { MONO_TEXT_STYLE, TONE_COLOR, SERIES_TONES, extent, formatTick, makeScale, niceTicks, type ChartTone, type Domain } from "./scale";

export interface LinePoint {
  x: number;
  /** null breaks the line (missing / no value reported). */
  y: number | null;
  /** Drawn as a hollow marker and labelled SYN in the tooltip. */
  synthetic?: boolean;
  state?: ResultState;
  label?: string;
}

export interface LineSeries {
  id: string;
  label?: string;
  tone?: ChartTone;
  dashed?: boolean;
  points: LinePoint[];
}

export interface LineChartProps {
  series: LineSeries[];
  width?: number;
  height?: number;
  /** Explicit x tick labels (categorical axes). When omitted, numeric ticks are generated. */
  xTicks?: { x: number; label: string }[];
  yDomain?: Domain;
  yTickCount?: number;
  yFormat?: (v: number) => string;
  xFormat?: (v: number) => string;
  showPoints?: boolean;
  /** Fill the area under the first series. */
  area?: boolean;
  /** Horizontal reference band (e.g. calibrated range). Drawn in muted tone. */
  band?: { from: number; to: number; label?: string };
  ariaLabel?: string;
  emptyMessage?: string;
}

const PAD = { top: 10, right: 12, bottom: 24, left: 40 };

/**
 * Multi-series line chart. Server-renderable (no hooks). Markers encode
 * provenance, never normal/abnormal: filled = model value, hollow = synthetic
 * demo value, square = experimental estimate.
 */
export function LineChart({
  series,
  width = 640,
  height = 200,
  xTicks,
  yDomain,
  yTickCount = 4,
  yFormat = formatTick,
  xFormat = formatTick,
  showPoints = true,
  area = false,
  band,
  ariaLabel,
  emptyMessage = "No values to plot",
}: LineChartProps) {
  const allPoints = series.flatMap((s) => s.points);
  const ys = allPoints.map((p) => p.y).filter((y): y is number => y !== null && Number.isFinite(y));
  if (ys.length === 0) return <ChartEmpty height={height} message={emptyMessage} />;

  const xs = allPoints.map((p) => p.x);
  const xDom = extent(xs);
  const yRaw = yDomain ?? extent(band ? [...ys, band.from, band.to] : ys);
  const { domain: yDom, ticks: yTicksV } = niceTicks(yRaw, yTickCount);
  const sx = makeScale(xDom, [PAD.left, width - PAD.right]);
  const sy = makeScale(yDom, [height - PAD.bottom, PAD.top]);

  const xTickList = xTicks ?? niceTicks(xDom, 5).ticks.filter((t) => t >= xDom.min && t <= xDom.max).map((t) => ({ x: t, label: xFormat(t) }));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={ariaLabel ?? "Line chart"} className="block overflow-visible">
      {band ? (
        <rect x={PAD.left} y={Math.min(sy(band.from), sy(band.to))} width={width - PAD.left - PAD.right} height={Math.abs(sy(band.from) - sy(band.to))} fill="rgba(255,255,255,0.035)" />
      ) : null}
      {/* hairline grid */}
      {yTicksV.map((t) => (
        <g key={`y${t}`}>
          <line x1={PAD.left} x2={width - PAD.right} y1={sy(t)} y2={sy(t)} stroke="var(--color-line)" strokeWidth={1} shapeRendering="crispEdges" />
          <text x={PAD.left - 6} y={sy(t) + 3} textAnchor="end" style={MONO_TEXT_STYLE}>
            {yFormat(t)}
          </text>
        </g>
      ))}
      {xTickList.map((t) => (
        <text key={`x${t.x}`} x={sx(t.x)} y={height - 6} textAnchor="middle" style={MONO_TEXT_STYLE}>
          {t.label}
        </text>
      ))}
      <line x1={PAD.left} x2={width - PAD.right} y1={height - PAD.bottom} y2={height - PAD.bottom} stroke="var(--color-line-strong)" shapeRendering="crispEdges" />

      {series.map((s, i) => {
        const color = TONE_COLOR[s.tone ?? SERIES_TONES[i % SERIES_TONES.length]];
        const path = buildPath(s.points, sx, sy);
        return (
          <g key={s.id}>
            {area && i === 0 && path ? <path d={`${path} L${sx(s.points[s.points.length - 1].x)},${height - PAD.bottom} L${sx(s.points[0].x)},${height - PAD.bottom} Z`} fill={color} opacity={0.08} /> : null}
            {path ? <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray={s.dashed ? "4 3" : undefined} strokeLinejoin="round" strokeLinecap="round" /> : null}
            {showPoints
              ? s.points.map((p, j) =>
                  p.y === null ? null : (
                    <Marker key={j} cx={sx(p.x)} cy={sy(p.y)} color={color} synthetic={p.synthetic} state={p.state} title={markerTitle(s, p, yFormat)} />
                  ),
                )
              : null}
          </g>
        );
      })}
    </svg>
  );
}

function buildPath(points: LinePoint[], sx: (v: number) => number, sy: (v: number) => number): string {
  let d = "";
  let open = false;
  for (const p of points) {
    if (p.y === null || !Number.isFinite(p.y)) {
      open = false;
      continue;
    }
    d += `${open ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)} `;
    open = true;
  }
  return d.trim();
}

function markerTitle(s: LineSeries, p: LinePoint, f: (v: number) => string): string {
  const parts = [s.label ?? s.id, p.label, p.y === null ? "—" : f(p.y)];
  if (p.state) parts.push(p.state);
  if (p.synthetic) parts.push("SYNTHETIC");
  return parts.filter(Boolean).join(" · ");
}

export function Marker({ cx, cy, color, synthetic, state, title }: { cx: number; cy: number; color: string; synthetic?: boolean; state?: ResultState; title?: string }) {
  const hollow = synthetic || state === "synthetic";
  const square = state === "experimental";
  return (
    <g>
      {title ? <title>{title}</title> : null}
      {square ? (
        <rect x={cx - 3} y={cy - 3} width={6} height={6} fill={hollow ? "var(--color-ink-2)" : color} stroke={color} strokeWidth={1.5} />
      ) : (
        <circle cx={cx} cy={cy} r={3} fill={hollow ? "var(--color-ink-2)" : color} stroke={color} strokeWidth={1.5} />
      )}
    </g>
  );
}
