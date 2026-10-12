"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { ANALYTES, mixHex } from "@/lib/analytes";

/**
 * A ten-pad strip whose pads slowly develop colour, as a reagent strip does through its reaction window.
 * Purely decorative: colours come from the synthetic demo ramps in lib/analytes, and the panel says so.
 */
const LEVELS: readonly (readonly number[])[] = [
  [0.7, 0.85, 1, 0.6, 0.9, 0.55, 0.8, 0.5, 0.95, 1],
  [1, 0.6, 0.8, 0.95, 0.55, 0.75, 1, 0.9, 0.6, 0.85],
  [0.8, 1, 0.6, 0.7, 1, 0.6, 0.85, 0.55, 1, 0.7],
];
/** Jewel tones: the deep end of each synthetic demo ramp lifted toward champagne (same as the homescreen). */
const JEWEL = ANALYTES.map((a) => mixHex(a.demoRamp[2], "#ebdab0", 0.28));
/** The dry pad: the same hue sunk almost to onyx. */
const DRY = JEWEL.map((c) => mixHex(c, "#0a0f0d", 0.8));
const padColour = (i: number, level: number | null) => (level === null ? DRY[i] : mixHex(DRY[i], JEWEL[i], 0.25 + 0.75 * level));
const DEVELOP_MS = 5200;
const HOLD_MS = 3800;

export function DevelopingStrip() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<{ set: number; developed: boolean }>({ set: 0, developed: false });

  useEffect(() => {
    if (reduce) {
      setPhase({ set: 0, developed: true });
      return;
    }
    // wash back to the dry colours, develop, hold, then the next set
    const timers: number[] = [];
    let set = 0;
    const run = () => {
      setPhase({ set, developed: false });
      timers.push(window.setTimeout(() => setPhase({ set, developed: true }), 900));
      timers.push(
        window.setTimeout(() => {
          set = (set + 1) % LEVELS.length;
          run();
        }, 900 + DEVELOP_MS + HOLD_MS),
      );
    };
    run();
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [reduce]);

  const levels = LEVELS[phase.set];
  return (
    <figure className="w-full">
      <div className="relative">
        <div className="flex h-[clamp(52px,8vh,70px)] items-center rounded-[6px] border border-[#c9a96e]/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.015))] p-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-md">
          <div className="mr-2 h-full w-[18%] shrink-0 rounded-[3px] border border-[#c9a96e]/25 bg-[rgba(0,0,0,0.35)]" aria-hidden />
          <div className="flex h-full flex-1 justify-between gap-1.5">
            {ANALYTES.map((a, i) => (
              <span
                key={a.key}
                className="h-full flex-1 rounded-[2px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_0_14px_-4px_rgba(0,0,0,0.6)]"
                style={{
                  background: padColour(i, phase.developed ? levels[i] : null),
                  transition: reduce ? undefined : `background-color ${phase.developed ? DEVELOP_MS - 1200 : 800}ms cubic-bezier(.4,0,.2,1) ${phase.developed ? i * 120 : 0}ms`,
                }}
                title={a.label}
              />
            ))}
          </div>
        </div>
        <div className="mt-2 flex pl-[calc(18%+16px)] pr-2">
          {ANALYTES.map((a) => (
            <span key={a.key} className="flex-1 text-center font-mono text-[9.5px] tracking-[0.06em] text-[var(--lux-platinum)]/60">
              {a.short}
            </span>
          ))}
        </div>
      </div>
      {/* reaction hairline */}
      <div className="mt-[clamp(10px,2vh,20px)] flex items-center gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--lux-platinum)]/60">Reaction</span>
        <span className="relative h-px flex-1 overflow-hidden bg-[rgb(var(--lc-ivory-rgb)/0.12)]">
          <span
            className="absolute inset-y-0 left-0 bg-[var(--lux-gold)]"
            style={{ width: phase.developed ? "100%" : "0%", transition: reduce ? undefined : `width ${phase.developed ? DEVELOP_MS : 600}ms linear` }}
          />
        </span>
        <span className="font-mono text-[10px] tabular-nums tracking-[0.12em] text-[var(--lux-platinum)]/60">120 s</span>
      </div>
      <figcaption className="mt-[clamp(6px,1.2vh,12px)] flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-[var(--lux-champagne)]/80">
        <span className="rounded-[3px] border border-dashed border-[rgb(var(--lc-gold-rgb)/0.6)] px-1.5 py-px">Synthetic · illustrative</span>
        <span className="text-[var(--lux-platinum)]/45">not a reading</span>
      </figcaption>
    </figure>
  );
}
