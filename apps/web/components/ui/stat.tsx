import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CountValue } from "./count-value";

export interface StatProps {
  eyebrow: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "signal" | "notice" | "fault";
  size?: "md" | "lg";
  className?: string;
}

/** Instrument readout: eyebrow, big tabular number (counts up on mount), sub line. */
export function Stat({ eyebrow, value, unit, sub, tone = "default", size = "md", className }: StatProps) {
  const toneCls = { default: "text-fg", signal: "text-signal", notice: "text-notice", fault: "text-fault" }[tone];
  return (
    <div className={cn("ws-stat flex flex-col gap-1.5", className)}>
      <div className="t-eyebrow">{eyebrow}</div>
      <div className={cn("flex items-baseline gap-1.5 font-mono tabular-nums tracking-[-0.03em]", size === "lg" ? "text-[38px] leading-none" : "text-[26px] leading-none", toneCls)}>
        {typeof value === "string" || typeof value === "number" ? <CountValue value={value} /> : value}
        {unit ? <span className="font-mono text-[12px] tracking-normal text-fg-3">{unit}</span> : null}
      </div>
      {sub ? <div className="text-[12px] text-fg-3">{sub}</div> : null}
    </div>
  );
}
