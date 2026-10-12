"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { ANALYTES, demoColor, hexToRgb } from "@/lib/analytes";
import { cn } from "@/lib/utils";
import { ReagentStrip, type StripLevels } from "./reagent-strip";

export interface StripScannerProps {
  levels?: StripLevels;
  width?: number;
  /** Loop the sequence. Default true. */
  loop?: boolean;
  /** ms per pad reveal. Default 220. */
  stepMs?: number;
  className?: string;
}

const DEFAULT_LEVELS: StripLevels = {
  glucose: 0.2,
  protein: 0.45,
  ph: 0.5,
  ketones: 0.1,
  blood: 0.15,
  bilirubin: 0.1,
  urobilinogen: 0.3,
  nitrite: 0.05,
  leucocytes: 0.25,
  specific_gravity: 0.55,
};

/**
 * Scan-line sweeps across the strip, then pad boxes P01..P10 appear one by one
 * with mono RGB readouts. All readouts are derived from the synthetic demo
 * ramp — the component labels itself "synthetic".
 */
export function StripScanner({ levels = DEFAULT_LEVELS, width = 640, loop = true, stepMs = 220, className }: StripScannerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "0px 0px -15% 0px" });
  const reduced = useReducedMotion();
  // phase: 0 idle, 1 scanning, 2 revealing, 3 done
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(reduced ? 3 : 0);
  const [revealed, setRevealed] = useState(reduced ? 10 : 0);

  useEffect(() => {
    if (reduced) {
      setPhase(3);
      setRevealed(10);
      return;
    }
    if (!inView) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      setPhase(1);
      setRevealed(0);
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          setPhase(2);
          for (let i = 1; i <= 10; i++) {
            timers.push(setTimeout(() => !cancelled && setRevealed(i), i * stepMs));
          }
          timers.push(
            setTimeout(() => {
              if (cancelled) return;
              setPhase(3);
              if (loop) timers.push(setTimeout(run, 2600));
            }, 10 * stepMs + 300),
          );
        }, 1500),
      );
    };
    run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [inView, reduced, loop, stepMs]);

  // Geometry mirrors ReagentStrip's viewBox (860 x 100): pads start at x=300, 44 wide, 12 gap.
  const VB_W = 860;
  const scale = width / VB_W;
  const stripH = 100 * scale;

  return (
    <div ref={ref} className={cn("relative select-none", className)} style={{ width }}>
      <div className="relative" style={{ height: stripH }}>
        <ReagentStrip levels={levels} width={width} />
        {/* scan line */}
        {phase === 1 ? (
          <div className="pointer-events-none absolute inset-y-0 left-0 w-full overflow-hidden" aria-hidden>
            <div className="scanline absolute inset-y-0 w-full" style={{ animationDuration: "1.5s", animationIterationCount: 1 }}>
              <div className="absolute inset-y-0 right-0 w-px bg-signal shadow-[0_0_14px_2px_rgba(95,212,230,0.6)]" />
              <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[rgba(95,212,230,0.18)] to-transparent" />
            </div>
          </div>
        ) : null}
        {/* pad boxes */}
        {ANALYTES.map((a, i) => {
          if (i >= revealed) return null;
          const x = (300 + i * 56) * scale;
          const y = (22 + 6) * scale;
          const s = 44 * scale;
          return (
            <div key={a.key} className="pointer-events-none absolute border border-signal" style={{ left: x - 2, top: y - 2, width: s + 4, height: s + 4 }} aria-hidden>
              <span className="absolute -top-4 left-0 font-mono text-[9px] tracking-[0.1em] text-signal">P{String(i + 1).padStart(2, "0")}</span>
            </div>
          );
        })}
      </div>
      {/* readouts */}
      <div className="mt-5 grid grid-cols-10 gap-1.5" style={{ paddingLeft: 300 * scale }}>
        {ANALYTES.map((a, i) => {
          const on = i < revealed;
          const [r, g, b] = hexToRgb(demoColor(a.key, levels[a.key] ?? 0.15));
          return (
            <div key={a.key} className={cn("font-mono text-[9.5px] leading-[1.5] text-fg-3 transition-opacity duration-300", on ? "opacity-100" : "opacity-0")}>
              <div className="text-fg-2">{a.short}</div>
              <div className="tabular-nums">{r}</div>
              <div className="tabular-nums">{g}</div>
              <div className="tabular-nums">{b}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-fg-4">
        <span>
          {phase === 1 ? "Localising strip…" : phase === 2 ? `Segmenting pad ${Math.min(revealed + 1, 10)} / 10` : phase === 3 ? "10 / 10 pads · features extracted" : "Idle"}
        </span>
        <span>Synthetic demonstration</span>
      </div>
    </div>
  );
}
