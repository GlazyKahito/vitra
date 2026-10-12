import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("ws-pagehead mb-7 flex items-end justify-between gap-8 pb-6", className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="t-eyebrow mb-2">{eyebrow}</div> : null}
        <h2 className="ws-title t-serif text-[40px]">{title}</h2>
        {description ? <p className="mt-3 max-w-[640px] text-[14px] leading-relaxed text-fg-3">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export interface SectionLabelProps {
  /** Mono chapter number, e.g. "01" */
  index?: string;
  children: ReactNode;
  hint?: ReactNode;
  className?: string;
}

/** Hairline section divider with mono index + label. */
export function SectionLabel({ index, children, hint, className }: SectionLabelProps) {
  return (
    <div className={cn("mb-4 flex items-center gap-3", className)}>
      {index ? <span className="font-mono text-[11px] tabular-nums text-[var(--lux-gold)]">{index}</span> : null}
      <span className="t-eyebrow text-fg-2">{children}</span>
      <span className="h-px flex-1 bg-line" aria-hidden />
      {hint ? <span className="font-mono text-[10.5px] text-fg-4">{hint}</span> : null}
    </div>
  );
}
