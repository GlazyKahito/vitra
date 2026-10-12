"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DropdownMenuItem {
  label: ReactNode;
  onSelect?: () => void;
  href?: string;
  icon?: ReactNode;
  shortcut?: string;
  tone?: "default" | "danger";
  disabled?: boolean;
}

export interface DropdownMenuProps {
  /** The trigger element. Receives aria attributes via a wrapper button. */
  trigger: ReactNode;
  items: (DropdownMenuItem | "separator")[];
  align?: "start" | "end";
  className?: string;
  triggerClassName?: string;
}

/** Lightweight, Radix-free dropdown menu with roving keyboard focus. */
export function DropdownMenu({ trigger, items, align = "end", className, triggerClassName }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])');
    first?.focus();
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const onMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const els = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? []);
    const idx = els.findIndex((el) => el === document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      els[(idx + 1) % els.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      els[(idx - 1 + els.length) % els.length]?.focus();
    } else if (e.key === "Tab") {
      close();
    }
  };

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={cn("inline-flex items-center rounded-[var(--radius-sm)]", triggerClassName)}
      >
        {trigger}
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={id}
          role="menu"
          onKeyDown={onMenuKeyDown}
          className={cn("panel absolute z-50 mt-1.5 min-w-[200px] overflow-hidden py-1", align === "end" ? "right-0" : "left-0")}
        >
          {items.map((item, i) => {
            if (item === "separator") return <div key={`sep-${i}`} role="separator" className="my-1 border-t border-line" />;
            const cls = cn(
              "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] outline-none transition-colors focus:bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.05)]",
              item.tone === "danger" ? "text-fault" : "text-fg-2 hover:text-fg focus:text-fg",
              item.disabled && "pointer-events-none opacity-40",
            );
            const inner = (
              <>
                {item.icon ? <span className="flex size-4 items-center justify-center text-fg-3 [&>svg]:size-4">{item.icon}</span> : null}
                <span className="flex-1">{item.label}</span>
                {item.shortcut ? <span className="font-mono text-[10.5px] text-fg-4">{item.shortcut}</span> : null}
              </>
            );
            if (item.href) {
              return (
                <Link key={i} role="menuitem" href={item.href} className={cls} aria-disabled={item.disabled} onClick={close} tabIndex={-1}>
                  {inner}
                </Link>
              );
            }
            return (
              <button
                key={i}
                type="button"
                role="menuitem"
                className={cls}
                aria-disabled={item.disabled}
                tabIndex={-1}
                onClick={() => {
                  close();
                  item.onSelect?.();
                }}
              >
                {inner}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
