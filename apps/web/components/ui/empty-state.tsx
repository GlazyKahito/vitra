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

export function EmptyState({ icon, eyebrow, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon ? <div className="mb-4 flex size-10 items-center justify-center rounded-full border border-line text-fg-3 [&>svg]:size-4">{icon}</div> : null}
      {eyebrow ? <div className="t-eyebrow mb-2">{eyebrow}</div> : null}
      <h3 className="text-[15px] font-medium text-fg">{title}</h3>
      {description ? <p className="mt-1.5 max-w-[420px] text-[13px] leading-relaxed text-fg-3">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
