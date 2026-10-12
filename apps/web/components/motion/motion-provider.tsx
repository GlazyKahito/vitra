"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * Global Motion configuration. `reducedMotion="user"` makes every `motion.*`
 * element in the tree honour the OS "reduce motion" preference (transforms are
 * skipped, opacity changes are kept). GSAP components check
 * `useReducedMotion()` themselves.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </MotionConfig>
  );
}
