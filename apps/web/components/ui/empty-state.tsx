import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Calm empty readout: a reticle mark, mono eyebrow, short line, optional action. */
export function EmptyState({ icon, eyebrow, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("ws-empty flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="ws-empty-mark relative mb-5 flex size-12 items-center justify-center rounded-full text-fg-3 [&>svg]:size-4" aria-hidden>
        {icon ?? <span className="size-1.5 rounded-full bg-[var(--lux-gold)] opacity-70" />}
      </div>
      {eyebrow ? <div className="t-eyebrow mb-2 text-[10px] tracking-[0.2em]">{eyebrow}</div> : null}
      <h3 className="font-mono text-[12px] uppercase tracking-[0.16em] text-fg-2">{title}</h3>
      {description ? <p className="mt-2 max-w-[420px] text-[13px] leading-relaxed text-fg-3">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
