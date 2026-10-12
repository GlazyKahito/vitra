"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  "aria-label"?: string;
  className?: string;
}

export function SegmentedControl<T extends string>({ options, value, onChange, size = "md", className, ...rest }: SegmentedControlProps<T>) {
  return (
    <div role="radiogroup" aria-label={rest["aria-label"]} className={cn("inline-flex rounded-[var(--radius-sm)] border border-line bg-ink-1 p-0.5", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-[4px] px-3 font-medium transition-colors duration-200 disabled:opacity-40",
              size === "sm" ? "h-7 text-[12px]" : "h-8 text-[13px]",
              active ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))] text-[var(--lux-ivory)] shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_0_0_1px_rgba(201,169,110,0.28)]" : "text-fg-3 hover:text-fg-2",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
