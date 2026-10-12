import { BarChart } from "./bar-chart";
import { extent, type ChartTone } from "./scale";

export interface HistogramProps {
  values: number[];
  bins?: number;
  width?: number;
  height?: number;
  tone?: ChartTone;
  format?: (v: number) => string;
  ariaLabel?: string;
}

/** Equal-width histogram built on BarChart. */
export function Histogram({ values, bins = 12, width = 420, height = 180, tone = "neutral", format = (v) => v.toFixed(1), ariaLabel }: HistogramProps) {
  const finite = values.filter((v) => Number.isFinite(v));
  const { min, max } = extent(finite);
  const step = (max - min) / bins || 1;
  const counts = new Array<number>(bins).fill(0);
  for (const v of finite) {
    const i = Math.min(bins - 1, Math.max(0, Math.floor((v - min) / step)));
    counts[i] += 1;
  }
  const data = counts.map((c, i) => ({ label: format(min + i * step), value: c, title: `${format(min + i * step)} – ${format(min + (i + 1) * step)}: ${c}` }));
  return <BarChart data={data} width={width} height={height} tone={tone} xLabelEvery={Math.ceil(bins / 6)} ariaLabel={ariaLabel ?? "Histogram"} emptyMessage="No residuals" />;
}
