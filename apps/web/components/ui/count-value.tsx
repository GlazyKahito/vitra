"use client";

import { useLayoutEffect, useRef } from "react";

export interface CountValueProps {
  /** The final text, e.g. "36", "100%", "0.82", "1,204". Non-numeric text renders as-is. */
  value: string | number;
  /** ms */
  duration?: number;
  delay?: number;
  className?: string;
}

const NUM = /^([^\d-]*)(-?[\d,]*\.?\d+)(.*)$/;

/**
 * Count-up readout. The server renders the final value (so no-JS and first
 * paint are correct); on mount it counts from zero by writing the text node in a
 * rAF loop (no React re-render per frame). Skipped under reduced motion.
 */
export function CountValue({ value, duration = 900, delay = 0, className }: CountValueProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const text = String(value);

  useLayoutEffect(() => {
    const el = ref.current;
    const m = NUM.exec(text);
    if (!el || !m) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const [, pre, numRaw, post] = m;
    const target = Number(numRaw.replace(/,/g, ""));
    if (!Number.isFinite(target) || target === 0) return;
    const decimals = numRaw.includes(".") ? numRaw.split(".")[1].length : 0;
    const grouped = numRaw.includes(",");
    const fmt = (v: number) => {
      const s = grouped ? v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) : v.toFixed(decimals);
      return `${pre}${s}${post}`;
    };
    // Write into React's own text node so later re-renders still target it.
    const node = el.firstChild;
    if (!node || node.nodeType !== Node.TEXT_NODE) return;
    const write = (s: string) => {
      node.nodeValue = s;
    };
    let raf = 0;
    let start = 0;
    write(fmt(0));
    const tick = (now: number) => {
      if (!start) start = now + delay;
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      const eased = 1 - Math.pow(1 - t, 4);
      write(fmt(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else write(text);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      write(text);
    };
  }, [text, duration, delay]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {text}
    </span>
  );
}
