"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Chapter, ChapterCopy, ChapterHeadline } from "@/components/landing/chapter";
import { GlassTilt } from "@/components/stage/glass-tilt";
import { cn } from "@/lib/utils";
import { CalibrationPreview, ConsolePreview, DevicesPreview, InspectorPreview, ModelLabPreview, NewAnalysisPreview, ReportsPreview, ReviewPreview } from "./module-previews";

interface Module {
  id: string;
  title: string;
  short: string;
  path: string;
  href: string;
  purpose: string;
  bullets: [string, string, string];
  preview: (active: boolean) => ReactNode;
}

/** Capabilities are taken from the shipped screens (app/(app)/** and components/{console,analysis,review,…}). */
const MODULES: Module[] = [
  {
    id: "console",
    title: "Analysis console",
    short: "Console",
    path: "/console",
    href: "/console",
    purpose: "The lab at a glance: what ran, what failed, and what is waiting for a person.",
    bullets: [
      "Status distribution and 14-day throughput, with invalid-image runs overlaid",
      "Calibration, model-version, device and quality-failure panels side by side",
      "A filterable run table next to the live audit-activity feed",
    ],
    preview: () => <ConsolePreview />,
  },
  {
    id: "new",
    title: "New analysis",
    short: "New analysis",
    path: "/analysis/new",
    href: "/analysis/new",
    purpose: "Register a sample, time the reaction, capture the strip and submit, all in one guided flow.",
    bullets: [
      "Four steps: sample registration, reaction timer, image acquisition, submit",
      "Capture stays locked until the 120 s timer completes, unless an untimed capture is explicitly acknowledged",
      "Upload a photo, use the browser camera, or render a synthetic demo strip",
    ],
    preview: (active) => <NewAnalysisPreview active={active} />,
  },
  {
    id: "inspector",
    title: "Result inspector",
    short: "Inspector",
    path: "/analysis/[id]",
    href: "/history",
    purpose: "One run in one place: the image, the overlay, the pads, the values and the reasons behind them.",
    bullets: [
      "The original capture beside an annotated overlay of the strip polygon and pad boxes",
      "Per-pad RGB, LAB and HSV features with uniformity, specular and coverage checks",
      "All ten analytes, each with its result state and the model that produced it",
    ],
    preview: () => <InspectorPreview />,
  },
  {
    id: "review",
    title: "Clinical review",
    short: "Review",
    path: "/review",
    href: "/review",
    purpose: "Human-in-the-loop sign-off before a result is reported.",
    bullets: [
      "A queue of runs awaiting review, flagged when a critical analyte is unavailable",
      "Accept, reject, ask for a repeat capture, or add a note",
      "Every decision is attributed to the reviewer and timestamped in the audit trail",
    ],
    preview: () => <ReviewPreview />,
  },
  {
    id: "calibration",
    title: "Calibration Studio",
    short: "Calibration",
    path: "/calibration",
    href: "/calibration",
    purpose: "Turn reference measurements into per-analyte calibration models.",
    bullets: [
      "Import calibration CSVs, validated against the data contract before they are stored",
      "Edit each strip product’s pad-to-analyte map and reaction time",
      "Train linear, polynomial-ridge, k-NN or random-forest models on rgb30, pad_rgb or lab30 features",
    ],
    preview: () => <CalibrationPreview />,
  },
  {
    id: "model-lab",
    title: "Model Lab",
    short: "Model Lab",
    path: "/model-lab",
    href: "/model-lab",
    purpose: "See how a calibration model behaves on data it was not trained on.",
    bullets: [
      "Predicted-vs-reference and residual plots on the held-out test split",
      "Compare two models side by side on the same plots",
      "“Validated” is a manual admin step that needs written evidence; synthetic-trained models can never be validated",
    ],
    preview: () => <ModelLabPreview />,
  },
  {
    id: "reports",
    title: "Reports",
    short: "Reports",
    path: "/reports",
    href: "/reports",
    purpose: "Structured reports tied to the sample, the run and its timestamp.",
    bullets: [
      "PDF for printing, with the overlay and state chips, or JSON with every result state and reason",
      "Generation can be gated on a completed clinical review (a setting)",
      "Each report records who generated it and is downloaded through the app",
    ],
    preview: () => <ReportsPreview />,
  },
  {
    id: "devices",
    title: "Device monitor",
    short: "Devices",
    path: "/devices",
    href: "/devices",
    purpose: "Every capture box feeding the lab, with simulated and real devices clearly marked.",
    bullets: [
      "A fleet table showing last seen, capture state and errors in the past 24 h",
      "An event timeline; the simulated adapter writes events marked [SIMULATED]",
      "The device ingest contract (POST /api/ingest), with per-device key rotation",
    ],
    preview: () => <DevicesPreview />,
  },
];

const DWELL_MS = 7000;

export interface ModuleShowcaseProps {
  index?: string;
  label?: string;
  id?: string;
}

/**
 * "Inside the console": a stepped tour of the eight console modules. Each tab shows its
 * purpose, three capabilities and a schematic preview, and links straight into the module.
 * Tabs advance on their own while the section is on screen. Hovering the stage pauses them;
 * hovering, clicking or arrowing onto a tab selects it.
 */
export function ModuleShowcase({ index = "06", label = "Inside the console", id = "modules" }: ModuleShowcaseProps) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [cycle, setCycle] = useState(0); // restarts the hairline when the same tab is re-selected
  const reduce = useReducedMotion() ?? false;
  const stageRef = useRef<HTMLDivElement>(null);
  const inView = useInView(stageRef, { amount: 0.35 });
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const hoverTimer = useRef<number | null>(null);

  const select = useCallback(
    (i: number) => {
      if (i === active) setCycle((c) => c + 1);
      else setActive(i);
    },
    [active],
  );

  useEffect(() => () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
  }, []);

  const running = inView && !paused && !reduce;
  const mod = MODULES[active];

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    let next = active;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (active + 1) % MODULES.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (active - 1 + MODULES.length) % MODULES.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = MODULES.length - 1;
    else return;
    e.preventDefault();
    select(next);
    tabs.current[next]?.focus();
  };

  return (
    <Chapter index={index} label={label} id={id}>
      <style>{`@keyframes vitra-lab-dwell{from{transform:scaleX(0)}to{transform:scaleX(1)}}`}</style>
      <div className="pb-28 pt-20">
        <div className="grid grid-cols-[1.25fr_1fr] items-end gap-16">
          <ChapterHeadline size="text-[100px]" className="max-w-[11ch]">
            {"Inside the *console.*"}
          </ChapterHeadline>
          <ChapterCopy className="pb-3">
            Eight working modules, from capture through calibration to a signed-off report. Pick one to look inside, or open it directly. The demo accounts on the
            sign-in page give you a login for each role.
          </ChapterCopy>
        </div>

        <div
          ref={stageRef}
          className="mt-16 grid grid-cols-[300px_minmax(0,1fr)] gap-8"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
          }}
        >
          {/* ── rail ── */}
          <div role="tablist" aria-label="Console modules" aria-orientation="vertical" onKeyDown={onKey} className="flex flex-col">
            {MODULES.map((m, i) => {
              const on = i === active;
              return (
                <button
                  key={m.id}
                  ref={(el) => {
                    tabs.current[i] = el;
                  }}
                  role="tab"
                  type="button"
                  id={`lab-tab-${m.id}`}
                  aria-selected={on}
                  aria-controls={`lab-panel-${m.id}`}
                  tabIndex={on ? 0 : -1}
                  onClick={() => select(i)}
                  onMouseEnter={() => {
                    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
                    hoverTimer.current = window.setTimeout(() => setActive(i), 140);
                  }}
                  onMouseLeave={() => {
                    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
                  }}
                  className={cn(
                    "group relative grid grid-cols-[34px_1fr] items-baseline gap-x-2 border-t border-[rgb(var(--lc-ivory-rgb)/0.1)] px-3 py-3.5 text-left outline-none transition-colors last:border-b",
                    "focus-visible:bg-[rgb(var(--lc-ivory-rgb)/0.05)]",
                    on ? "bg-[rgb(var(--lc-ivory-rgb)/0.045)]" : "hover:bg-[rgb(var(--lc-ivory-rgb)/0.025)]",
                  )}
                >
                  <span className={cn("t-serif text-[22px] italic leading-none transition-colors", on ? "text-[var(--lux-gold)]" : "text-[var(--lux-platinum)]/40")}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex min-w-0 items-baseline justify-between gap-3">
                    <span className={cn("truncate text-[15px] transition-colors", on ? "text-[var(--lux-ivory)]" : "text-[var(--lux-platinum)]/75 group-hover:text-[var(--lux-ivory)]")}>{m.title}</span>
                    <span className="shrink-0 font-mono text-[9.5px] tracking-[0.06em] text-[var(--lux-platinum)]/45">{m.path}</span>
                  </span>
                  {/* dwell hairline */}
                  <span className="pointer-events-none absolute inset-x-0 bottom-[-1px] h-px overflow-hidden" aria-hidden>
                    {on ? (
                      <span
                        key={`${active}-${cycle}`}
                        className="block h-full w-full origin-left bg-[var(--lux-gold)]"
                        style={
                          reduce
                            ? { transform: "scaleX(1)", opacity: 0.6 }
                            : {
                                animation: `vitra-lab-dwell ${DWELL_MS}ms linear forwards`,
                                animationPlayState: running ? "running" : "paused",
                              }
                        }
                        onAnimationEnd={() => {
                          if (running) setActive((a) => (a + 1) % MODULES.length);
                        }}
                      />
                    ) : null}
                  </span>
                </button>
              );
            })}
            <p className="mt-4 px-3 font-mono text-[9.5px] uppercase leading-relaxed tracking-[0.14em] text-[var(--lux-platinum)]/45">
              ↑ ↓ to step · hover the stage to pause
              <br />
              modules open after sign-in
            </p>
          </div>

          {/* ── stage ── */}
          <GlassTilt className="glass-sheen overflow-hidden p-0" max={2}>
            <div role="tabpanel" id={`lab-panel-${mod.id}`} aria-labelledby={`lab-tab-${mod.id}`} className="grid min-h-[470px] grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`copy-${mod.id}`}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col border-r border-[rgb(var(--lc-ivory-rgb)/0.1)] px-8 py-8"
                >
                  <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--lux-platinum)]/70">
                    Module {String(active + 1).padStart(2, "0")} / {String(MODULES.length).padStart(2, "0")}
                  </div>
                  <h3 className="t-serif mt-4 text-[46px] leading-[0.98] tracking-[-0.01em] text-[var(--lux-ivory)]">{mod.title}</h3>
                  <p className="mt-4 text-[15px] leading-relaxed text-[var(--lux-platinum)]">{mod.purpose}</p>
                  <ul className="mt-6 flex flex-col">
                    {mod.bullets.map((b, i) => (
                      <li key={b} className="grid grid-cols-[26px_1fr] gap-2 border-t border-[rgb(var(--lc-ivory-rgb)/0.08)] py-2.5 text-[13.5px] leading-snug text-[var(--lux-ivory)]/85">
                        <span className="pt-[3px] font-mono text-[10px] tracking-[0.1em] text-[var(--lux-gold)]">{String(i + 1).padStart(2, "0")}</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto flex items-center gap-4 pt-7">
                    <Link href={mod.href} className="glass-cta shrink-0 whitespace-nowrap !h-11 !text-[14px]">
                      Open module
                      <span className="glass-cta-dot !size-8" aria-hidden>
                        →
                      </span>
                    </Link>
                    <span className="font-mono text-[10px] tracking-[0.08em] text-[var(--lux-platinum)]/50">{mod.href === mod.path ? mod.path : `via ${mod.href}`}</span>
                  </div>
                </motion.div>
              </AnimatePresence>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`preview-${mod.id}`}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.985, filter: "blur(6px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.99, filter: "blur(4px)" }}
                  transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
                  className="flex p-6 [&>*]:flex-1"
                >
                  {mod.preview(inView)}
                </motion.div>
              </AnimatePresence>
            </div>
          </GlassTilt>
        </div>
      </div>
    </Chapter>
  );
}
