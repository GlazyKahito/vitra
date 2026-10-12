import { TONE_COLOR, extent, makeScale, type ChartTone } from "./scale";

export interface SparklineProps {
  values: (number | null)[];
  width?: number;
  height?: number;
  tone?: ChartTone;
  /** Mark the last point. */
  endDot?: boolean;
  ariaLabel?: string;
}

/** Inline mini line for stat tiles and table cells. */
export function Sparkline({ values, width = 96, height = 24, tone = "signal", endDot = true, ariaLabel }: SparklineProps) {
  const finite = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (finite.length < 2) {
    return <svg width={width} height={height} aria-hidden className="block" />;
  }
  const yDom = extent(finite);
  const sx = makeScale({ min: 0, max: values.length - 1 }, [2, width - 2]);
  const sy = makeScale(yDom, [height - 3, 3]);
  let d = "";
  let open = false;
  let last: { x: number; y: number } | null = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v === null || !Number.isFinite(v)) {
      open = false;
      continue;
    }
    const x = sx(i);
    const y = sy(v);
    d += `${open ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
    open = true;
    last = { x, y };
  }
  const color = TONE_COLOR[tone];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel ?? "Trend"} className="block overflow-visible">
      <path d={d.trim()} fill="none" stroke={color} strokeWidth={1.25} strokeLinejoin="round" />
      {endDot && last !== null ? <circle cx={last.x} cy={last.y} r={2} fill={color} /> : null}
    </svg>
  );
}
