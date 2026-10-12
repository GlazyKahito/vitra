import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Kbd({ className, ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[var(--radius-xs)] border border-line-strong bg-ink-1 px-1.5 font-mono text-[10.5px] text-fg-3 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]",
        className,
      )}
      {...rest}
    />
  );
}
