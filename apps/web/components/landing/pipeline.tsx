"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { StripScanner } from "@/components/strip/strip-scanner";
import { Chapter } from "./chapter";

interface Stage {
  n: string;
  title: string;
  body: string;
  visual: ReactNode;
}

const stroke = "var(--color-fg-4)";
const signal = "var(--color-signal)";

const STAGES: Stage[] = [
  {
    n: "01",
    title: "Capture",
    body: "The strip sits in the enclosure under regulated LEDs. After the 120 s reaction window, the Pi camera fires once. Exposure and white balance are fixed; nothing is auto.",
    visual: (
      <svg viewBox="0 0 320 180" className="h-[180px] w-[320px]">
        <rect x="40" y="30" width="240" height="120" rx="6" fill="none" stroke={stroke} />
        <rect x="60" y="48" width="200" height="84" rx="3" fill="none" stroke={stroke} strokeDasharray="3 4" />
        <circle cx="160" cy="90" r="18" fill="none" stroke={signal} strokeWidth="1.5" />
        <circle cx="160" cy="90" r="6" fill={signal} />
        <text x="40" y="168" fontFamily="var(--font-mono)" fontSize="9" letterSpacing="1.5" fill={stroke}>
          ISO FIXED · WB FIXED · t = 120 s
        </text>
      </svg>
    ),
  },
  {
    n: "02",
    title: "Segmentation",
    body: "OpenCV localises the strip outline, then finds the ten pads. If the pad search fails, a fixed-geometry fallback uses the known slot position.",
    visual: <StripScanner width={520} />,
  },
  {
    n: "03",
    title: "Colour extraction",
    body: "Each pad yields a trimmed mean RGB and a CIELAB triplet, plus uniformity, glare and contrast scores. Pads that fail are marked indeterminate, not guessed.",
    visual: (
      <svg viewBox="0 0 320 180" className="h-[180px] w-[320px]">
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${40 + i * 90} 40)`}>
            <rect width="60" height="60" rx="3" fill="none" stroke={stroke} />
            <rect x="12" y="12" width="36" height="36" rx="2" fill="none" stroke={signal} strokeDasharray="2 3" />
            <text x="0" y="82" fontFamily="var(--font-mono)" fontSize="9" letterSpacing="1" fill={stroke}>
              {["R  G  B", "L* a* b*", "Q 0.9x"][i]}
            </text>
          </g>
        ))}
        <text x="40" y="168" fontFamily="var(--font-mono)" fontSize="9" letterSpacing="1.5" fill={stroke}>
          TRIMMED MEAN · PER PAD
        </text>
      </svg>
    ),
  },
  {
    n: "04",
    title: "Calibration",
    body: "A calibration model maps colour features to a value per analyte and strip product. Models trained on synthetic data are allowed only in demo mode; no seeded model is validated.",
    visual: (
      <svg viewBox="0 0 320 180" className="h-[180px] w-[320px]">
        <line x1="40" y1="140" x2="290" y2="140" stroke={stroke} />
        <line x1="40" y1="140" x2="40" y2="30" stroke={stroke} />
        {[
          [60, 120],
          [95, 112],
          [130, 96],
          [165, 84],
          [200, 66],
          [235, 58],
          [270, 44],
        ].map(([x, y]) => (
          <circle key={x} cx={x} cy={y} r="3" fill="none" stroke={stroke} />
        ))}
        <path d="M50 126 C 120 110, 200 70, 285 40" fill="none" stroke={signal} strokeWidth="1.5" />
        <text x="40" y="168" fontFamily="var(--font-mono)" fontSize="9" letterSpacing="1.5" fill={stroke}>
          FEATURE → VALUE · REFERENCE RANGE BOUNDED
        </text>
      </svg>
    ),
  },
  {
    n: "05",
    title: "Review",
    body: "Every analyte carries a result state. A clinician reviews the run, can override with a reason, and signs off. The report records who, when, and under which model.",
    visual: (
      <svg viewBox="0 0 320 180" className="h-[180px] w-[320px]">
        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform={`translate(40 ${36 + i * 28})`}>
            <rect width="240" height="18" rx="2" fill="none" stroke={stroke} />
            <rect x="6" y="6" width="70" height="6" rx="1" fill={stroke} opacity="0.6" />
            <rect x="160" y="4" width="70" height="10" rx="2" fill="none" stroke={i === 1 ? signal : stroke} />
          </g>
        ))}
        <text x="40" y="168" fontFamily="var(--font-mono)" fontSize="9" letterSpacing="1.5" fill={stroke}>
          STATE PER ANALYTE · HUMAN SIGN-OFF
        </text>
      </svg>
    ),
  },
];

/** Chapter 04 — pinned horizontal scrub through the five pipeline stages. */
export function Pipeline() {
  const pinRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const pin = pinRef.current;
    const track = trackRef.current;
    if (!pin || !track || reduced) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      const distance = () => track.scrollWidth - pin.clientWidth;
      gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: pin,
          start: "top top",
          end: () => `+=${distance()}`,
          pin: true,
          scrub: 0.6,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            if (progressRef.current) progressRef.current.style.transform = `scaleX(${self.progress})`;
          },
        },
      });
    }, pin);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <Chapter index="04" label="Pipeline" id="pipeline" bleed>
      <div ref={pinRef} className={reduced ? "w-full" : "h-screen w-full overflow-hidden"}>
        <div className="flex items-end justify-between px-10 pt-10">
          <h2 className="t-display text-[56px]">Five stages. No shortcuts.</h2>
          <div className="w-[240px]">
            <div className="mb-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-fg-4">
              <span>Capture</span>
              <span>Review</span>
            </div>
            <div className="h-px w-full bg-line">
              <div ref={progressRef} className="h-px origin-left bg-signal" style={{ transform: reduced ? "scaleX(1)" : "scaleX(0)" }} />
            </div>
          </div>
        </div>

        <div ref={trackRef} className={reduced ? "flex flex-wrap gap-8 px-10 py-14" : "flex gap-12 px-10 py-14 will-change-transform"}>
          {STAGES.map((s) => (
            <article key={s.n} className="flex w-[640px] shrink-0 flex-col justify-between border-l border-line pl-8" style={{ minHeight: reduced ? undefined : "calc(100vh - 260px)" }}>
              <div>
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[13px] tabular-nums text-signal">{s.n}</span>
                  <h3 className="font-display text-[34px] font-semibold tracking-[-0.03em]">{s.title}</h3>
                </div>
                <p className="mt-5 max-w-[48ch] text-[16px] leading-[1.6] text-fg-2">{s.body}</p>
              </div>
              <div className="mt-10 flex items-center">{s.visual}</div>
            </article>
          ))}
          <div className="w-10 shrink-0" aria-hidden />
        </div>
      </div>
    </Chapter>
  );
}
