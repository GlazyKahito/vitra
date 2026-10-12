"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Counts from 0 up to `value` the first time the number scrolls into view. The server-rendered text is
 * already the final value, so no-JS, reduced-motion and screenshot readers all see the true count.
 */
export function CountUp({ value, className, duration = 1.4, delay = 0 }: { value: number; className?: string; duration?: number; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const [armed, setArmed] = useState(false);

  // Drop to 0 only once hydrated and still off-screen, so the count has somewhere to come from.
  useEffect(() => {
    if (reduce || value === 0 || !ref.current) return;
    ref.current.textContent = "0";
    setArmed(true);
  }, [reduce, value]);

  useEffect(() => {
    if (!inView || !armed || reduce || !ref.current) return;
    const el = ref.current;
    const controls = animate(0, value, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = String(Math.round(v));
      },
    });
    return () => controls.stop();
  }, [inView, reduce, value, duration, delay, armed]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {value}
    </span>
  );
}

/** A bar segment that grows from zero width when it enters the view. */
export function GrowSegment({ pct, className, style, delay = 0, title, children }: { pct: number; className?: string; style?: CSSProperties; delay?: number; title?: string; children?: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = useReducedMotion();
  return (
    <motion.span
      ref={ref}
      title={title}
      className={cn("block h-full", className)}
      style={{ ...style, width: `${pct}%`, transformOrigin: "0 50%" }}
      initial={reduce ? false : { scaleX: 0 }}
      animate={inView || reduce ? { scaleX: 1 } : undefined}
      transition={{ duration: 1.1, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.span>
  );
}

/** Fades/raises children in once, staggered by `index`. */
export function RiseIn({ index = 0, className, children }: { index?: number; className?: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.7, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
