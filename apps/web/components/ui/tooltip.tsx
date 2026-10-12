"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TooltipProps {
  content: ReactNode;
  side?: "top" | "bottom";
  className?: string;
  children: ReactNode;
}

/** Hover/focus tooltip without a portal — fine for the desktop console. */
export function Tooltip({ content, side = "top", className, children }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open ? (
        <span
          role="tooltip"
          id={id}
          className={cn(
            "pointer-events-none absolute left-1/2 z-50 w-max max-w-[260px] -translate-x-1/2 rounded-[var(--radius-xs)] border border-line-strong bg-ink-3 px-2.5 py-1.5 text-[12px] leading-snug text-fg-2 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.8)]",
            side === "top" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
