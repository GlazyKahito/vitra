"use client";

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SplitWords } from "./fx/split";
import { gsap, ScrollTrigger, useScrollScene } from "./fx/use-scroll-scene";

export interface ChapterProps {
  /** Two-digit scene number, e.g. "02". */
  index: string;
  /** Short chapter title shown on the slate, e.g. "The problem". */
  label: string;
  id?: string;
  className?: string;
  /** Remove the horizontal padding (full-bleed chapters). */
  bleed?: boolean;
  /** Take number on the slate. Default 1. */
  take?: number;
  children: ReactNode;
}

/** Page position as hh:mm:ss:ff at 24 fps, from how far down the page we are. */
function scrollTimecode(px: number): string {
  const frames = Math.max(0, Math.floor(px / 3));
  const ff = frames % 24;
  const s = Math.floor(frames / 24);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor(s / 60) % 60)}:${p(s % 60)}:${p(ff)}`;
}

/**
 * A landing chapter, opened by a film slate:
 * clapper · SCENE 02 · TAKE 1 · serif title · gold rule · running timecode.
 * Transparent — the live silk background shows through.
 */
export function Chapter({ index, label, id, className, bleed, take = 1, children }: ChapterProps) {
  const ref = useRef<HTMLElement>(null);
  const tcRef = useRef<HTMLSpanElement>(null);

  const reduced = useScrollScene(ref, (el) => {
    const slate = el.querySelector<HTMLElement>("[data-slate]");
    if (!slate) return;
    const tl = gsap.timeline({ scrollTrigger: { trigger: slate, start: "top 96%", end: "top 62%", scrub: 0.6 } });
    tl.fromTo(slate.querySelector("[data-slate-rule]"), { scaleX: 0 }, { scaleX: 1, ease: "none" }, 0);
    tl.from(slate.querySelectorAll("[data-slate-item]"), { yPercent: 120, opacity: 0, stagger: 0.06, ease: "power2.out" }, 0);
    tl.fromTo(slate.querySelector("[data-slate-clap]"), { rotate: -24 }, { rotate: 0, ease: "back.out(3)", duration: 0.35 }, 0.25);

    const write = () => {
      if (tcRef.current) tcRef.current.textContent = scrollTimecode(window.scrollY);
    };
    write();
    ScrollTrigger.create({ trigger: el, start: "top bottom", end: "bottom top", onUpdate: write });
  });

  return (
    <section id={id} ref={ref} className={cn("relative", bleed ? "" : "px-10", className)}>
      <div data-slate className={cn("flex items-center gap-5 pt-10", bleed && "px-10")}>
        <div className="relative h-[22px] w-[34px] shrink-0" aria-hidden>
          <span data-slate-clap className="lc-clap absolute inset-x-0 top-0 h-[7px] origin-bottom-left" />
          <span className="absolute inset-x-0 bottom-0 h-[13px] rounded-[2px] border border-[rgb(var(--lc-ivory-rgb)/0.35)]" />
        </div>
        <div className="flex items-baseline gap-3 overflow-hidden">
          <span data-slate-item className="inline-block font-mono text-[11px] tracking-[0.18em] text-[var(--lc-gold)]">
            SCENE {index}
          </span>
          <span data-slate-item className="inline-block font-mono text-[11px] tracking-[0.18em] text-fg-4">
            · TAKE {take}
          </span>
          <span data-slate-item className="t-serif ml-2 inline-block text-[26px] italic leading-none">
            {label}
          </span>
        </div>
        <div data-slate-rule className="film-rule h-px flex-1 origin-left" />
        <div className="flex items-baseline gap-4 overflow-hidden font-mono text-[10.5px] tracking-[0.16em] text-fg-4">
          <span data-slate-item className="inline-block">
            VITRA · 24 FPS
          </span>
          <span data-slate-item ref={tcRef} className="inline-block tabular-nums text-fg-3" suppressHydrationWarning>
            {reduced ? `00:0${Number(index) % 10}:00:00` : "--:--:--:--"}
          </span>
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * Chapter headline: large Instrument Serif in cream, words rising out of masks
 * as the line scrolls into the gate (scrubbed). `*word*` sets italic.
 */
export function ChapterHeadline({ children, className, size = "text-[104px]" }: { children: ReactNode; className?: string; size?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useScrollScene(ref, (el) => {
    const words = el.querySelectorAll("[data-w]");
    gsap.fromTo(
      words,
      { yPercent: 118, rotate: 3, opacity: 0.2 },
      { yPercent: 0, rotate: 0, opacity: 1, ease: "power3.out", stagger: 0.12, scrollTrigger: { trigger: el, start: "top 92%", end: "top 52%", scrub: 0.8 } },
    );
  });
  return (
    <h2 ref={ref} className={cn("t-serif max-w-[16ch] leading-[0.94] tracking-[-0.02em]", size, className)}>
      {typeof children === "string" ? <SplitWords text={children} /> : children}
    </h2>
  );
}

export function ChapterCopy({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("max-w-[52ch] text-[17.5px] leading-[1.65] text-fg-2", className)}>{children}</p>;
}
