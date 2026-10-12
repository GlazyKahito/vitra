import { cn } from "@/lib/utils";

export const PROTOTYPE_LINE = "Research prototype. Not a medical device. Not clinically validated.";

export interface PrototypeBannerProps {
  /** "footer" (default): quiet mono line. "inline": bordered notice block for the top of a panel/page. */
  variant?: "footer" | "inline";
  /** Extra sentence appended after the standard line. */
  detail?: string;
  className?: string;
}

/** The research-prototype line every app page carries. */
export function PrototypeBanner({ variant = "footer", detail, className }: PrototypeBannerProps) {
  if (variant === "inline") {
    return (
      <div role="note" className={cn("flex items-start gap-3 rounded-[var(--radius-sm)] border border-[rgba(232,181,90,0.35)] bg-notice-dim px-4 py-3", className)}>
        <span className="mt-[5px] size-1.5 shrink-0 rounded-full bg-notice" aria-hidden />
        <p className="text-[12.5px] leading-relaxed text-fg-2">
          <span className="font-medium text-notice">{PROTOTYPE_LINE}</span>
          {detail ? <span className="text-fg-3"> {detail}</span> : null}
        </p>
      </div>
    );
  }
  return (
    <p className={cn("t-mono text-[11px] tracking-[0.04em] text-fg-4", className)}>
      {PROTOTYPE_LINE}
      {detail ? ` ${detail}` : ""}
    </p>
  );
}
