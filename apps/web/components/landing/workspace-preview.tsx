"use client";

import { useRef } from "react";
import { GlassTilt } from "@/components/stage/glass-tilt";
import { Chip } from "@/components/ui/chip";
import { StateChip } from "@/components/ui/state-chip";
import { Stat } from "@/components/ui/stat";
import { RESULT_STATES } from "@/lib/inference/policy";
import { cn } from "@/lib/utils";
import { Chapter, ChapterCopy, ChapterHeadline } from "./chapter";
import { gsap, useScrollScene } from "./fx/use-scroll-scene";

const RUNS = [
  { id: "RUN-0F3A91", sample: "SYN-0042", product: "Generic 10-SG", state: "synthetic", quality: "pass", at: "12 Oct · 10:14" },
  { id: "RUN-0F3A8C", sample: "SYN-0041", product: "Generic 10-SG", state: "calibration_required", quality: "pass", at: "12 Oct · 09:58" },
  { id: "RUN-0F3A77", sample: "SYN-0040", product: "Generic 10-SG", state: "indeterminate", quality: "warn", at: "11 Oct · 17:41" },
  { id: "RUN-0F3A60", sample: "SYN-0039", product: "Generic 10-SG", state: "invalid_image", quality: "fail", at: "11 Oct · 17:02" },
] as const;

const APPLICATIONS = [
  ["Research & calibration", "Collect reference pairs, train baselines, compare feature sets."],
  ["Operator workflow", "Insert, wait 120 s, capture, hand off to review."],
  ["Clinical review", "Per-analyte states, overrides with reasons, sign-off."],
  ["Device engineering", "Ingest API, simulated adapter, LED drift tracking."],
  ["Reporting", "PDF/JSON exports with model, version and reviewer."],
] as const;

const NAV = ["Overview", "New analysis", "Review queue", "Reports", "Calibration", "Model lab", "Devices"] as const;

/**
 * Chapter 06 — the console, as one big pane of glass. It arrives lying back
 * (rotateX ≈ 26°) and stands up into place as it scrolls in.
 */
export function WorkspacePreview() {
  const ref = useRef<HTMLDivElement>(null);

  useScrollScene(ref, (root) => {
    const stage = root.querySelector<HTMLElement>("[data-stage]")!;
    const tl = gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: stage, start: "top bottom", end: "top 12%", scrub: 0.9 } });
    tl.fromTo("[data-console]", { rotateX: 26, y: 160, scale: 0.88, opacity: 0.35 }, { rotateX: 0, y: 0, scale: 1, opacity: 1, ease: "power2.out" }, 0);
    tl.fromTo("[data-floor]", { opacity: 0, scaleX: 0.6 }, { opacity: 1, scaleX: 1 }, 0);
    tl.from("[data-row-in]", { opacity: 0, x: -16, stagger: 0.06, duration: 0.25 }, 0.55);

    gsap.from(root.querySelectorAll("[data-app]"), {
      y: 30,
      opacity: 0,
      stagger: 0.08,
      ease: "power2.out",
      scrollTrigger: { trigger: root.querySelector("[data-apps]"), start: "top 92%", end: "top 62%", scrub: 0.6 },
    });
  });

  return (
    <Chapter index="07" label="Workspace" id="workspace">
      <div ref={ref} className="pb-28 pt-20">
        <div className="grid grid-cols-[1.3fr_1fr] items-end gap-16">
          <ChapterHeadline size="text-[104px]" className="max-w-[12ch]">
            {"A workstation, *not a widget.*"}
          </ChapterHeadline>
          <ChapterCopy className="pb-3">
            The console is organised around runs: each one keeps its image, overlay, features, model version and review trail together. Nothing is shown without
            the state that explains it.
          </ChapterCopy>
        </div>

        {/* the console */}
        <div data-stage className="relative mt-20 [perspective:1800px]">
          <div data-floor className="lc-floor pointer-events-none absolute -bottom-16 left-1/2 h-40 w-[80%] -translate-x-1/2" aria-hidden />
          <div data-console className="origin-[50%_100%] will-change-transform [transform-style:preserve-3d]">
            <GlassTilt className="grid grid-cols-[200px_1fr] overflow-hidden p-0" max={3}>
              {/* rail */}
              <aside className="flex flex-col border-r border-[rgba(255,255,255,0.08)] px-4 py-5">
                <div className="t-serif px-2 text-[28px] leading-none">Vitra</div>
                <div className="mt-1 px-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-fg-4">Research console</div>
                <nav className="mt-7 flex flex-col gap-0.5" aria-hidden>
                  {NAV.map((n, i) => (
                    <span key={n} className={cn("flex items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-[13px]", i === 0 ? "bg-[rgba(255,255,255,0.06)] text-fg" : "text-fg-3")}>
                      <span className={cn("size-1.5 rounded-full", i === 0 ? "bg-[var(--lc-gold)]" : "bg-[rgba(255,255,255,0.14)]")} />
                      {n}
                    </span>
                  ))}
                </nav>
                <div className="mt-auto rounded-[10px] border border-[rgba(255,255,255,0.08)] p-3 font-mono text-[9.5px] uppercase leading-[1.6] tracking-[0.12em] text-fg-4">
                  Demo mode
                  <br />
                  <span className="text-fg-3">All data synthetic</span>
                </div>
              </aside>

              {/* main */}
              <div className="min-w-0">
                <div className="flex h-12 items-center justify-between border-b border-[rgba(255,255,255,0.08)] px-6">
                  <div className="flex items-center gap-3">
                    <span className="t-eyebrow">Console</span>
                    <span className="text-[13px] text-fg">Overview</span>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-4">Research prototype · not a medical device</span>
                </div>
                <div className="grid grid-cols-4 gap-6 border-b border-[rgba(255,255,255,0.08)] px-6 py-5">
                  <Stat eyebrow="Runs · 7 d" value="24" sub="all synthetic" />
                  <Stat eyebrow="Pending review" value="3" tone="notice" sub="oldest 2 h" />
                  <Stat eyebrow="Image faults" value="1" tone="fault" sub="glare" />
                  <Stat eyebrow="Validated models" value="0" sub="of 10 analytes" />
                </div>
                <table className="table-instrument">
                  <thead>
                    <tr>
                      <th className="!pl-6">Run</th>
                      <th>Sample</th>
                      <th>Strip product</th>
                      <th>Image</th>
                      <th>State</th>
                      <th className="!pr-6 !text-right">Captured</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RUNS.map((r) => (
                      <tr key={r.id} data-row-in>
                        <td className="!pl-6 font-mono text-[12px] text-fg">{r.id}</td>
                        <td className="font-mono text-[12px]">
                          {r.sample} <Chip tone="muted" className="ml-1.5">Synthetic</Chip>
                        </td>
                        <td>{r.product}</td>
                        <td>
                          <Chip tone={r.quality === "fail" ? "fault" : r.quality === "warn" ? "notice" : "neutral"} dot>
                            {r.quality}
                          </Chip>
                        </td>
                        <td>
                          <StateChip state={r.state} />
                        </td>
                        <td className="!pr-6 text-right font-mono text-[12px] text-fg-3">{r.at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="border-t border-[rgba(255,255,255,0.08)] px-6 py-4">
                  <div className="t-eyebrow mb-3">Result states</div>
                  <div className="flex flex-wrap gap-2">
                    {RESULT_STATES.map((s) => (
                      <StateChip key={s} state={s} />
                    ))}
                  </div>
                </div>
              </div>
            </GlassTilt>
          </div>
        </div>

        {/* applications */}
        <ul data-apps className="mt-24 grid grid-cols-5 gap-8">
          {APPLICATIONS.map(([t, d], i) => (
            <li key={t} data-app className="border-t border-[rgb(var(--lc-ivory-rgb)/0.16)] pt-5">
              <span className="t-serif text-[30px] italic leading-none text-[var(--lc-gold)]">{String(i + 1).padStart(2, "0")}</span>
              <div className="mt-3 text-[15px] text-fg">{t}</div>
              <div className="mt-1.5 text-[13px] leading-relaxed text-fg-3">{d}</div>
            </li>
          ))}
        </ul>
      </div>
    </Chapter>
  );
}
