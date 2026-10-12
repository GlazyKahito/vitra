"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { ANALYTES, demoColor, hexToRgb } from "@/lib/analytes";
import { ReagentStrip, type StripLevels } from "@/components/strip/reagent-strip";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";
import { Chapter, ChapterCopy, ChapterHeadline } from "./chapter";

const LEVELS: StripLevels = { glucose: 0.3, protein: 0.5, ph: 0.45, ketones: 0.1, blood: 0.2, bilirubin: 0.05, urobilinogen: 0.35, nitrite: 0.05, leucocytes: 0.4, specific_gravity: 0.6 };

/** sRGB → CIE L* (D65), good enough for an illustrative table. */
function lStar([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const y = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const f = y > 0.008856 ? Math.cbrt(y) : 7.787 * y + 16 / 116;
  return 116 * f - 16;
}

// Deterministic illustrative quality scores (not measured).
const QUALITY = [0.97, 0.94, 0.96, 0.91, 0.95, 0.98, 0.93, 0.9, 0.96, 0.92] as const;

/** Chapter 05 — raw strip → overlay → table, rows animating in. */
export function ImageToData() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -20% 0px" });
  const reduced = useReducedMotion();
  const [rows, setRows] = useState(reduced ? 10 : 0);
  const [stage, setStage] = useState<0 | 1 | 2>(reduced ? 2 : 0);

  useEffect(() => {
    if (reduced || !inView) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setStage(1), 500));
    timers.push(setTimeout(() => setStage(2), 1300));
    for (let i = 1; i <= 10; i++) timers.push(setTimeout(() => setRows(i), 1500 + i * 160));
    return () => timers.forEach(clearTimeout);
  }, [inView, reduced]);

  return (
    <Chapter index="05" label="From image to data" id="image-to-data">
      <div ref={ref} className="grid grid-cols-[1fr_1.15fr] gap-16 py-24">
        <div>
          <ChapterHeadline>One photograph. Ten numbers. Each with a reason.</ChapterHeadline>
          <ChapterCopy className="mt-8">
            The console shows the raw capture, the pad overlay, and the feature table side by side, so a reviewer can see exactly which pixels produced which
            number — and why a pad was rejected.
          </ChapterCopy>

          <div className="mt-12 flex flex-col gap-6">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="t-eyebrow">Raw capture</span>
                <span className="font-mono text-[10px] text-fg-4">prototype_cam · 4056 × 3040</span>
              </div>
              <div className="relative overflow-hidden rounded-[var(--radius-sm)] border border-line bg-ink-1 p-6">
                <ReagentStrip levels={LEVELS} width={480} />
              </div>
            </div>
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="t-eyebrow">Pad overlay</span>
                <span className={cn("font-mono text-[10px] transition-colors", stage >= 1 ? "text-signal" : "text-fg-4")}>{stage >= 1 ? "10 / 10 pads located" : "locating…"}</span>
              </div>
              <div className="relative overflow-hidden rounded-[var(--radius-sm)] border border-line bg-ink-1 p-6">
                <ReagentStrip levels={LEVELS} width={480} />
                {/* overlay boxes aligned to the strip's pad geometry (viewBox 860: pads at x=300+56i, 44 wide) */}
                <div className={cn("pointer-events-none absolute left-6 top-6 transition-opacity duration-500", stage >= 1 ? "opacity-100" : "opacity-0")} style={{ width: 480, height: (480 * 100) / 860 }} aria-hidden>
                  {ANALYTES.map((a, i) => {
                    const sc = 480 / 860;
                    return (
                      <div key={a.key} className="absolute border border-signal" style={{ left: (300 + i * 56) * sc - 2, top: 28 * sc - 2, width: 44 * sc + 4, height: 44 * sc + 4 }}>
                        <span className="absolute -top-3.5 left-0 font-mono text-[8px] tracking-[0.1em] text-signal">P{String(i + 1).padStart(2, "0")}</span>
                      </div>
                    );
                  })}
                  <div className="absolute inset-0 rounded-[2px] border border-dashed border-[rgba(95,212,230,0.4)]" style={{ top: 22 * (480 / 860), height: 56 * (480 / 860) }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <span className="t-eyebrow">Feature table</span>
            <Chip tone="muted">Synthetic demonstration</Chip>
          </div>
          <div className="panel overflow-hidden">
            <table className="table-instrument">
              <thead>
                <tr>
                  <th>Pad</th>
                  <th>Analyte</th>
                  <th>Swatch</th>
                  <th className="text-right">RGB mean</th>
                  <th className="text-right">L*</th>
                  <th className="text-right">Quality</th>
                </tr>
              </thead>
              <tbody>
                {ANALYTES.map((a, i) => {
                  const hex = demoColor(a.key, LEVELS[a.key] ?? 0.15);
                  const rgb = hexToRgb(hex);
                  const visible = i < rows;
                  return (
                    <tr key={a.key} className={cn("transition-all duration-500", visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0")} aria-hidden={!visible}>
                      <td className="font-mono text-[12px] text-fg-3">P{String(i + 1).padStart(2, "0")}</td>
                      <td className="text-fg">{a.label}</td>
                      <td>
                        <span className="inline-block size-4 rounded-[2px] border border-[rgba(0,0,0,0.3)] align-middle" style={{ background: hex }} />
                      </td>
                      <td className="text-right font-mono text-[12px] tabular-nums">
                        {rgb[0]} / {rgb[1]} / {rgb[2]}
                      </td>
                      <td className="text-right font-mono text-[12px] tabular-nums">{lStar(rgb).toFixed(1)}</td>
                      <td className="text-right font-mono text-[12px] tabular-nums text-fg-3">{QUALITY[i].toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-fg-4">
            Colours, RGB means and quality scores above are generated from the synthetic demo ramp. No real sample was photographed to make this table.
          </p>
        </div>
      </div>
    </Chapter>
  );
}
