import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TONE_COLOR, type ChartTone } from "./scale";

export interface LegendItem {
  label: string;
  tone: ChartTone;
  /** "line" (default) | "hollow" (synthetic points) | "block" (bars). */
  kind?: "line" | "hollow" | "block" | "dashed";
}

export interface ChartFrameProps {
  eyebrow?: ReactNode;
  title?: ReactNode;
  /** Right-aligned mono annotation (e.g. "14 D", "n = 42"). */
  meta?: ReactNode;
  legend?: LegendItem[];
  footnote?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Instrument-style frame: mono eyebrow, title, legend, hairline-separated plot. */
export function ChartFrame({ eyebrow, title, meta, legend, footnote, className, children }: ChartFrameProps) {
  const hasHeader = eyebrow || title || meta || (legend && legend.length > 0);
  return (
    <figure className={cn("flex min-w-0 flex-col gap-3", className)}>
      {hasHeader ? (
        <figcaption className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            {eyebrow ? <div className="t-eyebrow">{eyebrow}</div> : null}
            {title ? <div className="mt-0.5 text-[13.5px] font-medium text-fg">{title}</div> : null}
          </div>
          <div className="flex shrink-0 items-center gap-4">
            {legend && legend.length > 0 ? (
              <ul className="flex items-center gap-3">
                {legend.map((l) => (
                  <li key={l.label} className="flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-3">
                    <LegendSwatch tone={l.tone} kind={l.kind ?? "line"} />
                    {l.label}
                  </li>
                ))}
              </ul>
            ) : null}
            {meta ? <div className="t-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-4">{meta}</div> : null}
          </div>
        </figcaption>
      ) : null}
      <div className="min-w-0">{children}</div>
      {footnote ? <div className="text-[11.5px] leading-relaxed text-fg-4">{footnote}</div> : null}
    </figure>
  );
}

function LegendSwatch({ tone, kind }: { tone: ChartTone; kind: NonNullable<LegendItem["kind"]> }) {
  const c = TONE_COLOR[tone];
  if (kind === "block") return <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: c }} />;
  if (kind === "hollow") return <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full border-[1.5px]" style={{ borderColor: c }} />;
  if (kind === "dashed") return <span aria-hidden className="inline-block h-0 w-3.5 border-t border-dashed" style={{ borderColor: c }} />;
  return <span aria-hidden className="inline-block h-[2px] w-3.5 rounded" style={{ background: c }} />;
}

/** Empty-state placeholder shared by the charts. */
export function ChartEmpty({ height = 160, message = "No data" }: { height?: number; message?: string }) {
  return (
    <div className="panel-inset flex items-center justify-center" style={{ height }}>
      <span className="t-eyebrow">{message}</span>
    </div>
  );
}
