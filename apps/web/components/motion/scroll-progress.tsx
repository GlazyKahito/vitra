"use client";

import { motion, useReducedMotion, useScroll, useSpring } from "motion/react";

/** 1px cyan progress hairline fixed at the top of the viewport. */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const reduced = useReducedMotion();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 });
  return (
    <motion.div
      aria-hidden
      className="fixed inset-x-0 top-0 z-[90] h-px origin-left bg-signal"
      style={{ scaleX: reduced ? scrollYProgress : scaleX }}
    />
  );
}
