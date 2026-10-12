"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  /** px width; default 520 */
  width?: number;
  /** Close when the backdrop is clicked. Default true. */
  dismissible?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Native <dialog> wrapper. Uses showModal() so the browser handles focus
 * trapping, the top layer, and Esc (which fires `cancel` → onClose).
 */
export function Dialog({ open, onClose, title, eyebrow, description, footer, width = 520, dismissible = true, className, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const previouslyFocused = useRef<Element | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      previouslyFocused.current = document.activeElement;
      el.showModal();
      const first = el.querySelector<HTMLElement>("[data-autofocus], input, textarea, select, button:not([data-dialog-close])");
      first?.focus();
    } else if (!open && el.open) {
      el.close();
      const prev = previouslyFocused.current;
      if (prev instanceof HTMLElement) prev.focus();
    }
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [onClose]);

  const onBackdropClick = (e: MouseEvent<HTMLDialogElement>) => {
    if (!dismissible) return;
    if (e.target === ref.current) onClose();
  };

  return (
    <dialog
      ref={ref}
      onClick={onBackdropClick}
      aria-labelledby={title ? "dialog-title" : undefined}
      className={cn(
        "m-auto max-h-[85vh] overflow-hidden bg-transparent p-0 text-fg backdrop:bg-[rgba(6,6,7,0.72)] backdrop:backdrop-blur-[2px] open:flex",
        className,
      )}
      style={{ width }}
    >
      <div className="panel flex w-full flex-col">
        <header className="flex items-start justify-between gap-6 border-b border-line px-5 py-4">
          <div>
            {eyebrow ? <div className="t-eyebrow mb-1">{eyebrow}</div> : null}
            {title ? (
              <h2 id="dialog-title" className="text-[16px] font-medium tracking-[-0.01em]">
                {title}
              </h2>
            ) : null}
            {description ? <p className="mt-1 text-[13px] text-fg-3">{description}</p> : null}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close" data-dialog-close className="-mr-2 px-2">
            <X className="size-4" />
          </Button>
        </header>
        <div className="overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <footer className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</footer> : null}
      </div>
    </dialog>
  );
}
