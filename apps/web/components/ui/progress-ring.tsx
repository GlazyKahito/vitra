import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ProgressRingProps {
  /** 0..1 */
  value: number;
  size?: number;
  stroke?: number;
  tone?: "signal" | "notice" | "fault" | "neutral";
  label?: ReactNode;
  className?: string;
}

/** SVG progress ring. Pure markup, server-safe. */
export function ProgressRing({ value, size = 48, stroke = 3, tone = "signal", label, className }: ProgressRingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const color = { signal: "var(--color-signal)", notice: "var(--color-notice)", fault: "var(--color-fault)", neutral: "var(--color-fg-2)" }[tone];
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: "stroke-dashoffset 600ms var(--ease-out-expo)" }}
        />
      </svg>
      {label !== undefined ? <span className="absolute font-mono text-[10.5px] tabular-nums text-fg-2">{label}</span> : null}
    </div>
  );
}
