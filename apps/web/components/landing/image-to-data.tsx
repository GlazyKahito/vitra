"use client";

import { useRef } from "react";
import { GlassTilt } from "@/components/stage/glass-tilt";
import { ReagentStrip, type StripLevels } from "@/components/strip/reagent-strip";
import { Chip } from "@/components/ui/chip";
import { ANALYTES, demoColor, hexToRgb } from "@/lib/analytes";
import { Chapter, ChapterCopy, ChapterHeadline } from "./chapter";
import { gsap, useScrollScene } from "./fx/use-scroll-scene";

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

const ROWS = ANALYTES.map((a, i) => {
  const hex = demoColor(a.key, LEVELS[a.key] ?? 0.15);
  const rgb = hexToRgb(hex);
  return { key: a.key, label: a.label, hex, rgb, L: lStar(rgb), Q: QUALITY[i] ?? 0.9 };
});

const STRIP_W = 456;
const SC = STRIP_W / 860;
/** Where pad i's centre sits along the strip, 0..1. */
const padAt = (i: number) => ((300 + i * 56 + 22) * SC) / STRIP_W;

const SCAN_FROM = 0.12;
const SCAN_LEN = 0.7;

/**
 * Chapter 05 — raw strip → overlay → table, on one pane of glass. The pane
 * pins while a scan line reads the strip; each pad it crosses lights up and
 * its row counts in. Every number is from the synthetic demo ramp.
 */
export function ImageToData() {
  const ref = useRef<HTMLDivElement>(null);

  useScrollScene(ref, (root) => {
    const pane = root.querySelector<HTMLElement>("[data-pane]")!;
    const rows = gsap.utils.toArray<HTMLElement>("[data-row]", root);
    const boxes = gsap.utils.toArray<HTMLElement>("[data-box]", root);
    const vec = gsap.utils.toArray<HTMLElement>("[data-vec]", root);

    gsap.from(pane.querySelector("[data-rise]"), { y: 120, opacity: 0, scrollTrigger: { trigger: pane, start: "top bottom", end: "top 55%", scrub: 0.8 } });

    const tl = gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: pane, start: "center center", end: () => `+=${Math.round(window.innerHeight * 1.1)}`, pin: true, scrub: 0.7, invalidateOnRefresh: true },
    });
    tl.set({}, {}, 1); // timeline length = 1

    tl.fromTo("[data-frame-out]", { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: 0.08 }, 0.02);
    tl.fromTo("[data-status-a]", { opacity: 1 }, { opacity: 0, duration: 0.04 }, SCAN_FROM + SCAN_LEN);
    tl.fromTo("[data-status-b]", { opacity: 0 }, { opacity: 1, duration: 0.04 }, SCAN_FROM + SCAN_LEN);
    tl.fromTo("[data-scan]", { x: 0, opacity: 0 }, { x: STRIP_W, opacity: 1, duration: SCAN_LEN }, SCAN_FROM);
    tl.to("[data-scan]", { opacity: 0, duration: 0.05 }, SCAN_FROM + SCAN_LEN);

    rows.forEach((row, i) => {
      const at = SCAN_FROM + SCAN_LEN * padAt(i);
      const r = ROWS[i]!;
      const cells = row.querySelectorAll<HTMLElement>("[data-n]");
      const o = { k: 0 };
      tl.fromTo(boxes[i]!, { opacity: 0, scale: 1.6 }, { opacity: 1, scale: 1, duration: 0.03, ease: "power2.out" }, at);
      tl.fromTo(row, { opacity: 0.08, x: 14 }, { opacity: 1, x: 0, duration: 0.05, ease: "power2.out" }, at);
      tl.fromTo(vec[i]!, { opacity: 0.1 }, { opacity: 1, duration: 0.03 }, at);
      tl.fromTo(
        o,
        { k: 0 },
        {
          k: 1,
          duration: 0.09,
          ease: "power2.out",
          onUpdate: () => {
            const k = o.k;
            if (cells[0]) cells[0].textContent = `${Math.round(r.rgb[0] * k)} / ${Math.round(r.rgb[1] * k)} / ${Math.round(r.rgb[2] * k)}`;
            if (cells[1]) cells[1].textContent = (r.L * k).toFixed(1);
            if (cells[2]) cells[2].textContent = (r.Q * k).toFixed(2);
          },
        },
        at,
      );
    });
  });

  return (
    <Chapter index="06" label="From image to data" id="image-to-data">
      <div ref={ref} className="pb-28 pt-20">
        <div className="grid grid-cols-[1.45fr_1fr] items-end gap-16">
          <ChapterHeadline size="text-[88px]" className="max-w-[17ch]">
            {"One photograph. Ten numbers. *Each with a reason.*"}
          </ChapterHeadline>
          <ChapterCopy className="pb-3">
            The console shows the raw capture, the pad overlay, and the feature table side by side, so a reviewer can see exactly which pixels produced which
            number — and why a pad was rejected.
          </ChapterCopy>
        </div>

        <div data-pane className="mt-16">
          <div data-rise>
          <GlassTilt className="grid grid-cols-[504px_1fr] gap-9 p-8" max={2.5}>
            {/* left: capture + overlay */}
            <div className="flex flex-col gap-6">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="t-eyebrow">Raw capture</span>
                  <span className="font-mono text-[10px] text-fg-4">prototype_cam · 4056 × 3040</span>
                </div>
                <div className="glass-inset p-6">
                  <ReagentStrip levels={LEVELS} width={STRIP_W} />
                </div>
              </div>
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="t-eyebrow">Pad overlay</span>
                  <span className="relative font-mono text-[10px]">
                    <span data-status-a className="absolute right-0 whitespace-nowrap text-fg-4 opacity-0">
                      reading pads…
                    </span>
                    <span data-status-b className="text-signal">
                      10 / 10 pads located
                    </span>
                  </span>
                </div>
                <div className="glass-inset relative overflow-hidden p-6">
                  <ReagentStrip levels={LEVELS} width={STRIP_W} />
                  <div className="pointer-events-none absolute left-6 top-6" style={{ width: STRIP_W, height: 100 * SC }} aria-hidden>
                    <div data-frame-out className="absolute inset-x-0 rounded-[2px] border border-dashed border-[rgba(95,212,230,0.4)]" style={{ top: 22 * SC, height: 56 * SC }} />
                    {ANALYTES.map((a, i) => (
                      <div key={a.key} data-box className="absolute border border-signal" style={{ left: (300 + i * 56) * SC - 2, top: 28 * SC - 2, width: 44 * SC + 4, height: 44 * SC + 4 }}>
                        <span className="absolute -top-3.5 left-0 font-mono text-[8px] tracking-[0.1em] text-signal">P{String(i + 1).padStart(2, "0")}</span>
                      </div>
                    ))}
                    {/* the reading head */}
                    <div data-scan className="absolute -inset-y-3 left-0 w-px opacity-0 will-change-transform">
                      <div className="absolute inset-y-0 left-0 w-px bg-signal shadow-[0_0_14px_2px_rgba(95,212,230,0.7)]" />
                      <div className="absolute inset-y-0 right-0 w-28 bg-gradient-to-l from-[rgba(95,212,230,0.2)] to-transparent" />
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <div className="t-eyebrow mb-2">Feature vector · 30-D</div>
                <p className="font-mono text-[10.5px] leading-[1.7] tracking-[0.02em] text-fg-3">
                  <span className="text-fg-4">x = [ </span>
                  {ROWS.map((r, i) => (
                    <span key={r.key} data-vec className="text-fg-2">
                      {r.rgb.join(", ")}
                      {i < ROWS.length - 1 ? <span className="text-fg-4">, </span> : null}
                    </span>
                  ))}
                  <span className="text-fg-4"> ]</span>
                </p>
              </div>
            </div>

            {/* right: table */}
            <div className="flex flex-col">
              <div className="mb-3 flex items-center justify-between">
                <span className="t-eyebrow">Feature table</span>
                <Chip tone="muted">Synthetic demonstration</Chip>
              </div>
              <div className="glass-inset overflow-hidden">
                <table className="table-instrument [&_td]:!px-2.5 [&_th]:!px-2.5">
                  <thead>
                    <tr>
                      <th>Pad</th>
                      <th>Analyte</th>
                      <th>Swatch</th>
                      <th className="!text-right">RGB mean</th>
                      <th className="!text-right">L*</th>
                      <th className="!text-right">Quality</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map((r, i) => (
                      <tr key={r.key} data-row>
                        <td className="font-mono text-[12px] text-fg-3">P{String(i + 1).padStart(2, "0")}</td>
                        <td className="text-fg">{r.label}</td>
                        <td>
                          <span className="inline-block size-4 rounded-[3px] border border-[rgba(0,0,0,0.3)] align-middle" style={{ background: r.hex }} />
                        </td>
                        <td data-n className="text-right font-mono text-[12px] tabular-nums">
                          {r.rgb[0]} / {r.rgb[1]} / {r.rgb[2]}
                        </td>
                        <td data-n className="text-right font-mono text-[12px] tabular-nums">
                          {r.L.toFixed(1)}
                        </td>
                        <td data-n className="text-right font-mono text-[12px] tabular-nums text-fg-3">
                          {r.Q.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-[12px] leading-relaxed text-fg-4">
                Colours, RGB means and quality scores above are generated from the synthetic demo ramp. No real sample was photographed to make this table.
              </p>
            </div>
          </GlassTilt>
          </div>
        </div>
      </div>
    </Chapter>
  );
}
