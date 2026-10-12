import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Remove body padding (for tables / images that bleed to the edge). */
  flush?: boolean;
  /** Use the inset (darker) surface. */
  inset?: boolean;
  footer?: ReactNode;
}

export function Panel({ eyebrow, title, description, actions, flush, inset, footer, className, children, ...rest }: PanelProps) {
  const hasHeader = eyebrow || title || actions || description;
  return (
    <section className={cn(inset ? "panel-inset" : "panel ws-panel", "flex flex-col", className)} {...rest}>
      {hasHeader ? (
        <header className="ws-panel-head flex items-start justify-between gap-6 border-b border-line px-5 py-4">
          <div className="min-w-0">
            {eyebrow ? <div className="t-eyebrow mb-1">{eyebrow}</div> : null}
            {title ? <h3 className="text-[15px] font-medium tracking-[-0.012em] text-fg">{title}</h3> : null}
            {description ? <p className="mt-1 text-[13px] leading-relaxed text-fg-3">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn("min-w-0 flex-1", flush ? "" : "p-5")}>{children}</div>
      {footer ? <footer className="border-t border-line px-5 py-3 text-[12px] text-fg-3">{footer}</footer> : null}
    </section>
  );
}
