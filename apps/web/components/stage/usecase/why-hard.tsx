"use client";

import { useRef } from "react";
import { GlassTilt } from "@/components/stage/glass-tilt";
import { Chapter, ChapterCopy, ChapterHeadline } from "@/components/landing/chapter";
import { gsap, useScrollScene } from "@/components/landing/fx/use-scroll-scene";
import { ANALYTES, hexToRgb, mixHex } from "@/lib/analytes";
import { useHydrated } from "./use-hydrated";

const GOLD = "var(--lux-gold, #c9a96e)";

/* ── the drawn strip (illustrative only) ─────────────────────────────────── */

/** Where along each demo ramp the drawn pads sit. Purely decorative — no concentration is implied. */
// jewel tones (deep end of each synthetic ramp, warmed with champagne) — the same palette as the homescreen
const PADS = ANALYTES.map((a) => ({ key: a.key, short: a.short, hex: mixHex(a.demoRamp[2], "#ebdab0", 0.28) }));

const VB_W = 520;
const VB_H = 300;
const C = { x: VB_W / 2, y: VB_H / 2 };
const R_NORM = Math.hypot(C.x, C.y);
/** Barrel coefficient for the "phone" render: points far from centre are pulled in, straight lines bow. */
const K_BARREL = 0.2;

const STRIP = { x: 34, y: 128, w: 452, h: 44 };
const HANDLE_W = 74;
const PAD = { x0: STRIP.x + HANDLE_W + 6, w: 30, gap: 7, inset: 7 };

type Pt = [number, number];

function barrel([x, y]: Pt, k: number): Pt {
  const dx = x - C.x;
  const dy = y - C.y;
  const r2 = (dx * dx + dy * dy) / (R_NORM * R_NORM);
  const s = 1 - k * r2;
  return [C.x + dx * s, C.y + dy * s];
}

/** A rectangle sampled along its edges and pushed through the lens model, as an SVG path. */
function rectPath(x: number, y: number, w: number, h: number, k: number, n = 10): string {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) pts.push([x + (w * i) / n, y]);
  for (let i = 1; i <= n; i++) pts.push([x + w, y + (h * i) / n]);
  for (let i = n - 1; i >= 0; i--) pts.push([x + (w * i) / n, y + h]);
  for (let i = n - 1; i > 0; i--) pts.push([x, y + (h * i) / n]);
  return (
    pts
      .map((p, i) => {
        const [px, py] = barrel(p, k);
        return `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`;
      })
      .join("") + "Z"
  );
}

function linePath(a: Pt, b: Pt, k: number, n = 24): string {
  const out: string[] = [];
  for (let i = 0; i <= n; i++) {
    const [px, py] = barrel([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n], k);
    out.push(`${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`);
  }
  return out.join("");
}

const toHex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;

/** Tungsten cast + auto white balance overshoot + falloff toward the frame edge, as a phone would record it. */
function roomLight(hex: string, x: number): string {
  const [r, g, b] = hexToRgb(hex);
  const d = (x - C.x) / C.x;
  const gain = 1.08 - 0.34 * d * d;
  return toHex(r * 1.1 * gain, g * 0.95 * gain, b * 0.7 * gain);
}

function padX(i: number) {
  return PAD.x0 + i * (PAD.w + PAD.gap);
}

const GRID_STEP = 26;
const GRID_X = Array.from({ length: Math.floor(VB_W / GRID_STEP) + 1 }, (_, i) => i * GRID_STEP);
const GRID_Y = Array.from({ length: Math.floor(VB_H / GRID_STEP) + 1 }, (_, i) => i * GRID_STEP);

function StripScene({ k, cast }: { k: number; cast: boolean }) {
  const handleFill = cast ? roomLight("#2c2a25", STRIP.x + HANDLE_W / 2) : "#2c2a25";
  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className="absolute inset-0 h-full w-full" aria-hidden>
      {/* bench grid — shows the lens bowing straight lines */}
      <g stroke={cast ? "rgba(255,214,160,0.14)" : "rgba(242,235,221,0.08)"} strokeWidth="1" fill="none">
        {GRID_X.map((x) => (
          <path key={`x${x}`} d={linePath([x, -10], [x, VB_H + 10], k)} />
        ))}
        {GRID_Y.map((y) => (
          <path key={`y${y}`} d={linePath([-10, y], [VB_W + 10, y], k)} />
        ))}
      </g>
      {/* strip body + handle */}
      <path d={rectPath(STRIP.x, STRIP.y, STRIP.w, STRIP.h, k, 24)} fill={cast ? "#2a261e" : "#1d211f"} stroke="#c9a96e" strokeOpacity={0.55} strokeWidth={1.2} opacity={0.95} />
      <path d={rectPath(STRIP.x, STRIP.y, HANDLE_W, STRIP.h, k)} fill={handleFill} />
      {PADS.map((p, i) => {
        const x = padX(i);
        return <path key={p.key} d={rectPath(x, STRIP.y + PAD.inset, PAD.w, STRIP.h - PAD.inset * 2, k, 6)} fill={cast ? roomLight(p.hex, x + PAD.w / 2) : p.hex} />;
      })}
    </svg>
  );
}

const GLU_X = padX(0) + PAD.w / 2;
const GLU_CLEAN = hexToRgb(PADS[0]!.hex);
const GLU_ROOM = hexToRgb(roomLight(PADS[0]!.hex, GLU_X));
const fmtRgb = (c: readonly number[]) => `RGB ${c.map((v) => String(Math.round(v)).padStart(3, " ")).join(" / ")}`;

const CUES = ["Illumination", "White balance", "Lens distortion", "Hand angle"] as const;

/* ── copy ───────────────────────────────────────────────────────────────── */

const REASONS = [
  {
    t: "Uncontrolled light",
    d: "Ambient light changes from room to room and hour to hour. Every change shifts the recorded hue of every pad, and the phone's automatic white balance moves it again.",
  },
  {
    t: "Lens distortion",
    d: "Wide phone optics bow straight lines and darken the frame toward its edges, so pads at the ends of the strip are recorded differently from pads in the middle.",
  },
  {
    t: "A moving target",
    d: "Pads change colour 60–120 s after urine contact. A capture taken too early or too late reads a different colour, so the box waits a fixed 120 s before it triggers.",
  },
  {
    t: "Colours that depend on each other",
    d: "The colour-to-concentration relationship is non-linear and the pads are not independent. pH, for one, affects other readings. The use case treats this as one multidimensional problem, not ten lookups.",
  },
] as const;

const CONDITIONS = ["Diabetes", "Urinary tract infections", "Kidney disease", "Liver disorders"] as const;
const BENEFICIARIES = [
  ["Patients", "having routine urinalysis at the point of care"],
  ["Clinicians & pathologists", "who review and sign off results"],
  ["Strip manufacturers", "validating their products"],
  ["Rural & resource-limited providers", "without laboratory infrastructure"],
] as const;

/* ── chapter ────────────────────────────────────────────────────────────── */

export interface UseCaseChapterProps {
  /** Two-digit scene number shown on the slate. */
  index?: string;
}

/**
 * Why a phone can't do this. A strip photographed in room light degrades as
 * you scroll — warm cast, vignette, barrel distortion, a tilted hand — next
 * to the same strip in the sealed box under regulated LEDs. Then the four
 * reasons, the 30-D vector, and who the screening is for.
 */
export function WhyHard({ index = "09" }: UseCaseChapterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const rgbRef = useRef<HTMLSpanElement>(null);

  const hydrated = useHydrated();
  const motionOff = useScrollScene(ref, (el) => {
    const fig = el.querySelector<HTMLElement>("[data-compare]")!;
    const cues = Array.from(el.querySelectorAll<HTMLElement>("[data-cue]"));
    const proxy = { p: 0 };
    let lastCue = -1;
    const paint = () => {
      const p = proxy.p;
      if (rgbRef.current) rgbRef.current.textContent = fmtRgb(GLU_CLEAN.map((v, i) => v + ((GLU_ROOM[i] ?? v) - v) * p));
      const on = Math.min(CUES.length, Math.floor(p * (CUES.length + 0.2)));
      if (on !== lastCue) {
        cues.forEach((c, i) => c.toggleAttribute("data-on", i < on));
        lastCue = on;
      }
    };
    paint();

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: fig, start: "top 78%", end: "bottom 30%", scrub: 0.8 },
    });
    tl.to(proxy, { p: 1, duration: 1, onUpdate: paint }, 0);
    tl.fromTo(fig.querySelector("[data-phone-bad]"), { opacity: 0 }, { opacity: 1, duration: 0.7 }, 0.05);
    tl.fromTo(fig.querySelector("[data-phone-good]"), { opacity: 1 }, { opacity: 0, duration: 0.5 }, 0.25);
    tl.fromTo(fig.querySelector("[data-phone-cast]"), { opacity: 0 }, { opacity: 1, duration: 0.6 }, 0);
    tl.fromTo(fig.querySelector("[data-phone-vig]"), { opacity: 0 }, { opacity: 1, duration: 0.7 }, 0.2);
    tl.fromTo(fig.querySelector("[data-phone-glare]"), { opacity: 0, xPercent: -60 }, { opacity: 0.85, xPercent: 40, duration: 0.8 }, 0.15);
    tl.fromTo(fig.querySelector("[data-phone-tilt]"), { rotate: 0, scale: 1 }, { rotate: -3.2, scale: 1.04, duration: 1 }, 0);
    tl.fromTo(fig.querySelector("[data-box-lid]"), { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.35, ease: "power2.out" }, 0);
    tl.fromTo(fig.querySelectorAll("[data-led]"), { opacity: 0.25 }, { opacity: 1, duration: 0.3, stagger: 0.02 }, 0.1);

    gsap.from(el.querySelectorAll("[data-reason]"), {
      y: 60,
      opacity: 0,
      stagger: 0.12,
      ease: "power2.out",
      scrollTrigger: { trigger: el.querySelector("[data-reasons]"), start: "top 88%", end: "top 45%", scrub: 0.7 },
    });

    const vec = el.querySelector<HTMLElement>("[data-vector]")!;
    const vtl = gsap.timeline({ scrollTrigger: { trigger: vec, start: "top 82%", end: "top 30%", scrub: 0.7 } });
    vtl.from(vec.querySelectorAll("[data-cell]"), { scale: 0, opacity: 0, transformOrigin: "50% 100%", stagger: { each: 0.012, from: "start" }, ease: "back.out(2)" }, 0);
    vtl.fromTo(vec.querySelector("[data-wire]"), { scaleX: 0 }, { scaleX: 1, ease: "none", duration: 0.35 }, 0.4);
    vtl.from(vec.querySelector("[data-model]"), { opacity: 0, x: -20, duration: 0.3 }, 0.6);

    gsap.from(el.querySelectorAll("[data-credit]"), {
      yPercent: 110,
      opacity: 0,
      stagger: 0.06,
      ease: "power3.out",
      scrollTrigger: { trigger: el.querySelector("[data-lists]"), start: "top 85%", end: "top 40%", scrub: 0.7 },
    });
  });
  const reduced = motionOff && hydrated;

  return (
    <Chapter index={index} label="Why a phone can't" id="why-hard">
      <div ref={ref} className="pb-32 pt-20">
        <div className="grid grid-cols-[1.25fr_1fr] items-end gap-16">
          <ChapterHeadline size="text-[112px]" className="max-w-[14ch]">
            {"A phone photographs the room, *not the pad.*"}
          </ChapterHeadline>
          <ChapterCopy className="pb-3">
            Smartphone readers have been tried. They inherit whatever light is in the room and whatever their lens does to the edges of the frame. KJS-HC-03 removes
            both by sealing the strip in an opaque box with brightness-regulated LED strips and a fixed camera.
          </ChapterCopy>
        </div>

        {/* ── comparison ── */}
        <div data-compare className="mt-20 grid grid-cols-2 gap-6">
          {/* phone */}
          <GlassTilt as="figure" className="p-7" max={4}>
            <figcaption className="mb-5 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.18em]">
              <span className="text-[var(--lux-ivory,#f2ebdd)]">
                <span style={{ color: GOLD }}>A</span> · Phone, room light
              </span>
              <span className="text-fg-4">Uncontrolled</span>
            </figcaption>
            <div className="glass-inset relative aspect-[520/300] overflow-hidden">
              <div data-phone-tilt className="absolute inset-0 will-change-transform">
                <div data-phone-good className="absolute inset-0" style={{ opacity: reduced ? 0 : 1 }}>
                  <StripScene k={0} cast={false} />
                </div>
                <div data-phone-bad className="absolute inset-0" style={{ opacity: reduced ? 1 : 0 }}>
                  <StripScene k={K_BARREL} cast />
                </div>
              </div>
              <div data-phone-cast className="uc-cast pointer-events-none absolute inset-0" style={{ opacity: reduced ? 1 : 0 }} />
              <div data-phone-vig className="uc-vignette pointer-events-none absolute inset-0" style={{ opacity: reduced ? 1 : 0 }} />
              <div data-phone-glare className="uc-glare pointer-events-none absolute -inset-y-6 left-[30%] w-[38%]" style={{ opacity: reduced ? 0.85 : 0 }} />
              {/* viewfinder chrome */}
              <div className="pointer-events-none absolute inset-3 font-mono text-[9.5px] uppercase tracking-[0.16em] text-[rgba(242,235,221,0.6)]">
                <span className="uc-corner left-0 top-0 border-l border-t" />
                <span className="uc-corner right-0 top-0 border-r border-t" />
                <span className="uc-corner bottom-0 left-0 border-b border-l" />
                <span className="uc-corner bottom-0 right-0 border-b border-r" />
                <span className="absolute left-4 top-1">Auto WB</span>
                <span className="absolute right-4 top-1">Auto exposure</span>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between font-mono text-[11px] tracking-[0.08em]">
              <span className="uppercase tracking-[0.16em] text-fg-4">GLU pad, as recorded</span>
              <span ref={rgbRef} className="whitespace-pre tabular-nums text-signal">
                {fmtRgb(reduced ? GLU_ROOM : GLU_CLEAN)}
              </span>
            </div>
            <ul className="mt-5 flex flex-wrap gap-2">
              {CUES.map((c) => (
                <li key={c} data-cue data-on={reduced ? "" : undefined} className="uc-cue glass-pill font-mono text-[10px] uppercase tracking-[0.16em]">
                  {c}
                </li>
              ))}
            </ul>
          </GlassTilt>

          {/* sealed box */}
          <GlassTilt as="figure" className="p-7" max={4}>
            <figcaption className="mb-5 flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.18em]">
              <span className="text-[var(--lux-ivory,#f2ebdd)]">
                <span style={{ color: GOLD }}>B</span> · Sealed box, regulated LEDs
              </span>
              <span className="text-fg-4">Controlled</span>
            </figcaption>
            <div className="glass-inset relative aspect-[520/300] overflow-hidden bg-[rgba(4,6,6,0.6)]">
              <div data-box-lid className="absolute inset-0">
                <div className="uc-box-light absolute inset-0" />
                <StripScene k={0} cast={false} />
              </div>
              <div className="absolute inset-x-6 top-3 flex gap-2" aria-hidden>
                {Array.from({ length: 12 }, (_, i) => (
                  <span key={i} data-led className="uc-led h-[3px] flex-1 rounded-full" />
                ))}
              </div>
              <div className="absolute inset-x-6 bottom-3 flex gap-2" aria-hidden>
                {Array.from({ length: 12 }, (_, i) => (
                  <span key={i} data-led className="uc-led h-[3px] flex-1 rounded-full" />
                ))}
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between font-mono text-[11px] tracking-[0.08em]">
              <span className="uppercase tracking-[0.16em] text-fg-4">GLU pad, as recorded</span>
              <span className="whitespace-pre tabular-nums text-signal">{fmtRgb(GLU_CLEAN)}</span>
            </div>
            <ul className="mt-5 flex flex-wrap gap-2">
              {["Opaque enclosure", "Fixed geometry", "Regulated LEDs", "Capture at 120 s"].map((c) => (
                <li key={c} className="uc-cue glass-pill font-mono text-[10px] uppercase tracking-[0.16em]" data-steady="">
                  {c}
                </li>
              ))}
            </ul>
          </GlassTilt>
        </div>
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-4">
          Illustrative rendering of the same drawn strip. Colours are computed for the figure, not measured.
        </p>

        {/* ── four reasons ── */}
        <ol data-reasons className="mt-28 grid grid-cols-4 gap-10 border-t border-[rgba(242,235,221,0.12)] pt-10">
          {REASONS.map((r, i) => (
            <li key={r.t} data-reason>
              <span className="t-serif block text-[64px] italic leading-none" style={{ color: GOLD }}>
                {["i", "ii", "iii", "iv"][i]}
              </span>
              <h3 className="mt-6 text-[18px] font-medium tracking-[-0.01em] text-[var(--lux-ivory,#f2ebdd)]">{r.t}</h3>
              <p className="mt-3 text-[14.5px] leading-relaxed text-fg-3">{r.d}</p>
            </li>
          ))}
        </ol>

        {/* ── 30-D vector ── */}
        <div data-vector className="mt-24">
          <GlassTilt className="grid grid-cols-[1.35fr_auto_1fr] items-center gap-10 p-10" max={3}>
            <div>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-4">Input · 10 pads × R, G, B</p>
              <div className="mt-6 grid grid-cols-[auto_repeat(10,1fr)] gap-x-2 gap-y-2">
                <span />
                {PADS.map((p) => (
                  <span key={p.key} className="text-center font-mono text-[9.5px] tracking-[0.1em] text-fg-4">
                    {p.short}
                  </span>
                ))}
                {(["R", "G", "B"] as const).map((ch, ci) => [
                  <span key={ch} className="pr-2 font-mono text-[10px] text-fg-3">
                    {ch}
                  </span>,
                  ...PADS.map((p) => {
                    const v = hexToRgb(p.hex)[ci] ?? 0;
                    return (
                      <span
                        key={`${p.key}${ch}`}
                        data-cell
                        className="block h-9 rounded-[4px] border border-[rgba(242,235,221,0.08)]"
                        style={{ background: `rgba(242,235,221,${(v / 255).toFixed(3)})` }}
                        title={`${p.short} ${ch}`}
                      />
                    );
                  }),
                ])}
              </div>
              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-4">Cell brightness = channel value of the drawn pad (illustrative)</p>
            </div>

            <div className="flex flex-col items-center gap-3" aria-hidden>
              <span className="t-serif text-[56px] leading-none text-signal">30</span>
              <span data-wire className="block h-px w-28 origin-left bg-signal shadow-[0_0_10px_rgba(95,212,230,0.7)]" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-4">dimensions</span>
            </div>

            <div data-model>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-4">One model, not ten lookups</p>
              <p className="t-serif mt-4 text-[34px] leading-[1.05]">
                Thirty numbers in, <em>one value per analyte</em> out.
              </p>
              <p className="mt-5 text-[14px] leading-relaxed text-fg-3">
                Proposed in the use case: multidimensional polynomial interpolation or a deep-learning regression head. In VITRA today: RGB / LAB features into
                scikit-learn regression baselines, and a number is shown only when a compatible calibration exists.
              </p>
              <p className="mt-4 text-[14px] leading-relaxed text-fg-3">
                Prior systems report a category. The goal stated in the use case is a <span className="text-[var(--lux-ivory,#f2ebdd)]">continuous value</span>.
              </p>
            </div>
          </GlassTilt>
        </div>

        {/* ── conditions + beneficiaries ── */}
        <div data-lists className="mt-28 grid grid-cols-[1fr_1.4fr] gap-20">
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.2em]" style={{ color: GOLD }}>
              Dipsticks are used to screen for
            </p>
            <ul className="mt-6 border-t border-[rgba(242,235,221,0.12)]">
              {CONDITIONS.map((c, i) => (
                <li key={c} className="overflow-hidden border-b border-[rgba(242,235,221,0.12)]">
                  <span data-credit className="flex items-baseline gap-5 py-4">
                    <span className="font-mono text-[10px] tracking-[0.16em] text-fg-4">{String(i + 1).padStart(2, "0")}</span>
                    <span className="t-serif text-[34px] leading-none">{c}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.16em] text-fg-4">As listed in the use case. VITRA does not diagnose.</p>
          </div>
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.2em]" style={{ color: GOLD }}>
              Who the use case is for
            </p>
            <ul className="mt-6 border-t border-[rgba(242,235,221,0.12)]">
              {BENEFICIARIES.map(([who, what]) => (
                <li key={who} className="overflow-hidden border-b border-[rgba(242,235,221,0.12)]">
                  <span data-credit className="grid grid-cols-[1fr_1.1fr] items-baseline gap-6 py-[18px]">
                    <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-[var(--lux-ivory,#f2ebdd)]">{who}</span>
                    <span className="text-[15px] text-fg-3">{what}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Chapter>
  );
}
