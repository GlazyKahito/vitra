import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ChapterProps {
  /** Two-digit mono chapter number, e.g. "02". */
  index: string;
  /** Short mono label after the number, e.g. "The problem". */
  label: string;
  id?: string;
  className?: string;
  /** Remove the horizontal padding (full-bleed chapters). */
  bleed?: boolean;
  children: ReactNode;
}

/** A landing chapter: hairline top, mono "02 / The problem" slug, generous vertical space. */
export function Chapter({ index, label, id, className, bleed, children }: ChapterProps) {
  return (
    <section id={id} className={cn("relative border-t border-line", bleed ? "" : "px-10", className)}>
      <div className={cn("flex items-center gap-3 pt-6", bleed && "px-10")}>
        <span className="font-mono text-[11px] tabular-nums text-signal">{index}</span>
        <span className="font-mono text-[11px] text-fg-4">/</span>
        <span className="t-eyebrow text-fg-2">{label}</span>
      </div>
      {children}
    </section>
  );
}

export function ChapterHeadline({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("t-display max-w-[14ch] text-[56px] text-fg", className)}>{children}</h2>;
}

export function ChapterCopy({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("max-w-[52ch] text-[17px] leading-[1.6] text-fg-2", className)}>{children}</p>;
}
