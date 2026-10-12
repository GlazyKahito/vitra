"use client";

import { createContext, useCallback, useContext, useId, useMemo, useRef, useState, type HTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue {
  value: string;
  setValue: (v: string) => void;
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabs(): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs.* must be used inside <Tabs>");
  return ctx;
}

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
}

export function Tabs({ value, defaultValue, onValueChange, className, children, ...rest }: TabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const current = value ?? internal;
  const baseId = useId();
  const setValue = useCallback(
    (v: string) => {
      if (value === undefined) setInternal(v);
      onValueChange?.(v);
    },
    [value, onValueChange],
  );
  const ctx = useMemo(() => ({ value: current, setValue, baseId }), [current, setValue, baseId]);
  return (
    <TabsContext.Provider value={ctx}>
      <div className={cn("flex flex-col", className)} {...rest}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
  "aria-label"?: string;
}

export function TabsList({ className, children, ...rest }: TabsListProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])') ?? []);
    const idx = tabs.findIndex((t) => t === document.activeElement);
    if (idx < 0) return;
    let next = idx;
    if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    tabs[next]?.focus();
    tabs[next]?.click();
  };
  return (
    <div ref={ref} role="tablist" onKeyDown={onKeyDown} className={cn("flex items-end gap-1 border-b border-line", className)} {...rest}>
      {children}
    </div>
  );
}

export interface TabsTriggerProps extends HTMLAttributes<HTMLButtonElement> {
  value: string;
  disabled?: boolean;
  count?: number;
}

export function TabsTrigger({ value, disabled, count, className, children, ...rest }: TabsTriggerProps) {
  const { value: current, setValue, baseId } = useTabs();
  const selected = current === value;
  return (
    <button
      type="button"
      role="tab"
      id={`${baseId}-tab-${value}`}
      aria-selected={selected}
      aria-controls={`${baseId}-panel-${value}`}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      onClick={() => setValue(value)}
      className={cn(
        "relative -mb-px inline-flex h-10 items-center gap-2 border-b px-3 text-[13px] transition-colors duration-200",
        selected ? "border-[var(--lux-gold)] text-[var(--lux-ivory)]" : "border-transparent text-fg-3 hover:text-fg-2",
        disabled && "opacity-40",
        className,
      )}
      {...rest}
    >
      {children}
      {count !== undefined ? <span className="font-mono text-[10.5px] tabular-nums text-fg-4">{count}</span> : null}
    </button>
  );
}

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  /** Keep the panel mounted while hidden. */
  forceMount?: boolean;
}

export function TabsContent({ value, forceMount, className, children, ...rest }: TabsContentProps) {
  const { value: current, baseId } = useTabs();
  const selected = current === value;
  if (!selected && !forceMount) return null;
  return (
    <div
      role="tabpanel"
      id={`${baseId}-panel-${value}`}
      aria-labelledby={`${baseId}-tab-${value}`}
      hidden={!selected}
      tabIndex={0}
      className={cn("pt-4 focus:outline-none", className)}
      {...rest}
    >
      {children}
    </div>
  );
}
