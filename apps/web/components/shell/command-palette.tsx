"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { CornerDownLeft, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAV, isNavActive, type NavItem } from "./workspace-nav";

interface Entry extends NavItem {
  group: string;
}

const ENTRIES: Entry[] = APP_NAV.flatMap((g) => g.items.map((it) => ({ ...it, group: g.label })));

function score(e: Entry, q: string): number {
  if (!q) return 1;
  const label = e.label.toLowerCase();
  if (label.startsWith(q)) return 4;
  if (label.split(/\s+/).some((w) => w.startsWith(q))) return 3;
  if (label.includes(q)) return 2;
  if (`${e.hint} ${e.keywords ?? ""} ${e.group}`.toLowerCase().includes(q)) return 1;
  return 0;
}

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Client-side quick jump. Ctrl/⌘+K toggles it (bound in the workspace chrome),
 * ↑/↓ move, Enter navigates, Esc or a backdrop click closes and focus returns
 * to whatever had it before.
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const restoreRef = useRef<Element | null>(null);
  const listId = useId();

  useEffect(() => setMounted(true), []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ENTRIES.map((e, i) => ({ e, s: score(e, q), i }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s || a.i - b.i)
      .map((r) => r.e);
  }, [query]);

  useEffect(() => {
    if (open) {
      restoreRef.current = document.activeElement;
      setQuery("");
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else if (restoreRef.current instanceof HTMLElement) {
      restoreRef.current.focus();
      restoreRef.current = null;
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = useCallback(
    (e: Entry | undefined) => {
      if (!e) return;
      onOpenChange(false);
      if (pathname !== e.href) router.push(e.href);
    },
    [onOpenChange, pathname, router],
  );

  const onKeyDown = (ev: ReactKeyboardEvent<HTMLDivElement>) => {
    if (ev.key === "Escape") {
      ev.preventDefault();
      onOpenChange(false);
    } else if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setActive((a) => (results.length ? (a + 1) % results.length : 0));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setActive((a) => (results.length ? (a - 1 + results.length) % results.length : 0));
    } else if (ev.key === "Home") {
      ev.preventDefault();
      setActive(0);
    } else if (ev.key === "End") {
      ev.preventDefault();
      setActive(Math.max(0, results.length - 1));
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      go(results[active]);
    } else if (ev.key === "Tab") {
      // Keep focus inside the dialog: the input is the only tabbable control.
      ev.preventDefault();
      inputRef.current?.focus();
    }
  };

  if (!mounted) return null;

  let lastGroup = "";
  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="ws-palette"
          className="fixed inset-0 z-[90] flex items-start justify-center pt-[14vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          onKeyDown={onKeyDown}
        >
          <div className="absolute inset-0 bg-[rgba(4,6,5,0.66)] backdrop-blur-[3px]" onMouseDown={() => onOpenChange(false)} aria-hidden />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Quick jump"
            className="ws-palette relative w-[600px] overflow-hidden"
            initial={{ opacity: 0, y: -10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex h-14 items-center gap-3 border-b border-line px-4">
              <Search className="size-4 shrink-0 text-[var(--lux-gold)]" aria-hidden />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
                aria-autocomplete="list"
                placeholder="Jump to a screen…"
                className="h-full flex-1 bg-transparent text-[15px] text-fg placeholder:text-fg-4 focus:outline-none focus-visible:outline-none"
                spellCheck={false}
                autoComplete="off"
              />
              <kbd className="ws-kbd">Esc</kbd>
            </div>
            <ul ref={listRef} id={listId} role="listbox" aria-label="Screens" className="max-h-[52vh] overflow-y-auto p-2">
              {results.length === 0 ? (
                <li className="px-3 py-10 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-fg-4" role="presentation">
                  No screen matches “{query}”
                </li>
              ) : (
                results.map((e, i) => {
                  const showGroup = !query.trim() && e.group !== lastGroup;
                  lastGroup = e.group;
                  const Icon = e.icon;
                  const selected = i === active;
                  const here = isNavActive(pathname, e.href);
                  return (
                    <li key={e.href} role="presentation">
                      {showGroup ? <div className="px-3 pb-1.5 pt-3 font-mono text-[9.5px] uppercase tracking-[0.18em] text-fg-4 first:pt-1">{e.group}</div> : null}
                      <div
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={selected}
                        data-index={i}
                        onMouseMove={() => setActive(i)}
                        onMouseDown={(ev) => ev.preventDefault()}
                        onClick={() => go(e)}
                        className={cn("ws-palette-row relative flex h-11 cursor-pointer items-center gap-3 rounded-[7px] px-3", selected && "is-active")}
                      >
                        {selected ? <motion.span layoutId="ws-palette-active" className="ws-palette-hl absolute inset-0 rounded-[7px]" transition={{ type: "spring", stiffness: 520, damping: 42 }} aria-hidden /> : null}
                        <Icon className={cn("relative size-[15px] shrink-0", selected ? "text-[var(--lux-gold)]" : "text-fg-4")} aria-hidden />
                        <span className={cn("relative text-[13.5px]", selected ? "text-[var(--lux-ivory)]" : "text-fg-2")}>{e.label}</span>
                        <span className="relative min-w-0 flex-1 truncate text-[12px] text-fg-4">{e.hint}</span>
                        {here ? <span className="relative font-mono text-[9.5px] uppercase tracking-[0.14em] text-fg-4">current</span> : null}
                        {selected ? <CornerDownLeft className="relative size-3.5 text-fg-3" aria-hidden /> : null}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
            <div className="flex h-9 items-center gap-4 border-t border-line px-4 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-4">
              <span className="flex items-center gap-1.5">
                <kbd className="ws-kbd">↑</kbd>
                <kbd className="ws-kbd">↓</kbd> move
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="ws-kbd">↵</kbd> open
              </span>
              <span className="ml-auto">{results.length} screens</span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
