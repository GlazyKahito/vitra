import { ChartEmpty } from "./chart-frame";
import { Marker } from "./line-chart";
import { MONO_TEXT_STYLE, TONE_COLOR, extent, formatTick, makeScale, niceTicks, type ChartTone } from "./scale";

export interface ScatterPoint {
  x: number;
  y: number;
  label?: string;
  synthetic?: boolean;
  tone?: ChartTone;
}

export interface ScatterChartProps {
  points: ScatterPoint[];
  width?: number;
  height?: number;
  tone?: ChartTone;
  /** Draw y = x (predicted vs reference). */
  identityLine?: boolean;
  /** Draw a fitted line y = slope·x + intercept. */
  fit?: { slope: number; intercept: number };
  xLabel?: string;
  yLabel?: string;
  xFormat?: (v: number) => string;
  yFormat?: (v: number) => string;
  ariaLabel?: string;
}

const PAD = { top: 10, right: 14, bottom: 30, left: 44 };

export function ScatterChart({ points, width = 420, height = 260, tone = "signal", identityLine, fit, xLabel, yLabel, xFormat = formatTick, yFormat = formatTick, ariaLabel }: ScatterChartProps) {
  if (points.length === 0) return <ChartEmpty height={height} message="No points" />;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const all = identityLine ? [...xs, ...ys] : null;
  const xN = niceTicks(all ? extent(all) : extent(xs), 4);
  const yN = niceTicks(all ? extent(all) : extent(ys), 4);
  const sx = makeScale(xN.domain, [PAD.left, width - PAD.right]);
  const sy = makeScale(yN.domain, [height - PAD.bottom, PAD.top]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={ariaLabel ?? "Scatter chart"} className="block overflow-visible">
      {yN.ticks.map((t) => (
        <g key={`y${t}`}>
          <line x1={PAD.left} x2={width - PAD.right} y1={sy(t)} y2={sy(t)} stroke="var(--color-line)" shapeRendering="crispEdges" />
          <text x={PAD.left - 6} y={sy(t) + 3} textAnchor="end" style={MONO_TEXT_STYLE}>
            {yFormat(t)}
          </text>
        </g>
      ))}
      {xN.ticks.map((t) => (
        <g key={`x${t}`}>
          <line y1={PAD.top} y2={height - PAD.bottom} x1={sx(t)} x2={sx(t)} stroke="var(--color-line)" shapeRendering="crispEdges" />
          <text x={sx(t)} y={height - PAD.bottom + 14} textAnchor="middle" style={MONO_TEXT_STYLE}>
            {xFormat(t)}
          </text>
        </g>
      ))}
      {identityLine ? (
        <line x1={sx(xN.domain.min)} y1={sy(xN.domain.min)} x2={sx(xN.domain.max)} y2={sy(xN.domain.max)} stroke="var(--color-fg-4)" strokeDasharray="4 3" />
      ) : null}
      {fit ? (
        <line
          x1={sx(xN.domain.min)}
          y1={sy(fit.slope * xN.domain.min + fit.intercept)}
          x2={sx(xN.domain.max)}
          y2={sy(fit.slope * xN.domain.max + fit.intercept)}
          stroke={TONE_COLOR.notice}
          strokeWidth={1.5}
        />
      ) : null}
      {points.map((p, i) => (
        <Marker key={i} cx={sx(p.x)} cy={sy(p.y)} color={TONE_COLOR[p.tone ?? tone]} synthetic={p.synthetic} title={[p.label, `${xFormat(p.x)} → ${yFormat(p.y)}`, p.synthetic ? "SYNTHETIC" : null].filter(Boolean).join(" · ")} />
      ))}
      {xLabel ? (
        <text x={(PAD.left + width - PAD.right) / 2} y={height - 2} textAnchor="middle" style={{ ...MONO_TEXT_STYLE, fill: "var(--color-fg-4)" }}>
          {xLabel.toUpperCase()}
        </text>
      ) : null}
      {yLabel ? (
        <text x={10} y={PAD.top + 4} style={{ ...MONO_TEXT_STYLE, fill: "var(--color-fg-4)" }}>
          {yLabel.toUpperCase()}
        </text>
      ) : null}
    </svg>
  );
}
