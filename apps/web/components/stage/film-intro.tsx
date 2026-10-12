"use client";

import { useEffect, useRef, useState } from "react";
import { useStage } from "./smooth-scroll";

const SEEN_KEY = "vitra.intro.seen";
/** How long the LED takes to climb. Pure CSS, so it runs on the compositor. */
const RISE_MS = 1700;
/** Give up waiting on a slow device and open anyway. */
const GIVE_UP_MS = 4500;
const FLARE_MS = 700;

/** What the counter waits for, and how much of the bar each one is worth. */
const WEIGHTS = { fonts: 0.4, bg: 0.25, stage: 0.35 } as const;
export type ReadyStep = keyof typeof WEIGHTS;

declare global {
  interface Window {
    __vitraReady?: Set<string>;
  }
}

/** Scenes call this when their real work is done (shader compiled, mesh built…). */
export function markReady(step: ReadyStep) {
  if (typeof window === "undefined") return;
  (window.__vitraReady ??= new Set()).add(step);
}

function progress() {
  const done = window.__vitraReady ?? new Set();
  let p = 0;
  for (const k of Object.keys(WEIGHTS) as ReadyStep[]) if (done.has(k)) p += WEIGHTS[k];
  return Math.min(1, Math.round(p * 1000) / 1000);
}

const CSS =
  "@keyframes vi-rise{from{transform:translate3d(0,0,0)}to{transform:translate3d(0,-24vh,0)}}" +
  "@keyframes vi-trail{from{transform:scaleY(0)}to{transform:scaleY(1)}}" +
  "@keyframes vi-in{from{opacity:0;transform:translate3d(0,8px,0)}to{opacity:1;transform:none}}" +
  "@keyframes vi-breathe{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.35);opacity:1}}" +
  ".vi-rise{animation:vi-rise " + RISE_MS + "ms cubic-bezier(.45,0,.15,1) both;will-change:transform}" +
  ".vi-trail{transform-origin:bottom;animation:vi-trail " + RISE_MS + "ms cubic-bezier(.45,0,.15,1) both;will-change:transform}" +
  ".vi-in{animation:vi-in .7s cubic-bezier(.16,1,.3,1) both}" +
  ".vi-led{animation:vi-breathe 1.6s ease-in-out infinite}" +
  ".vi-flare{transition:transform .5s cubic-bezier(.16,1,.3,1),opacity .35s ease;will-change:transform,opacity}" +
  "@keyframes vi-burst{0%{transform:scale(.02);opacity:0}18%{opacity:1}100%{transform:scale(1);opacity:0}}" +
  ".vi-burst{animation:vi-burst .95s cubic-bezier(.16,1,.3,1) both;will-change:transform,opacity}";

/**
 * The opening, after Ember's (github.com/GlazyKahito/ember-glazy): one LED
 * point climbs on its light trail while the counter reports the page's REAL
 * loading — fonts, the background shader, the colour-cube mesh. The climb is a
 * CSS animation on transform, so it stays smooth even while the page hydrates
 * underneath; the counter never runs ahead of what has actually loaded. When
 * both are done the LEDs come on — a champagne flare — and the overlay fades.
 * Escape, a click or the button skips; plays once per tab session; never under
 * reduced motion.
 */
export function FilmIntro() {
  const { finishIntro } = useStage();
  const [phase, setPhase] = useState<"loading" | "flare" | "gone">("loading");
  const root = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1" && !new URLSearchParams(location.search).has("intro");
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* storage blocked: play it */
    }
    const timers: number[] = [];
    const end = (instant: boolean) => {
      if (done.current) return;
      done.current = true;
      if (instant) {
        finishIntro();
        setPhase("gone");
        return;
      }
      setPhase("flare");
      // the page starts moving under the flare, not after it
      timers.push(window.setTimeout(finishIntro, 180), window.setTimeout(() => setPhase("gone"), FLARE_MS + 250));
    };
    if (reduce || seen) {
      end(true);
      return;
    }

    document.fonts?.ready.then(() => markReady("fonts"));
    timers.push(window.setTimeout(() => (Object.keys(WEIGHTS) as ReadyStep[]).forEach(markReady), GIVE_UP_MS));
    const t0 = performance.now();
    let raf = 0;
    let lastPct = -1;
    const tick = (now: number) => {
      const timeP = Math.min(1, (now - t0) / RISE_MS);
      // follow the CSS climb's easing, roughly, but never ahead of what has loaded
      const eased = timeP < 0.5 ? 2 * timeP * timeP : 1 - Math.pow(-2 * timeP + 2, 2) / 2;
      const pct = Math.round(Math.min(eased, progress()) * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        if (countRef.current) countRef.current.textContent = String(pct).padStart(2, "0");
        if (labelRef.current) labelRef.current.textContent = pct < 40 ? "Setting the type" : pct < 75 ? "Warming the LEDs" : pct < 100 ? "Calibrating the camera" : "Lights on";
      }
      if (pct >= 100) {
        end(false);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const skip = () => {
      cancelAnimationFrame(raf);
      end(false);
    };
    const el = root.current!;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && skip();
    window.addEventListener("keydown", onKey);
    el.addEventListener("click", skip);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("keydown", onKey);
      el.removeEventListener("click", skip);
    };
  }, [finishIntro]);

  if (phase === "gone") return null;
  const flare = phase === "flare";

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label="Loading VITRA"
      className="fixed inset-0 z-[100] cursor-pointer select-none"
      style={{ opacity: flare ? 0 : 1, transition: `opacity ${FLARE_MS}ms cubic-bezier(.4,0,.2,1) 160ms`, willChange: "opacity" }}
    >
      <style>{CSS}</style>
      <div className="absolute inset-0" style={{ background: "radial-gradient(55% 45% at 50% 62%, rgba(13,76,60,0.38), transparent 70%), #050706" }} />

      {/* the LED: a point of light climbing on its own trail */}
      <div className="absolute left-1/2 top-[62%] size-0">
        <div className="vi-trail absolute left-[-0.5px] top-[-24vh] h-[24vh] w-px bg-gradient-to-b from-[#f6ecd2] via-[#c9a96e]/40 to-transparent" />
        <div className="vi-rise absolute left-0 top-0">
          <span
            className="vi-flare absolute left-[-6px] top-[-6px] block size-3 rounded-full"
            style={{
              transform: flare ? "scale(2.5)" : "scale(1)",
              opacity: flare ? 0 : 1,
              background: "radial-gradient(circle, #fffaf0 0%, #f6ecd2 35%, #c9a96e 70%, transparent 72%)",
              boxShadow: "0 0 18px 6px rgba(235,218,176,0.5), 0 0 70px 22px rgba(201,169,110,0.2)",
            }}
          >
            {!flare && <span className="vi-led absolute inset-0 rounded-full" style={{ boxShadow: "0 0 26px 8px rgba(235,218,176,0.35)" }} />}
          </span>
          {/* the LEDs coming on: a pre-drawn light that only scales and fades (no repaint) */}
          {flare && (
            <span
              aria-hidden
              className="vi-burst pointer-events-none absolute block rounded-full"
              style={{
                left: "-80vmax",
                top: "-80vmax",
                width: "160vmax",
                height: "160vmax",
                background: "radial-gradient(circle, rgba(255,250,240,0.95) 0%, rgba(246,236,210,0.6) 12%, rgba(201,169,110,0.22) 30%, transparent 60%)",
              }}
            />
          )}
          <span
            className="t-serif absolute left-6 top-0 flex -translate-y-[62%] items-start gap-1 text-[clamp(3rem,6vw,5.4rem)] italic leading-none text-[#f2ebdd] transition-opacity duration-200"
            style={{ opacity: flare ? 0 : 1 }}
          >
            <span ref={countRef} className="tabular-nums">
              00
            </span>
            <small className="mt-[0.7em] font-mono text-[11px] not-italic tracking-[0.2em] text-[#c9a96e]">%</small>
          </span>
        </div>
      </div>

      <div className="vi-in absolute inset-x-0 top-[13vh] text-center font-mono text-[11px] uppercase tracking-[0.34em] text-[#f2ebdd]/60">
        <span ref={labelRef}>Setting the type</span>
      </div>
      <div className="vi-in absolute bottom-8 left-10 font-mono text-[11px] uppercase leading-relaxed tracking-[0.18em] text-[#bfc1c2]/60" style={{ animationDelay: ".15s" }}>
        <span className="t-serif block text-[22px] normal-case italic tracking-normal text-[#f2ebdd]">VITRA</span>
        KJS-HC-03 · Urine strip colorimetry
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          root.current?.click();
        }}
        className="vi-in absolute bottom-8 right-10 flex items-center gap-2 rounded-full border border-white/15 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#f2ebdd]/75 transition-colors hover:border-[#c9a96e] hover:text-[#f2ebdd]"
        style={{ animationDelay: ".25s" }}
      >
        Skip intro
        <kbd className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-[#f2ebdd]/55">Esc</kbd>
      </button>
    </div>
  );
}
