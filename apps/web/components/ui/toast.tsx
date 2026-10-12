"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "neutral" | "signal" | "notice" | "fault";

export interface ToastInput {
  title: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
  /** ms; default 5000, 0 = sticky */
  duration?: number;
}

interface ToastRecord extends ToastInput {
  id: number;
}

interface ToastContextValue {
  toast: (t: ToastInput) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const ICONS: Record<ToastTone, typeof Info> = { neutral: Info, signal: CheckCircle2, notice: AlertTriangle, fault: XCircle };
const TONE_CLS: Record<ToastTone, string> = { neutral: "text-fg-2", signal: "text-signal", notice: "text-notice", fault: "text-fault" };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastRecord[]>([]);
  const seq = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const toast = useCallback(
    (t: ToastInput) => {
      const id = ++seq.current;
      setItems((list) => [...list.slice(-4), { ...t, id }]);
      const duration = t.duration ?? 5000;
      if (duration > 0) timers.current.set(id, setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-[360px] flex-col gap-2" aria-live="polite" aria-relevant="additions">
        {items.map((t) => {
          const tone = t.tone ?? "neutral";
          const Icon = ICONS[tone];
          return (
            <div key={t.id} role="status" className="panel pointer-events-auto flex items-start gap-3 px-4 py-3 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]">
              <Icon className={cn("mt-0.5 size-4 shrink-0", TONE_CLS[tone])} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-fg">{t.title}</div>
                {t.description ? <div className="mt-0.5 text-[12.5px] leading-relaxed text-fg-3">{t.description}</div> : null}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-mr-1 rounded p-1 text-fg-4 hover:text-fg">
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
