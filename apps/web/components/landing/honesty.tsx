"use client";

import { useRef } from "react";
import { GlassTilt } from "@/components/stage/glass-tilt";
import { Chapter, ChapterHeadline } from "./chapter";
import { gsap, useScrollScene } from "./fx/use-scroll-scene";

const LINES = [
  { k: "Not a medical device", v: "VITRA is a research prototype. It is not registered, certified or intended for diagnosis." },
  { k: "No clinical validation", v: "No model has been compared against laboratory reference measurements. No accuracy is claimed." },
  { k: "Synthetic data is labelled", v: "Every demo value is produced from synthetic fixtures and is marked SYNTHETIC in the data and the interface." },
  { k: "No reference intervals", v: "The platform ships without normal ranges and never colours a result as normal or abnormal." },
] as const;

/** Where the burn starts, as a fraction of the scene box. */
const ORIGIN = { x: 0.28, y: 0.42 };
/** The hot edge sits at this fraction of the ring element's radius (matches .lc-burn-ring's gradient). */
const EDGE = 0.66;

/**
 * Chapter 07 — what this is not. The frame catches in the gate and burns:
 * a hot amber edge opens from one point and the statements are revealed
 * behind it (scrubbed), then the four cards settle.
 */
export function Honesty() {
  const ref = useRef<HTMLDivElement>(null);

  useScrollScene(ref, (scope) => {
    const reveal = scope.querySelector<HTMLElement>("[data-reveal]")!;
    const rings = gsap.utils.toArray<HTMLElement>("[data-burn]", scope);
    const glow = scope.querySelector<HTMLElement>("[data-glow]")!;
    const maxR = () => {
      const w = scope.clientWidth;
      const h = scope.clientHeight;
      return Math.hypot(Math.max(ORIGIN.x, 1 - ORIGIN.x) * w, Math.max(ORIGIN.y, 1 - ORIGIN.y) * h) + 24;
    };
    let R = maxR();
    const p = { v: 0 };
    const paint = () => {
      const v = p.v;
      reveal.style.clipPath = `circle(${(v * R).toFixed(1)}px at ${ORIGIN.x * 100}% ${ORIGIN.y * 100}%)`;
      rings.forEach((ring, i) => {
        // the second, smaller ring lags and wobbles off-centre so the edge reads as uneven, not geometric
        const s = i === 0 ? v : Math.max(0, v * 0.94 - 0.01);
        ring.style.transform = `translate(-50%,-50%) scale(${s.toFixed(4)})${i === 1 ? ` rotate(${(v * 40).toFixed(1)}deg)` : ""}`;
      });
    };
    const size = () => {
      R = maxR();
      rings.forEach((ring) => {
        const d = `${((R / EDGE) * 2).toFixed(0)}px`;
        ring.style.width = d;
        ring.style.height = d;
      });
      paint();
    };
    size();

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: scope, start: "top 78%", end: "top 8%", scrub: 0.8, onRefresh: size },
    });
    tl.to(p, { v: 1, duration: 1, ease: "power1.in", onUpdate: paint }, 0);
    tl.fromTo(rings, { opacity: 1 }, { opacity: 0, duration: 0.18 }, 0.82);
    tl.fromTo(glow, { opacity: 0 }, { opacity: 0.85, duration: 0.25 }, 0.05);
    tl.to(glow, { opacity: 0, duration: 0.4 }, 0.6);
    tl.from(scope.querySelectorAll("[data-card]"), { y: 50, opacity: 0, stagger: 0.07, duration: 0.3, ease: "power2.out" }, 0.45);
  });

  return (
    <Chapter index="12" label="What this is not" id="honesty">
      <div ref={ref} className="relative pb-32 pt-16">
        <div data-reveal>
          <ChapterHeadline size="text-[104px]" className="max-w-[15ch]">
            {"The fine print, *in large type.*"}
          </ChapterHeadline>
          <dl className="mt-16 grid grid-cols-4 gap-5">
            {LINES.map((l, i) => (
              <div key={l.k} data-card>
                <GlassTilt className="flex h-full flex-col p-7" max={7}>
                  <span className="t-serif text-[76px] leading-none text-[var(--lc-gold)]">{String(i + 1).padStart(2, "0")}</span>
                  <dt className="mt-8 text-[18px] font-medium tracking-[-0.01em] text-[var(--film-cream)]">{l.k}</dt>
                  <dd className="mt-3 text-[14px] leading-relaxed text-fg-3">{l.v}</dd>
                </GlassTilt>
              </div>
            ))}
          </dl>
        </div>

        {/* the burn */}
        <div className="pointer-events-none absolute inset-y-0 -left-10 -right-10 overflow-hidden" aria-hidden>
          <div data-glow className="film-leak opacity-0" style={{ left: `calc(40px + ${ORIGIN.x} * (100% - 80px))`, top: `${ORIGIN.y * 100}%`, transform: "translate(-50%,-50%)" }} />
          <div data-burn className="lc-burn-ring absolute rounded-full" style={{ left: `calc(40px + ${ORIGIN.x} * (100% - 80px))`, top: `${ORIGIN.y * 100}%`, transform: "translate(-50%,-50%) scale(0)" }} />
          <div
            data-burn
            className="lc-burn-ring lc-burn-ring-2 absolute rounded-full"
            style={{ left: `calc(40px + ${ORIGIN.x + 0.015} * (100% - 80px))`, top: `${ORIGIN.y * 100 - 2}%`, transform: "translate(-50%,-50%) scale(0)" }}
          />
        </div>
      </div>
    </Chapter>
  );
}
