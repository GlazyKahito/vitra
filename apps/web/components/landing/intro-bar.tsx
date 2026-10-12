"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

const STEPS = ["INITIALISING OPTICS", "LED CURRENT · STABLE", "CAMERA · READY"] as const;
const DURATION_MS = 900;

/**
 * Chapter 00. A ≤900 ms boot bar that dissolves into the hero. Skippable with
 * any key or click; never shown under reduced motion.
 */
export function IntroBar() {
  const reduced = useReducedMotion();
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (reduced) {
      setDone(true);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION_MS);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setDone(true);
    };
    raf = requestAnimationFrame(tick);
    const skip = () => setDone(true);
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [reduced]);

  const step = STEPS[Math.min(STEPS.length - 1, Math.floor(progress * STEPS.length))];

  return (
    <AnimatePresence>
      {!done ? (
        <motion.div
          key="intro"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-ink-0"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5, ease: "easeOut" } }}
          aria-live="polite"
          aria-label="Loading"
        >
          <div className="w-[360px]">
            <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.14em] text-fg-3">
              <span>{step}</span>
              <span className="tabular-nums text-fg-4">{Math.round(progress * 100).toString().padStart(3, "0")}</span>
            </div>
            <div className="mt-3 h-px w-full bg-line">
              <div className="h-px bg-signal" style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-4">Press any key to skip</div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
