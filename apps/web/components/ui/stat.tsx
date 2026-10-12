import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface StatProps {
  eyebrow: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "signal" | "notice" | "fault";
  size?: "md" | "lg";
  className?: string;
}

/** Instrument readout: eyebrow, big tabular number, sub line. */
export function Stat({ eyebrow, value, unit, sub, tone = "default", size = "md", className }: StatProps) {
  const toneCls = { default: "text-fg", signal: "text-signal", notice: "text-notice", fault: "text-fault" }[tone];
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="t-eyebrow">{eyebrow}</div>
      <div className={cn("flex items-baseline gap-1.5 font-display tabular-nums tracking-[-0.03em]", size === "lg" ? "text-[40px] leading-none" : "text-[28px] leading-none", toneCls)}>
        {value}
        {unit ? <span className="font-mono text-[12px] tracking-normal text-fg-3">{unit}</span> : null}
      </div>
      {sub ? <div className="text-[12px] text-fg-3">{sub}</div> : null}
    </div>
  );
}
