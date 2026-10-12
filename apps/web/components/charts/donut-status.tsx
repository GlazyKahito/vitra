import { ChartEmpty } from "./chart-frame";
import { TONE_COLOR, type ChartTone } from "./scale";

export interface DonutSlice {
  label: string;
  value: number;
  tone: ChartTone;
}

export interface DonutStatusProps {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  /** Centre caption, defaults to the total. */
  centerLabel?: string;
  centerCaption?: string;
  ariaLabel?: string;
}

/** Status distribution ring with a tabular legend. Tones are status, never result quality. */
export function DonutStatus({ slices, size = 132, thickness = 14, centerLabel, centerCaption = "runs", ariaLabel }: DonutStatusProps) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (total === 0) return <ChartEmpty height={size} message="No runs" />;
  const r = size / 2 - thickness / 2 - 1;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={ariaLabel ?? "Status distribution"} className="shrink-0">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={thickness} />
        {slices
          .filter((s) => s.value > 0)
          .map((s, idx) => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={TONE_COLOR[s.tone]}
                strokeWidth={thickness}
                strokeDasharray={`${Math.max(0, len - 1.5)} ${c - Math.max(0, len - 1.5)}`}
                strokeDashoffset={-offset}
                className="ws-slice"
                style={{ animationDelay: `${160 + idx * 90}ms` }}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
              >
                <title>{`${s.label}: ${s.value}`}</title>
              </circle>
            );
            offset += len;
            return el;
          })}
        <text x={size / 2} y={size / 2 + 2} textAnchor="middle" style={{ fontFamily: "var(--font-mono)", fontSize: 20, fill: "var(--color-fg)", fontVariantNumeric: "tabular-nums" }}>
          {centerLabel ?? total}
        </text>
        <text x={size / 2} y={size / 2 + 16} textAnchor="middle" style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", fill: "var(--color-fg-4)" }}>
          {centerCaption.toUpperCase()}
        </text>
      </svg>
      <ul className="flex min-w-0 flex-col gap-1.5">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-[12px]">
            <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: TONE_COLOR[s.tone] }} />
            <span className="min-w-0 flex-1 truncate text-fg-2">{s.label}</span>
            <span className="t-mono text-fg">{s.value}</span>
            <span className="t-mono w-9 text-right text-fg-4">{Math.round((s.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
