"use client";

import { useState } from "react";
import { Chip } from "@/components/ui/chip";
import { ANALYTE_BY_KEY, isAnalyteKey } from "@/lib/analytes";
import { cn } from "@/lib/utils";

export interface InspectorPad {
  padId: string;
  padIndex: number;
  analyteKey: string | null;
  roi: { x: number; y: number; w: number; h: number };
  roiSource: string;
  qualityStatus: string;
  qualityMetrics: Record<string, unknown> | null;
  flags: string[];
  features: {
    rgbMean: number[];
    rgbMedian: number[];
    rgbStd: number[];
    labMean: number[];
    labStd: number[] | null;
    hsvMean: number[] | null;
    pixelCount: number;
  } | null;
}

export interface SegmentationInspectorProps {
  /** Rectified strip crop URL (pad ROIs are in this image's pixel space). */
  stripUrl: string | null;
  rectifiedWidth: number | null;
  rectifiedHeight: number | null;
  pads: InspectorPad[];
}

function num(v: unknown, d = 2): string {
  return typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "—";
}
function vec(v: number[] | null | undefined, d = 1): string {
  return v && v.length ? v.map((x) => x.toFixed(d)).join(" / ") : "—";
}

/**
 * Hover/click pad boxes over the rectified strip crop. ROIs from the CV service
 * are expressed in rectified-strip pixels, so the overlay here is exact; the
 * original-image overlay (drawn by the service) is shown separately.
 */
export function SegmentationInspector({ stripUrl, rectifiedWidth, rectifiedHeight, pads }: SegmentationInspectorProps) {
  const [selected, setSelected] = useState<number | null>(pads[0]?.padIndex ?? null);
  const [hover, setHover] = useState<number | null>(null);
  const W = rectifiedWidth ?? Math.max(1, ...pads.map((p) => p.roi.x + p.roi.w));
  const H = rectifiedHeight ?? Math.max(1, ...pads.map((p) => p.roi.y + p.roi.h));
  const activeIndex = hover ?? selected;
  const active = pads.find((p) => p.padIndex === activeIndex) ?? null;
  const def = active?.analyteKey && isAnalyteKey(active.analyteKey) ? ANALYTE_BY_KEY[active.analyteKey] : null;
  const rgb = active?.features?.rgbMean;

  if (pads.length === 0) {
    return (
      <div className="panel-inset flex h-32 items-center justify-center">
        <span className="t-eyebrow">No pad segmentation stored</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-5">
      <div className="col-span-8">
        <div className="panel-inset relative overflow-hidden">
          {stripUrl ? (
             
            <img src={stripUrl} alt="Rectified strip crop" className="block w-full" draggable={false} />
          ) : (
            <div className="flex h-28 items-center justify-center text-[12px] text-fg-4">Strip crop not available</div>
          )}
          <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="none" role="group" aria-label="Pad regions">
            {pads.map((p) => {
              const isActive = p.padIndex === activeIndex;
              const fail = p.qualityStatus === "fail";
              const warn = p.qualityStatus === "warn";
              return (
                <g key={p.padId} onMouseEnter={() => setHover(p.padIndex)} onMouseLeave={() => setHover(null)} onClick={() => setSelected(p.padIndex)} className="cursor-pointer">
                  <rect x={p.roi.x} y={p.roi.y} width={p.roi.w} height={p.roi.h} fill={isActive ? "rgba(95,212,230,0.18)" : "transparent"} stroke={fail ? "var(--color-fault)" : warn ? "var(--color-notice)" : isActive ? "var(--color-signal)" : "rgba(255,255,255,0.55)"} strokeWidth={isActive ? 3 : 1.5} strokeDasharray={p.roiSource === "fixed" ? "6 4" : undefined} vectorEffect="non-scaling-stroke" />
                  <text x={p.roi.x + 4} y={p.roi.y + 14} fontSize={Math.max(10, H * 0.1)} fontFamily="var(--font-mono)" fill="rgba(255,255,255,0.9)" style={{ paintOrder: "stroke", stroke: "rgba(0,0,0,0.6)", strokeWidth: 2 }}>
                    {p.padId}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="mt-2 flex items-center gap-4 text-[11px] text-fg-4">
          <span>solid = detected ROI</span>
          <span>dashed = fixed-geometry fallback</span>
          <span className="text-notice">amber = pad warn</span>
          <span className="text-fault">red = pad fail</span>
        </div>
        <ol className="mt-3 grid grid-cols-10 gap-1">
          {pads.map((p) => {
            const d = p.analyteKey && isAnalyteKey(p.analyteKey) ? ANALYTE_BY_KEY[p.analyteKey] : null;
            const m = p.features?.rgbMean;
            return (
              <li key={p.padId}>
                <button type="button" onClick={() => setSelected(p.padIndex)} onMouseEnter={() => setHover(p.padIndex)} onMouseLeave={() => setHover(null)} className={cn("flex w-full flex-col items-center gap-1 rounded-[var(--radius-xs)] border px-1 py-1.5", p.padIndex === activeIndex ? "border-signal" : "border-line hover:border-line-strong")}>
                  <span className="h-4 w-full rounded-[2px] border border-line" style={{ background: m ? `rgb(${m.map(Math.round).join(",")})` : "var(--color-ink-3)" }} aria-hidden />
                  <span className="t-mono text-[10px] text-fg-3">{d?.short ?? p.padId}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="col-span-4">
        {active ? (
          <div className="panel-inset flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="t-eyebrow">
                  {active.padId} · pad {active.padIndex + 1}
                </div>
                <div className="text-[14px] font-medium text-fg">{def?.label ?? active.analyteKey ?? "unmapped"}</div>
              </div>
              <span className="size-9 rounded-[var(--radius-xs)] border border-line" style={{ background: rgb ? `rgb(${rgb.map(Math.round).join(",")})` : "var(--color-ink-3)" }} aria-hidden />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Chip tone={active.qualityStatus === "fail" ? "fault" : active.qualityStatus === "warn" ? "notice" : "neutral"}>{active.qualityStatus}</Chip>
              <Chip tone="muted">{active.roiSource}</Chip>
              {active.flags.map((f) => (
                <Chip key={f} tone="notice">
                  {f}
                </Chip>
              ))}
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[11.5px]">
              <dt className="text-fg-4">ROI</dt>
              <dd className="t-mono text-fg-2">
                {active.roi.x},{active.roi.y} · {active.roi.w}×{active.roi.h}
              </dd>
              <dt className="text-fg-4">RGB mean</dt>
              <dd className="t-mono text-fg-2">{vec(active.features?.rgbMean)}</dd>
              <dt className="text-fg-4">RGB median</dt>
              <dd className="t-mono text-fg-2">{vec(active.features?.rgbMedian)}</dd>
              <dt className="text-fg-4">RGB std</dt>
              <dd className="t-mono text-fg-2">{vec(active.features?.rgbStd, 2)}</dd>
              <dt className="text-fg-4">LAB mean</dt>
              <dd className="t-mono text-fg-2">{vec(active.features?.labMean)}</dd>
              <dt className="text-fg-4">LAB std</dt>
              <dd className="t-mono text-fg-2">{vec(active.features?.labStd, 2)}</dd>
              <dt className="text-fg-4">HSV mean</dt>
              <dd className="t-mono text-fg-2">{vec(active.features?.hsvMean)}</dd>
              <dt className="text-fg-4">Pixels</dt>
              <dd className="t-mono text-fg-2">{active.features?.pixelCount ?? "—"}</dd>
              <dt className="text-fg-4">Uniformity</dt>
              <dd className="t-mono text-fg-2">{num(active.qualityMetrics?.uniformity)}</dd>
              <dt className="text-fg-4">Specular</dt>
              <dd className="t-mono text-fg-2">{num(active.qualityMetrics?.specular_fraction, 3)}</dd>
              <dt className="text-fg-4">Contrast</dt>
              <dd className="t-mono text-fg-2">{num(active.qualityMetrics?.edge_contrast)}</dd>
              <dt className="text-fg-4">Coverage</dt>
              <dd className="t-mono text-fg-2">{num(active.qualityMetrics?.coverage)}</dd>
            </dl>
          </div>
        ) : null}
      </div>
    </div>
  );
}
