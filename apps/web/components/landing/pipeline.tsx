"use client";

import { useRef, type ReactNode } from "react";
import { StripScanner } from "@/components/strip/strip-scanner";
import { ANALYTES, demoColor, hexToRgb } from "@/lib/analytes";
import { cn } from "@/lib/utils";
import { Chapter } from "./chapter";
import { Perforations } from "./fx/sprockets";
import { SplitWords } from "./fx/split";
import { gsap, useScrollScene } from "./fx/use-scroll-scene";

const stroke = "rgb(var(--lc-ivory-rgb)/0.32)";
const signal = "var(--color-signal)";
const gold = "var(--lc-gold)";
const mono = { fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: 1.5 } as const;

const QC = ["Format", "Resolution", "Blur", "Overexposure", "Underexposure", "Strip visible", "Orientation", "Obstruction", "Pads visible"] as const;
const VEC_LEVELS = [0.2, 0.45, 0.5, 0.1, 0.15, 0.1, 0.3, 0.05, 0.25, 0.55] as const;
/** Illustrative 30-D vector: mean R,G,B of the synthetic demo ramp per pad. */
const VECTOR = ANALYTES.flatMap((a, i) => hexToRgb(demoColor(a.key, VEC_LEVELS[i] ?? 0.15)));
const RING_R = 58;

interface Step {
  title: string;
  body: string;
  visual: ReactNode;
}

const STEPS: Step[] = [
  {
    title: "Capture",
    body: "The strip sits in the enclosure under brightness-regulated LEDs. The Pi camera fires once. Exposure and white balance are fixed; nothing is auto.",
    visual: (
      <svg viewBox="0 0 320 170" className="h-[170px] w-[320px]">
        <rect x="40" y="22" width="240" height="120" rx="6" fill="none" stroke={stroke} />
        <rect x="60" y="40" width="200" height="84" rx="3" fill="none" stroke={stroke} strokeDasharray="3 4" />
        <circle cx="160" cy="82" r="18" fill="none" stroke={gold} strokeWidth="1.5" />
        <circle data-flash cx="160" cy="82" r="6" fill={gold} />
        <circle data-flash-ring cx="160" cy="82" r="18" fill="none" stroke={gold} strokeWidth="1" opacity="0" />
        <text x="40" y="162" {...mono} fill={stroke}>
          ISO FIXED · WB FIXED · LED REGULATED
        </text>
      </svg>
    ),
  },
  {
    title: "Wait 120 s",
    body: "Reagents need time. The device holds a fixed 120 s reaction window before it captures, so every strip is read at the same point in its development.",
    visual: (
      <svg viewBox="0 0 320 170" className="h-[170px] w-[320px]">
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * Math.PI * 2;
          const r1 = RING_R + 8;
          const r2 = RING_R + (i % 6 === 0 ? 16 : 12);
          const f = (n: number) => Math.round(n * 100) / 100;
          return <line key={i} x1={f(100 + Math.sin(a) * r1)} y1={f(80 - Math.cos(a) * r1)} x2={f(100 + Math.sin(a) * r2)} y2={f(80 - Math.cos(a) * r2)} stroke={stroke} />;
        })}
        <circle cx="100" cy="80" r={RING_R} fill="none" stroke="rgb(var(--lc-ivory-rgb)/0.1)" strokeWidth="3" />
        <circle data-arc cx="100" cy="80" r={RING_R} fill="none" stroke={gold} strokeWidth="3" strokeLinecap="round" pathLength={1} strokeDasharray="1 1" transform="rotate(-90 100 80)" />
        <text data-count x="100" y="88" textAnchor="middle" fontFamily="var(--font-serif)" fontSize="30" fill="var(--film-cream)">
          120
        </text>
        <text x="100" y="104" textAnchor="middle" {...mono} fill={stroke}>
          SECONDS
        </text>
        <text x="196" y="66" {...mono} fill={stroke}>
          REACTION WINDOW
        </text>
        <text x="196" y="82" {...mono} fill={gold}>
          FIXED · TIMED
        </text>
        <text x="196" y="98" {...mono} fill={stroke}>
          SAME POINT, EVERY STRIP
        </text>
      </svg>
    ),
  },
  {
    title: "Quality checks",
    body: "Nine whole-image checks run before any pad is read. A failure stops the run as an invalid image, the only place the console uses red.",
    visual: (
      <div className="w-[540px]">
        <div className="grid grid-cols-3 gap-x-6 gap-y-3">
          {QC.map((q) => (
            <div key={q} className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-fg-2">
              <span data-check className="grid size-4 place-items-center rounded-[3px] border border-[rgb(var(--lc-gold-rgb)/0.6)] text-[var(--lc-gold)]">
                <svg viewBox="0 0 10 10" className="size-2.5">
                  <path d="M2 5.2 4.2 7.4 8 2.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </span>
              {q}
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-4">
          <span className="size-1.5 rounded-full bg-fault" /> any fail → invalid image · no pad is analysed
        </div>
      </div>
    ),
  },
  {
    title: "Localise & segment",
    body: "OpenCV finds the strip outline, warps it flat and locates the ten pads. If the pad search fails, a fixed-geometry fallback uses the known slot position.",
    visual: <StripScanner width={500} />,
  },
  {
    title: "Extract colour",
    body: "Each pad yields a trimmed mean RGB and a CIELAB triplet, plus uniformity, glare and contrast scores. Ten pads × three channels form one 30-D vector.",
    visual: (
      <div className="w-[540px]">
        <div className="flex h-[110px] items-end gap-[3px]">
          {VECTOR.map((v, i) => (
            <span
              key={i}
              data-bar
              className={cn("w-full origin-bottom rounded-t-[2px] bg-signal", i % 3 === 2 && "mr-[6px]")}
              style={{ height: `${Math.max(6, (v / 255) * 100)}%`, opacity: [0.9, 0.6, 0.34][i % 3] }}
            />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-10 gap-[6px] font-mono text-[9px] tracking-[0.08em] text-fg-4">
          {ANALYTES.map((a) => (
            <span key={a.key} className="text-center">
              {a.short}
            </span>
          ))}
        </div>
        <div className="mt-4 flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-fg-4">
          <span>x ∈ ℝ³⁰ · R G B per pad · LAB alongside</span>
          <span className="text-fg-3">Synthetic · illustrative</span>
        </div>
      </div>
    ),
  },
  {
    title: "Calibrated regression",
    body: "A non-linear regression maps the features to a value per analyte, and only when a compatible calibration exists for that strip product. Otherwise the analyte reads “calibration required”, with no number.",
    visual: (
      <div className="flex items-center gap-8">
        <svg viewBox="0 0 260 150" className="h-[150px] w-[260px]">
          <line x1="20" y1="130" x2="250" y2="130" stroke={stroke} />
          <line x1="20" y1="130" x2="20" y2="14" stroke={stroke} />
          {[
            [40, 112],
            [72, 104],
            [104, 88],
            [136, 76],
            [168, 60],
            [200, 52],
            [232, 36],
          ].map(([x, y]) => (
            <circle key={x} data-pt cx={x} cy={y} r="3" fill="none" stroke={stroke} />
          ))}
          <path data-curve d="M28 118 C 96 102, 176 62, 246 30" fill="none" stroke={signal} strokeWidth="1.5" pathLength={1} strokeDasharray="1 1" />
          <text x="20" y="146" {...mono} fill={stroke}>
            FEATURES → VALUE
          </text>
        </svg>
        <div className="flex flex-col gap-3 font-mono text-[10px] uppercase tracking-[0.12em]">
          <div className="rounded-[8px] border border-[rgba(95,212,230,0.35)] px-3 py-2 text-signal">Compatible model → value + interval</div>
          <div className="rounded-[8px] border border-[rgb(var(--lc-ivory-rgb)/0.2)] px-3 py-2 text-fg-2">None → calibration required</div>
          <div className="text-fg-4">Synthetic-trained models: demo mode only</div>
        </div>
      </div>
    ),
  },
  {
    title: "Clinician review",
    body: "Every analyte carries a result state. A clinician reviews the run, can override with a reason, and signs off. Nothing leaves without a human.",
    visual: (
      <svg viewBox="0 0 320 170" className="h-[170px] w-[320px]">
        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(40 ${20 + i * 30})`}>
            <rect width="240" height="20" rx="3" fill="none" stroke={stroke} />
            <rect x="6" y="7" width="70" height="6" rx="1" fill={stroke} />
            <rect data-rv x="160" y="4" width="72" height="12" rx="3" fill="none" stroke={i === 1 ? gold : stroke} />
          </g>
        ))}
        <text x="40" y="162" {...mono} fill={stroke}>
          STATE PER ANALYTE · HUMAN SIGN-OFF
        </text>
      </svg>
    ),
  },
  {
    title: "Report",
    body: "A structured report ties the results to the patient ID and timestamp, and records the model, its version and the reviewer. Export as PDF or JSON.",
    visual: (
      <div className="flex items-center gap-8">
        <div className="relative h-[160px] w-[124px] rounded-[6px] border border-[rgb(var(--lc-ivory-rgb)/0.3)] bg-[rgb(var(--lc-ivory-rgb)/0.04)] p-3">
          <div className="h-2 w-12 rounded-[1px] bg-[rgb(var(--lc-ivory-rgb)/0.5)]" />
          {[0.9, 0.7, 0.8, 0.6, 0.85, 0.5, 0.75, 0.65].map((w, i) => (
            <div key={i} data-line className="mt-2.5 h-[3px] origin-left rounded-[1px] bg-[rgb(var(--lc-ivory-rgb)/0.22)]" style={{ width: `${w * 100}%` }} />
          ))}
          <div className="absolute bottom-3 right-3 h-5 w-10 rounded-[2px] border border-[rgb(var(--lc-gold-rgb)/0.55)]" />
        </div>
        <ul className="flex flex-col gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-3">
          {["Patient ID · timestamp", "Per-analyte state", "Model · version", "Reviewer · sign-off", "PDF · JSON"].map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="h-px w-3 bg-[var(--lc-gold)]" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
];

const N = STEPS.length;
const HOLD = 1;
const MOVE = 0.9;
const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Chapter 04 — the pipeline as a pinned strip of film. Scroll advances it a
 * frame at a time (hold, pull-down, hold), like a projector's claw; each
 * frame's figure develops while it sits in the gate.
 */
export function Pipeline() {
  const pinRef = useRef<HTMLDivElement>(null);

  const reduced = useScrollScene(pinRef, (pin) => {
    const track = pin.querySelector<HTMLElement>("[data-track]")!;
    const frames = gsap.utils.toArray<HTMLElement>("[data-frame]", pin);
    const posOf = (i: number) => {
      const f = frames[i]!;
      // layout offset inside the track (both rects carry the same transform, so it cancels)
      const left = f.getBoundingClientRect().left - track.getBoundingClientRect().left;
      return pin.clientWidth / 2 - (left + f.offsetWidth / 2);
    };

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: {
        trigger: pin,
        start: "top top",
        end: () => `+=${Math.round(window.innerHeight * 0.62 * N)}`,
        pin: true,
        scrub: 0.7,
        invalidateOnRefresh: true,
      },
    });

    tl.fromTo(track, { x: () => posOf(0) }, { x: () => posOf(0), duration: HOLD }, 0);
    gsap.set(frames.slice(1), { opacity: 0.32 });

    const develop = (i: number, at: number) => {
      const f = frames[i]!;
      const q = (s: string) => f.querySelectorAll(s);
      switch (i) {
        case 0:
          tl.fromTo(q("[data-flash]"), { opacity: 0.25 }, { opacity: 1, duration: 0.15 }, at + 0.2);
          tl.fromTo(q("[data-flash-ring]"), { opacity: 0.9, scale: 1, transformOrigin: "50% 50%" }, { opacity: 0, scale: 2.4, duration: 0.5, ease: "power2.out" }, at + 0.25);
          break;
        case 1: {
          const counter = f.querySelector("[data-count]");
          const o = { s: 0 };
          tl.fromTo(q("[data-arc]"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: HOLD * 0.85 }, at);
          tl.fromTo(
            o,
            { s: 0 },
            {
              s: 120,
              duration: HOLD * 0.85,
              onUpdate: () => {
                if (counter) counter.textContent = String(Math.round(o.s));
              },
            },
            at,
          );
          break;
        }
        case 2:
          tl.fromTo(q("[data-check]"), { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, stagger: 0.07, duration: 0.2, ease: "back.out(2)" }, at);
          break;
        case 4:
          tl.fromTo(q("[data-bar]"), { scaleY: 0 }, { scaleY: 1, stagger: 0.02, duration: 0.25, ease: "power2.out" }, at);
          break;
        case 5:
          tl.fromTo(q("[data-pt]"), { opacity: 0 }, { opacity: 1, stagger: 0.06, duration: 0.15 }, at);
          tl.fromTo(q("[data-curve]"), { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.6 }, at + 0.25);
          break;
        case 6:
          tl.fromTo(q("[data-rv]"), { opacity: 0.2 }, { opacity: 1, stagger: 0.12, duration: 0.15 }, at + 0.1);
          break;
        case 7:
          tl.fromTo(q("[data-line]"), { scaleX: 0 }, { scaleX: 1, stagger: 0.05, duration: 0.2, ease: "power2.out" }, at);
          break;
      }
    };
    develop(0, 0);

    for (let i = 1; i < N; i++) {
      const at = HOLD + (i - 1) * (MOVE + HOLD);
      tl.to(track, { x: () => posOf(i), duration: MOVE, ease: "power3.inOut" }, at);
      tl.to(frames[i - 1]!, { opacity: 0.32, duration: MOVE * 0.6 }, at);
      tl.to(frames[i]!, { opacity: 1, duration: MOVE * 0.6 }, at + MOVE * 0.4);
      tl.to("[data-odo]", { yPercent: (-100 / N) * i, duration: MOVE, ease: "power3.inOut" }, at);
      tl.to("[data-titles]", { yPercent: (-100 / N) * i, duration: MOVE, ease: "power3.inOut" }, at);
      const tick = pin.querySelectorAll("[data-tick]")[i]!;
      tl.to(tick, { scaleY: 1.8, duration: 0.2 }, at + MOVE * 0.5);
      tl.to(tick.querySelector("[data-tick-on]"), { opacity: 1, duration: 0.2 }, at + MOVE * 0.5);
      // a beat of shutter as the claw pulls the next frame down
      tl.fromTo("[data-shutter]", { opacity: 0 }, { opacity: 0.5, duration: MOVE * 0.25, yoyo: true, repeat: 1, ease: "power1.inOut" }, at + MOVE * 0.25);
      develop(i, at + MOVE * 0.8);
    }
    tl.to({}, { duration: HOLD * 0.8 });

    gsap.fromTo(
      pin.querySelectorAll("[data-head] [data-w]"),
      { yPercent: 115, opacity: 0 },
      { yPercent: 0, opacity: 1, stagger: 0.12, ease: "power3.out", scrollTrigger: { trigger: pin, start: "top 85%", end: "top 25%", scrub: 0.8 } },
    );
    gsap.from("[data-strip]", { opacity: 0, y: 60, scrollTrigger: { trigger: pin, start: "top 75%", end: "top 15%", scrub: 0.8 } });
  });

  const frameCells = STEPS.map((s, i) => (
    <article key={s.title} data-frame className={cn("lc-frame relative flex shrink-0 flex-col justify-between", reduced ? "w-full" : "h-[440px] w-[700px]")}>
      <div>
        <div className="flex items-baseline gap-4">
          <span className="t-serif text-[56px] leading-none text-[var(--lc-gold)]">{pad2(i + 1)}</span>
          <h3 className="t-serif text-[46px] leading-none">{s.title}</h3>
        </div>
        <p className="mt-5 max-w-[56ch] text-[15.5px] leading-[1.6] text-fg-2">{s.body}</p>
      </div>
      <div className="glass-inset mt-6 flex h-[196px] items-center justify-center px-6">{s.visual}</div>
    </article>
  ));

  if (reduced) {
    return (
      <Chapter index="05" label="Pipeline" id="pipeline">
        <div className="pb-24 pt-16">
          <h2 className="t-serif text-[96px]">
            Eight frames. <em>No shortcuts.</em>
          </h2>
          <div className="mt-14 grid grid-cols-2 gap-6">{frameCells}</div>
        </div>
      </Chapter>
    );
  }

  return (
    <Chapter index="05" label="Pipeline" id="pipeline" bleed>
      <div ref={pinRef} className="relative flex h-screen w-full flex-col justify-center overflow-hidden">
        {/* header */}
        <div data-head className="flex items-end justify-between px-10">
          <h2 className="t-serif text-[92px] leading-[0.92]">
            <SplitWords text="Eight frames. *No shortcuts.*" />
          </h2>
          <div className="flex items-end gap-6 pb-2">
            <div className="text-right">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-fg-3">Frame in gate</div>
              <div className="mt-1 h-[26px] overflow-hidden">
                <div data-titles className="flex flex-col">
                  {STEPS.map((s) => (
                    <span key={s.title} className="t-serif block h-[26px] text-[24px] italic leading-[26px]">
                      {s.title}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-baseline">
              <span className="relative inline-block h-[72px] overflow-hidden">
                <span data-odo className="flex flex-col">
                  {STEPS.map((_, i) => (
                    <span key={i} className="t-serif block h-[72px] text-[72px] leading-[72px] text-[var(--lc-gold)]">
                      {pad2(i + 1)}
                    </span>
                  ))}
                </span>
              </span>
              <span className="ml-2 font-mono text-[12px] text-fg-3">/ {pad2(N)}</span>
            </div>
          </div>
        </div>

        {/* the strip */}
        <div data-strip className="relative mt-10">
          <div data-track className="lc-filmbase relative flex w-max flex-col will-change-transform">
            <Perforations axis="x" className="h-[30px] w-full" />
            <div className="flex gap-[56px] px-[50vw] py-3">
              {frameCells.map((cell, i) => (
                <div key={i} className="relative">
                  {cell}
                  <span className="lc-edgeprint absolute -top-[13px] left-6">VITRA 5219 ▸ {pad2(i + 1)}A</span>
                  <span className="lc-edgeprint absolute -bottom-[13px] right-6">KJS-HC-03 · 24 FPS</span>
                </div>
              ))}
            </div>
            <Perforations axis="x" className="h-[30px] w-full" />
          </div>
          {/* projector gate: fixed brackets the frames advance through */}
          <div className="pointer-events-none absolute left-1/2 top-[30px] h-[calc(100%-60px)] w-[740px] -translate-x-1/2" aria-hidden>
            <span className="lc-gate-corner left-0 top-0" />
            <span className="lc-gate-corner right-0 top-0 rotate-90" />
            <span className="lc-gate-corner bottom-0 right-0 rotate-180" />
            <span className="lc-gate-corner bottom-0 left-0 -rotate-90" />
            <span data-shutter className="absolute inset-0 rounded-[14px] bg-[rgba(6,6,7,0.9)] opacity-0" />
          </div>
        </div>

        {/* ticks */}
        <div className="mt-8 flex items-center justify-center gap-2" aria-hidden>
          {STEPS.map((s, i) => (
            <span key={s.title} data-tick className="relative h-[6px] w-[2px] origin-bottom overflow-hidden rounded-full bg-[rgb(var(--lc-ivory-rgb)/0.25)]">
              <span data-tick-on className={cn("absolute inset-0 bg-[var(--lc-gold)]", i === 0 ? "opacity-100" : "opacity-0")} />
            </span>
          ))}
        </div>
      </div>
    </Chapter>
  );
}
