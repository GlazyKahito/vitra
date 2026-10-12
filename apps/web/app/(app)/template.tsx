"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { motion } from "motion/react";

/**
 * Route transition for the signed-in workspace. A template re-mounts on every
 * navigation, so each page fades in with an 8px rise (320ms). The very first
 * mount (server render + hydration) renders a plain wrapper: the page is never
 * hidden while JavaScript loads and no inline motion styles can mismatch.
 * Reduced motion is handled by the global MotionConfig (transform skipped,
 * opacity kept).
 */
let hydrated = false;

export default function WorkspaceTemplate({ children }: { children: ReactNode }) {
  const animate = hydrated;
  useEffect(() => {
    hydrated = true;
  }, []);
  if (!animate) return <div>{children}</div>;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  );
}
