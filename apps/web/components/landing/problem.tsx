"use client";

import { useRef } from "react";
import { GlassTilt } from "@/components/stage/glass-tilt";
import { demoColor, hexToRgb } from "@/lib/analytes";
import { Chapter, ChapterCopy, ChapterHeadline } from "./chapter";
import { gsap, useScrollScene } from "./fx/use-scroll-scene";

const CHART_BLOCKS = [0, 0.2, 0.4, 0.6, 0.8, 1] as const;
const CHART_LABELS = ["neg", "trace", "+", "++", "+++", "++++"] as const;
/** The ramp is drawn from the same function the readout samples, so the number under the marker is the colour under the marker. */
const RAMP = `linear-gradient(90deg, ${Array.from({ length: 11 }, (_, i) => `${demoColor("glucose", i / 10)} ${i * 10}%`).join(", ")})`;
const SWEEP_FROM = 0.08;
const SWEEP_TO = 0.74;
const STATIC_AT = 0.38;

function rgbAt(t: number) {
  const [r, g, b] = hexToRgb(demoColor("glucose", t));
  return `RGB ${r} / ${g} / ${b}`;
}

/** Chapter 02 — the problem: discrete chart swatches vs a continuous ramp. The marker sweeps the ramp with scroll; the eye snaps to a block. */
export function Problem() {
  const ref = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLDivElement>(null);
  const readRef = useRef<HTMLSpanElement>(null);
  const snapRef = useRef<HTMLSpanElement>(null);

  useScrollScene(ref, (el) => {
    const blocks = Array.from(el.querySelectorAll<HTMLElement>("[data-block]"));
    let lastBlock = -1;
    let lastRead = "";
    const proxy = { t: SWEEP_FROM };
    const paint = () => {
      const t = proxy.t;
      if (markerRef.current) markerRef.current.style.transform = `translate3d(${(t * 100).toFixed(3)}cqw,0,0)`;
      const read = rgbAt(t);
      if (read !== lastRead && readRef.current) {
        readRef.current.textContent = read;
        lastRead = read;
      }
      const b = Math.round(t * 5);
      if (b !== lastBlock) {
        blocks.forEach((n, i) => n.toggleAttribute("data-on", i === b));
        if (snapRef.current) snapRef.current.textContent = CHART_LABELS[b] ?? "";
        lastBlock = b;
      }
    };
    paint();
    gsap.to(proxy, {
      t: SWEEP_TO,
      ease: "sine.inOut",
      onUpdate: paint,
      scrollTrigger: { trigger: el.querySelector("[data-figure]"), start: "top 80%", end: "bottom 20%", scrub: 0.9 },
    });

    // figure drifts up a touch slower than the page (depth)
    gsap.fromTo(el.querySelector("[data-figure]"), { y: 80 }, { y: -40, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
    gsap.from(el.querySelectorAll("[data-copy]"), {
      y: 40,
      opacity: 0,
      stagger: 0.15,
      ease: "power2.out",
      scrollTrigger: { trigger: el.querySelector("[data-copy]"), start: "top 88%", end: "top 50%", scrub: 0.6 },
    });
  });

  return (
    <Chapter index="02" label="The problem" id="problem">
      <div ref={ref} className="pb-32 pt-20">
        <ChapterHeadline size="text-[124px]" className="max-w-[13ch]">
          {"Reading a strip by eye is a *guess.*"}
        </ChapterHeadline>

        <div className="mt-20 grid grid-cols-[1fr_1.15fr] items-start gap-16">
          <div>
            <div data-copy>
              <ChapterCopy>
                A reagent pad develops a continuous colour. The printed chart offers five or six blocks, so the reader has to snap a continuous signal to a
                category, under whatever light happens to be in the room, within a window that closes as the pad keeps reacting.
              </ChapterCopy>
            </div>
            <div data-copy>
              <ChapterCopy className="mt-5">
                Two readers of the same strip can disagree by a block. The same reader can disagree with themselves an hour later. The result is a categorical
                output with no record of how close the call was.
              </ChapterCopy>
            </div>
            <dl data-copy className="mt-12 grid grid-cols-3 gap-6 border-t border-[rgb(var(--lc-ivory-rgb)/0.14)] pt-6">
              {[
                ["Inter-observer", "Different readers, different blocks"],
                ["Lighting", "Warm, cool, dim — each shifts hue"],
                ["Timing", "Colour keeps developing after the window"],
              ].map(([t, d], i) => (
                <div key={t}>
                  <dt className="flex items-baseline gap-2">
                    <span className="t-serif text-[22px] italic text-[var(--lc-gold)]">{["i", "ii", "iii"][i]}</span>
                    <span className="t-eyebrow">{t}</span>
                  </dt>
                  <dd className="mt-2 text-[13.5px] leading-relaxed text-fg-3">{d}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div data-figure className="will-change-transform">
            <GlassTilt as="figure" className="p-9" max={5}>
              <figcaption className="t-eyebrow mb-7 flex items-center justify-between">
                <span>Chart blocks vs continuous signal</span>
                <span className="rounded-full border border-[rgb(var(--lc-ivory-rgb)/0.2)] px-2.5 py-0.5 text-[10px] text-fg-3">Illustrative</span>
              </figcaption>
              {/* discrete */}
              <div className="flex items-end gap-2">
                {CHART_BLOCKS.map((t, i) => (
                  <div key={t} className="flex flex-1 flex-col items-center gap-2">
                    <div data-block className="lc-block h-14 w-full rounded-[4px]" style={{ background: demoColor("glucose", t) }} data-on={i === 2 ? "" : undefined} />
                    <span className="font-mono text-[10px] text-fg-4">{CHART_LABELS[i]}</span>
                  </div>
                ))}
              </div>
              <div className="my-7 flex items-center gap-3">
                <span className="h-px flex-1 bg-[rgb(var(--lc-ivory-rgb)/0.12)]" />
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-4">
                  the eye snaps to <span ref={snapRef} className="text-[var(--film-cream)]">{CHART_LABELS[2]}</span>
                </span>
                <span className="h-px flex-1 bg-[rgb(var(--lc-ivory-rgb)/0.12)]" />
              </div>
              {/* continuous */}
              <div className="relative [container-type:inline-size]">
                <div className="h-14 w-full rounded-[4px] border border-[rgba(0,0,0,0.3)]" style={{ background: RAMP }} />
                <div
                  ref={markerRef}
                  className="absolute inset-y-[-8px] left-0 will-change-transform"
                  style={{ transform: `translate3d(${STATIC_AT * 100}cqw,0,0)` }}
                  aria-hidden
                >
                  <div className="h-full w-px bg-signal shadow-[0_0_10px_rgba(95,212,230,0.8)]" />
                  <div className="absolute -top-1 left-0 size-2 -translate-x-1/2 rotate-45 bg-signal" />
                  <span ref={readRef} className="absolute -bottom-8 left-0 -translate-x-1/2 whitespace-nowrap font-mono text-[11px] tracking-[0.08em] text-signal">
                    {rgbAt(STATIC_AT)}
                  </span>
                </div>
              </div>
              <div className="mt-14 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-fg-4">
                <span>Continuous colour at t = 120 s</span>
                <span>One number, with its uncertainty</span>
              </div>
            </GlassTilt>
          </div>
        </div>
      </div>
    </Chapter>
  );
}
