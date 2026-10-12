"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface MarqueeProps {
  children: ReactNode;
  /** seconds for one full loop */
  duration?: number;
  reverse?: boolean;
  className?: string;
}

/** Infinite horizontal marquee; static (single copy, no animation) under reduced motion. */
export function Marquee({ children, duration = 40, reverse, className }: MarqueeProps) {
  const reduced = useReducedMotion();
  if (reduced) {
    return <div className={cn("overflow-hidden whitespace-nowrap", className)}>{children}</div>;
  }
  return (
    <div className={cn("overflow-hidden whitespace-nowrap", className)} aria-hidden>
      <motion.div
        className="inline-flex"
        animate={{ x: reverse ? ["-50%", "0%"] : ["0%", "-50%"] }}
        transition={{ duration, ease: "linear", repeat: Infinity }}
      >
        <div className="inline-flex shrink-0">{children}</div>
        <div className="inline-flex shrink-0">{children}</div>
      </motion.div>
    </div>
  );
}
