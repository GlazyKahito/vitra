"use client";

import { useRef, useState } from "react";
import { GlassTilt } from "@/components/stage/glass-tilt";
import { Chapter, ChapterCopy, ChapterHeadline } from "@/components/landing/chapter";
import { SplitWords } from "@/components/landing/fx/split";
import { gsap, useScrollScene } from "@/components/landing/fx/use-scroll-scene";
import type { UseCaseChapterProps } from "./why-hard";
import { useHydrated } from "./use-hydrated";

const GOLD = "var(--lux-gold, #c9a96e)";

interface Layer {
  /** Layer name. */
  name: string;
  /** Program code shown on the plate. */
  code: string;
  program: string;
  role: string;
  /** The inter-disciplinary dependency, condensed from the use case. */
  dep: string;
  /** Indices (bottom-up) of the layers this one exchanges with. */
  links: number[];
  primary?: boolean;
  /** Where the use case proposes something the software does not implement. */
  note?: string;
  /** The software in this repository works at this layer. */
  inVitra?: boolean;
}

/** Bottom (physical) to top (analytics). Roles and dependencies condensed from KJS-HC-03, Part B. */
const LAYERS: readonly Layer[] = [
  {
    name: "Physical enclosure",
    code: "MECH",
    program: "Mechanical Engineering",
    role: "CAD and fabrication of the controlled-illumination black box and strip fixture; thermal and light-leak management.",
    dep: "Houses the EXTC camera, LEDs and VLSI boards, and fixes the optical geometry that AI & DS relies on.",
    links: [1, 2, 5],
  },
  {
    name: "Silicon & sensor",
    code: "VLSI",
    program: "Electronics Engineering (VLSI Design & Technology)",
    role: "CMOS image-sensor front-end, LED driver IC, and low-power FPGA / ASIC acceleration for a GPU-free device.",
    dep: "Supplies sensor and accelerator hardware to the EXTC edge layer and co-designs it with E&CE.",
    links: [2, 3],
  },
  {
    name: "Edge & capture",
    code: "EXTC",
    program: "Electronics & Telecommunication Engineering",
    role: "Raspberry Pi camera control, LED brightness scripting and timed 120 s capture automation.",
    dep: "Receives the enclosure from MECH and the front-end from VLSI; sends calibrated images to AI & DS; pushes results to the database.",
    links: [0, 1, 5, 6, 7],
    primary: true,
    note: "On-device MobileSAM inference is proposed in the use case.",
  },
  {
    name: "HW / SW co-design",
    code: "E&CE",
    program: "Electronics & Computer Engineering",
    role: "Device drivers, real-time scheduling and image-pipeline tuning so the vision model runs on constrained Pi hardware.",
    dep: "Bridges EXTC and VLSI hardware with AI & DS software; optimises model deployment at the edge.",
    links: [1, 2, 5],
  },
  {
    name: "Automation",
    code: "R&AI",
    program: "Robotics & Artificial Intelligence",
    role: "Motorised strip positioning, automated camera staging and closed-loop capture triggering.",
    dep: "Feeds correctly positioned strips to the EXTC capture stage; consumes vision feedback from AI & DS for actuation.",
    links: [2, 5],
  },
  {
    name: "Vision & ML",
    code: "AI&DS",
    program: "Artificial Intelligence & Data Science",
    role: "Reagent-pad segmentation, RGB / CIELAB feature extraction and regression-based analyte estimation.",
    dep: "Receives calibrated images from EXTC; outputs analyte values to the Computer Engineering and IT database layer.",
    links: [2, 6, 7],
    note: "MobileSAM segmentation is proposed in the use case. VITRA implements OpenCV localisation, pad-grid segmentation, RGB / LAB features and regression baselines.",
    inVitra: true,
  },
  {
    name: "Backend & database",
    code: "CE",
    program: "Computer Engineering",
    role: "System architecture, OS-level resource management on the Pi, backend services and a patient-linked relational database.",
    dep: "Receives structured analyte data from AI & DS; exposes APIs to the IT dashboard and the C&CE transport layer.",
    links: [5, 7, 8],
    inVitra: true,
  },
  {
    name: "Cloud, security & dashboard",
    code: "IT",
    program: "Information Technology",
    role: "Encrypted transmission, time-series storage, digital report generation and the clinical-staff web dashboard.",
    dep: "Receives structured data from CE and AI & DS; interfaces with the hospital information system.",
    links: [5, 6, 8],
    inVitra: true,
  },
  {
    name: "IoT transport",
    code: "C&CE",
    program: "Computer & Communication Engineering",
    role: "Secure communication between edge device and cloud; IoT protocols for multi-site point-of-care deployment.",
    dep: "Carries data between the EXTC / CE edge and the IT cloud, and enforces secure communication standards.",
    links: [2, 6, 7],
  },
  {
    name: "Health analytics",
    code: "CSBS",
    program: "Computer Science & Business Systems",
    role: "Population-level analytics, cost-benefit and deployment modelling for resource-limited settings, administrator dashboards.",
    dep: "Consumes analyte and usage data from the IT and CE layers to inform clinical-operations decisions.",
    links: [6, 7],
  },
];

const N = LAYERS.length;
const PRIMARY = LAYERS.findIndex((l) => l.primary);
/** Separation between plates (px along the stack axis): closed and exploded. */
const GAP_CLOSED = 6;
const GAP_OPEN = 46;
const GAP_STATIC = 34;
const zFor = (i: number, gap: number) => (i - (N - 1) / 2) * gap;
const pad2 = (n: number) => String(n).padStart(2, "0");

const FACULTY = [
  { name: "Dr. Ninad Mehendale", title: "Associate Professor", dept: "Department of Electronics Engineering" },
  { name: "Dr. Jagannath Nirmal", title: "Professor & Head", dept: "Department of Electronics Engineering" },
] as const;

/**
 * One instrument, ten disciplines. The use case's inter-disciplinary layers
 * as an exploded glass stack that separates with scroll. Hover a plate (or
 * its row) to light it and its partners and read the dependency. Closes on
 * the faculty owners, set as film credits.
 */
export function BuildStack({ index = "11" }: UseCaseChapterProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(PRIMARY);
  const cur = LAYERS[active] ?? LAYERS[0]!;

  const hydrated = useHydrated();
  const motionOff = useScrollScene(ref, (el) => {
    const stack = el.querySelector<HTMLElement>("[data-stack]")!;
    const stage = stack.querySelector<HTMLElement>("[data-stage]")!;
    const plates = Array.from(stack.querySelectorAll<HTMLElement>("[data-plate]"));

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: stack, start: "top 85%", end: "center 40%", scrub: 0.9 },
    });
    tl.fromTo(stage, { rotationX: 64, rotationZ: -50 }, { rotationX: 58, rotationZ: -38, duration: 1, ease: "power1.inOut" }, 0);
    plates.forEach((p, i) => {
      tl.fromTo(p, { z: zFor(i, GAP_CLOSED) }, { z: zFor(i, GAP_OPEN), duration: 0.85, ease: "power2.out" }, 0.1);
      tl.fromTo(p, { opacity: 0 }, { opacity: 1, duration: 0.25 }, (i / N) * 0.35);
    });

    gsap.from(el.querySelectorAll("[data-li]"), {
      x: 40,
      opacity: 0,
      stagger: 0.05,
      ease: "power2.out",
      scrollTrigger: { trigger: el.querySelector("[data-list]"), start: "top 88%", end: "top 45%", scrub: 0.6 },
    });

    const credits = el.querySelector<HTMLElement>("[data-credits]")!;
    const ctl = gsap.timeline({ scrollTrigger: { trigger: credits, start: "top 85%", end: "center 55%", scrub: 0.8 } });
    ctl.fromTo(credits.querySelectorAll("[data-crule]"), { scaleX: 0 }, { scaleX: 1, ease: "none", duration: 0.4 }, 0);
    ctl.from(credits.querySelectorAll("[data-ctext]"), { opacity: 0, y: 14, stagger: 0.05, duration: 0.3 }, 0.1);
    ctl.fromTo(credits.querySelectorAll("[data-w]"), { yPercent: 118, opacity: 0.2 }, { yPercent: 0, opacity: 1, stagger: 0.06, ease: "power3.out", duration: 0.5 }, 0.15);
  });
  const reduced = motionOff && hydrated;

  const isLinked = (i: number) => cur.links.includes(i);

  return (
    <Chapter index={index} label="Ten disciplines" id="build-stack">
      <div ref={ref} className="pb-32 pt-20">
        <div className="grid grid-cols-[1.3fr_1fr] items-end gap-16">
          <ChapterHeadline size="text-[112px]" className="max-w-[12ch]">
            {"One instrument, *ten disciplines.*"}
          </ChapterHeadline>
          <ChapterCopy className="pb-3">
            The use case maps the build across ten engineering programs at KJSIT and KJSSE, from the box that keeps the light out to the dashboards that read the
            results. Each layer hands something to the next. Hover a layer to see what it exchanges, and with whom.
          </ChapterCopy>
        </div>

        <div className="mt-16 grid grid-cols-[1.2fr_1fr] items-center gap-10">
          {/* ── exploded stack ── */}
          <div data-stack className="relative h-[720px] [perspective:2200px]" onPointerLeave={() => setActive(PRIMARY)}>
            <div className="absolute left-1/2 top-1/2 h-[250px] w-[400px] -translate-x-1/2 -translate-y-1/2 [transform-style:preserve-3d]">
              <div
                data-stage
                className="absolute inset-0 [transform-style:preserve-3d]"
                style={{ transform: "rotateX(58deg) rotateZ(-38deg)" }}
              >
                {LAYERS.map((l, i) => (
                  <div
                    key={l.code}
                    data-plate
                    className="absolute inset-0 [transform-style:preserve-3d]"
                    style={{ transform: `translateZ(${zFor(i, reduced ? GAP_STATIC : GAP_CLOSED)}px)` }}
                  >
                    <button
                      type="button"
                      className="uc-plate absolute inset-0 text-left"
                      data-active={i === active ? "" : undefined}
                      data-linked={i !== active && isLinked(i) ? "" : undefined}
                      onPointerEnter={() => setActive(i)}
                      onFocus={() => setActive(i)}
                      aria-label={`${l.name}, ${l.program}`}
                    >
                      <span className="absolute left-5 top-4 font-mono text-[11px] tracking-[0.2em] text-[var(--lux-ivory,#f2ebdd)]">
                        {pad2(i + 1)} · {l.code}
                      </span>
                      <span className="t-serif absolute bottom-4 left-5 text-[28px] italic leading-none">{l.name}</span>
                      <span className="uc-plate-grid absolute inset-3 rounded-[12px]" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <span className="absolute bottom-2 left-0 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-4">Physical, at the base</span>
            <span className="absolute right-0 top-2 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-4">Analytics, at the top</span>
          </div>

          {/* ── legend + detail ── */}
          <div>
            <ol data-list className="border-t border-[rgba(242,235,221,0.12)]" onPointerLeave={() => setActive(PRIMARY)}>
              {LAYERS.map((l, i) => ({ l, i }))
                .reverse()
                .map(({ l, i }) => (
                  <li key={l.code} data-li>
                    <button
                      type="button"
                      className="uc-li grid w-full grid-cols-[34px_64px_1fr_auto] items-baseline gap-3 border-b border-[rgba(242,235,221,0.12)] py-[9px] text-left"
                      data-active={i === active ? "" : undefined}
                      data-linked={i !== active && isLinked(i) ? "" : undefined}
                      onPointerEnter={() => setActive(i)}
                      onFocus={() => setActive(i)}
                    >
                      <span className="font-mono text-[10px] tracking-[0.16em] text-fg-4">{pad2(i + 1)}</span>
                      <span className="uc-li-code font-mono text-[10.5px] tracking-[0.14em]">{l.code}</span>
                      <span className="uc-li-name text-[15px]">{l.name}</span>
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-fg-4">
                        {l.primary ? "Primary" : l.inVitra ? "In VITRA" : ""}
                      </span>
                    </button>
                  </li>
                ))}
            </ol>

            <GlassTilt className="mt-6 min-h-[360px] p-7" max={3}>
              <div aria-live="polite">
                <p className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.18em]">
                  <span style={{ color: GOLD }}>
                    Layer {pad2(active + 1)} · {cur.code}
                  </span>
                  <span className="text-fg-4">{cur.program}</span>
                </p>
                <p className="t-serif mt-4 text-[36px] leading-none">{cur.name}</p>
                <p className="mt-4 text-[14.5px] leading-relaxed text-fg-2">{cur.role}</p>
                <div className="mt-5 border-t border-[rgba(242,235,221,0.12)] pt-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-4">Depends on / hands to</p>
                  <p className="mt-2 text-[14px] leading-relaxed text-fg-3">{cur.dep}</p>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {cur.links.map((j) => (
                      <li key={j} className="uc-link-chip glass-pill font-mono text-[10px] tracking-[0.14em]">
                        {LAYERS[j]?.code}
                      </li>
                    ))}
                  </ul>
                </div>
                {cur.note ? <p className="mt-4 font-mono text-[10.5px] leading-relaxed tracking-[0.04em] text-fg-4">{cur.note}</p> : null}
              </div>
            </GlassTilt>
          </div>
        </div>

        {/* ── credits ── */}
        <div data-credits className="mt-36 text-center">
          <div className="flex items-center justify-center gap-6">
            <span data-crule className="uc-rule uc-rule-rev h-px w-40 origin-right" />
            <span data-ctext className="font-mono text-[11px] uppercase tracking-[0.32em]" style={{ color: GOLD }}>
              Faculty owners
            </span>
            <span data-crule className="uc-rule h-px w-40 origin-left" />
          </div>
          <div className="mx-auto mt-14 grid max-w-[1100px] grid-cols-2 gap-16">
            {FACULTY.map((f) => (
              <div key={f.name}>
                <p className="t-serif text-[64px] leading-[1.02]">
                  <SplitWords text={f.name} />
                </p>
                <p data-ctext className="mt-5 font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--lux-platinum,#bfc1c2)]">
                  {f.title}
                </p>
                <p data-ctext className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-4">
                  {f.dept}
                </p>
              </div>
            ))}
          </div>
          <p data-ctext className="t-serif mt-14 text-[30px] italic leading-none">
            K J Somaiya School of Engineering
          </p>
          <p data-ctext className="mt-5 font-mono text-[10px] uppercase tracking-[0.24em] text-fg-4">
            Use case KJS-HC-03 · Inter-disciplinary faculty committee
          </p>
        </div>
      </div>
    </Chapter>
  );
}
