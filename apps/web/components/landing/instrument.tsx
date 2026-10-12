"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/utils";
import { Chapter } from "./chapter";

const FRAMES = [
  { src: "/media/prototype-1.jpg", title: "Opaque enclosure", body: "A sealed, matte-black housing. Ambient light never reaches the strip; every photon on the pad comes from the device." },
  { src: "/media/prototype-2.jpg", title: "Touchscreen on the upper face", body: "A Raspberry Pi 5 drives a front-mounted display for the operator: insert, wait, review." },
  { src: "/media/prototype-3.jpg", title: "Strip slot at the base", body: "The strip slides in handle-first along a fixed track so the ten pads land at a known position relative to the camera." },
  { src: "/media/prototype-4.jpg", title: "Timed, lit, captured", body: "Brightness-regulated LED strips and a Pi camera; the capture fires after a 120 s timed reaction." },
] as const;

const CALLOUTS = ["Raspberry Pi 5", "Pi camera", "Brightness-regulated LED strips", "Opaque enclosure", "120 s timed reaction"] as const;

/** Chapter 03 — the instrument. Pinned section; the four prototype photos cross-fade with scroll. */
export function Instrument() {
  const pinRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = pinRef.current;
    if (!el || reduced) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: el,
        start: "top top",
        end: () => `+=${FRAMES.length * 70}%`,
        pin: true,
        scrub: true,
        onUpdate: (self) => {
          const idx = Math.min(FRAMES.length - 1, Math.floor(self.progress * FRAMES.length));
          setActive((prev) => (prev === idx ? prev : idx));
        },
      });
    }, el);
    return () => ctx.revert();
  }, [reduced]);

  // Under reduced motion: a static sticky layout with all four frames stacked in a grid.
  if (reduced) {
    return (
      <Chapter index="03" label="The instrument" id="instrument" bleed>
        <div className="grid grid-cols-[1fr_1.2fr] gap-10 px-10 py-20">
          <aside className="sticky top-24 self-start">
            <h2 className="t-display text-[56px]">A box that removes the room.</h2>
            <CalloutList />
          </aside>
          <div className="grid grid-cols-2 gap-3">
            {FRAMES.map((f) => (
              <figure key={f.src} className="relative aspect-square overflow-hidden rounded-[var(--radius-sm)] border border-line">
                <Image src={f.src} alt={f.title} fill sizes="40vw" className="object-cover" />
              </figure>
            ))}
            <figcaption className="col-span-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-4">Prototype enclosure — KJS-HC-03 use-case document, Fig. 1</figcaption>
          </div>
        </div>
      </Chapter>
    );
  }

  return (
    <Chapter index="03" label="The instrument" id="instrument" bleed>
      <div ref={pinRef} className="relative h-screen w-full overflow-hidden">
        {/* photo stack */}
        <div className="absolute inset-0">
          {FRAMES.map((f, i) => (
            <div key={f.src} className={cn("absolute inset-0 transition-opacity duration-700 ease-out", i === active ? "opacity-100" : "opacity-0")} aria-hidden={i !== active}>
              <Image src={f.src} alt={f.title} fill priority={i === 0} sizes="100vw" className="object-cover object-center" />
              <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,6,7,0.92)_0%,rgba(6,6,7,0.55)_45%,rgba(6,6,7,0.15)_100%)]" />
              <div className="absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(180deg,transparent,rgba(6,6,7,0.9))]" />
            </div>
          ))}
        </div>

        {/* copy */}
        <div className="relative z-10 flex h-full flex-col justify-between px-10 pb-10 pt-20">
          <div className="max-w-[560px]">
            <h2 className="t-display text-[56px]">A box that removes the room.</h2>
            <div className="relative mt-8 h-[120px]">
              {FRAMES.map((f, i) => (
                <div key={f.src} className={cn("absolute inset-0 transition-all duration-500", i === active ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0")} aria-hidden={i !== active}>
                  <div className="t-eyebrow mb-2">
                    Frame {String(i + 1).padStart(2, "0")} / {String(FRAMES.length).padStart(2, "0")}
                  </div>
                  <h3 className="text-[22px] font-medium tracking-[-0.02em] text-fg">{f.title}</h3>
                  <p className="mt-2 max-w-[44ch] text-[15px] leading-relaxed text-fg-2">{f.body}</p>
                </div>
              ))}
            </div>
            <CalloutList />
          </div>

          <div className="flex items-end justify-between">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-3">Prototype enclosure — KJS-HC-03 use-case document, Fig. 1</div>
            <div className="flex items-center gap-1.5" aria-hidden>
              {FRAMES.map((f, i) => (
                <span key={f.src} className={cn("h-px w-8 transition-colors duration-300", i === active ? "bg-signal" : "bg-line-strong")} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </Chapter>
  );
}

function CalloutList() {
  return (
    <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
      {CALLOUTS.map((c, i) => (
        <li key={c} className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-fg-3">
          <span className="tabular-nums text-signal">{String(i + 1).padStart(2, "0")}</span>
          {c}
        </li>
      ))}
    </ul>
  );
}
