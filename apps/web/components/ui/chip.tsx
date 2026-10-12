import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export type ChipTone = "signal" | "notice" | "fault" | "neutral" | "muted";

export const chipVariants = cva(
  "inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-xs)] border px-2 font-mono text-[10.5px] uppercase tracking-[0.1em]",
  {
    variants: {
      tone: {
        signal: "border-[rgba(95,212,230,0.35)] bg-signal-dim text-signal",
        notice: "border-[rgba(232,181,90,0.35)] bg-notice-dim text-notice",
        fault: "border-[rgba(224,108,108,0.35)] bg-fault-dim text-fault",
        neutral: "border-line-strong bg-transparent text-fg-2",
        muted: "border-line bg-transparent text-fg-3",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface ChipProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof chipVariants> {
  /** Show a small status dot before the label. */
  dot?: boolean;
  /** Animate the dot (live indicator). */
  pulse?: boolean;
}

export function Chip({ className, tone, dot, pulse, children, ...rest }: ChipProps) {
  return (
    <span className={cn(chipVariants({ tone }), className)} {...rest}>
      {dot ? <span className={cn("size-1.5 rounded-full bg-current", pulse && "pulse-dot")} aria-hidden /> : null}
      {children}
    </span>
  );
}
