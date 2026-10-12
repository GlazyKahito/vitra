"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export interface ReactionTimerState {
  seconds: number;
  startedAt: string | null; // ISO
  completed: boolean;
  untimed: boolean;
}

export interface ReactionTimerProps {
  draftId: string;
  defaultSeconds: number;
  value: ReactionTimerState;
  onChange: (next: ReactionTimerState) => void;
}

const storageKey = (draftId: string) => `vitra.reaction.${draftId}`;

export function loadTimerState(draftId: string, defaultSeconds: number): ReactionTimerState {
  const fallback: ReactionTimerState = { seconds: defaultSeconds, startedAt: null, completed: false, untimed: false };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(storageKey(draftId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ReactionTimerState>;
    return {
      seconds: typeof parsed.seconds === "number" && parsed.seconds > 0 ? parsed.seconds : defaultSeconds,
      startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : null,
      completed: Boolean(parsed.completed),
      untimed: Boolean(parsed.untimed),
    };
  } catch {
    return fallback;
  }
}

export function clearTimerState(draftId: string) {
  try {
    window.localStorage.removeItem(storageKey(draftId));
  } catch {
    /* storage unavailable */
  }
}

function fmt(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Reaction timer. Persists to localStorage under the draft id so a refresh
 * resumes from the original start time (wall clock, not an in-memory counter).
 */
export function ReactionTimer({ draftId, defaultSeconds, value, onChange }: ReactionTimerProps) {
  const [now, setNow] = useState(() => Date.now());
  const raf = useRef<number | null>(null);

  // persist
  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey(draftId), JSON.stringify(value));
    } catch {
      /* storage unavailable */
    }
  }, [draftId, value]);

  const running = value.startedAt !== null && !value.completed;
  useEffect(() => {
    if (!running) return;
    let active = true;
    const tick = () => {
      if (!active) return;
      setNow(Date.now());
      raf.current = window.setTimeout(tick, 250);
    };
    tick();
    return () => {
      active = false;
      if (raf.current) window.clearTimeout(raf.current);
    };
  }, [running]);

  const elapsed = value.startedAt ? (now - new Date(value.startedAt).getTime()) / 1000 : 0;
  const remaining = Math.max(0, value.seconds - elapsed);
  const progress = value.seconds > 0 ? Math.min(1, elapsed / value.seconds) : 0;

  useEffect(() => {
    if (running && remaining <= 0) onChange({ ...value, completed: true });
  }, [running, remaining, value, onChange]);

  const start = useCallback(() => onChange({ ...value, startedAt: new Date().toISOString(), completed: false }), [onChange, value]);
  const cancel = useCallback(() => onChange({ ...value, startedAt: null, completed: false }), [onChange, value]);

  const size = 168;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-5 flex flex-col items-center gap-4">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line-strong)" strokeWidth={stroke} />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={value.completed ? "var(--color-signal)" : running ? "var(--color-signal)" : "var(--color-fg-4)"}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - (value.completed ? 1 : progress))}
              style={{ transition: "stroke-dashoffset 250ms linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="t-mono text-[34px] leading-none tracking-[-0.02em] text-fg">{value.completed ? fmt(value.seconds) : fmt(remaining)}</div>
            <div className="t-eyebrow mt-2">{value.completed ? "complete" : running ? "remaining" : "ready"}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!running && !value.completed ? (
            <Button type="button" onClick={start} disabled={value.untimed}>
              Start timer
            </Button>
          ) : null}
          {running ? (
            <Button type="button" variant="secondary" onClick={cancel}>
              Cancel
            </Button>
          ) : null}
          {value.completed ? (
            <Button type="button" variant="ghost" size="sm" onClick={cancel}>
              Reset
            </Button>
          ) : null}
        </div>
      </div>

      <div className="col-span-7 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="panel-inset px-4 py-3">
            <div className="t-eyebrow">Elapsed</div>
            <div className="t-mono mt-1 text-[20px] text-fg">{fmt(Math.min(elapsed, value.seconds))}</div>
          </div>
          <div className="panel-inset px-4 py-3">
            <div className="t-eyebrow">Started</div>
            <div className="t-mono mt-1 text-[13px] text-fg-2">{value.startedAt ? new Date(value.startedAt).toLocaleTimeString("en-GB") : "—"}</div>
          </div>
        </div>

        <label className="flex items-center justify-between gap-4 text-[12.5px] text-fg-2">
          <span>
            Reaction time (seconds)
            <span className="ml-2 text-fg-4">default {defaultSeconds} s from the strip product</span>
          </span>
          <Input
            type="number"
            mono
            min={10}
            max={900}
            step={5}
            value={value.seconds}
            disabled={running || value.completed}
            onChange={(e) => onChange({ ...value, seconds: Math.max(10, Math.min(900, Number(e.target.value) || defaultSeconds)) })}
            className="h-9 w-28 text-right"
          />
        </label>

        <label className={cn("flex items-start gap-3 rounded-[var(--radius-sm)] border border-line px-4 py-3 text-[12.5px]", value.untimed ? "border-[rgba(232,181,90,0.35)] bg-notice-dim" : "")}>
          <input type="checkbox" className="mt-0.5 accent-[var(--color-notice)]" checked={value.untimed} disabled={running} onChange={(e) => onChange({ ...value, untimed: e.target.checked, startedAt: e.target.checked ? null : value.startedAt, completed: false })} />
          <span className="text-fg-2">
            <span className="font-medium text-fg">Untimed capture.</span> I acknowledge the reaction time was not controlled by VITRA. The run is recorded without a reaction start time and the result table will say so.
          </span>
        </label>

        <p className="text-[12px] leading-relaxed text-fg-4">The timer uses the wall clock, so a page refresh resumes from the original start. Colour development on a dipped strip is typically read at 60–120 s; the device prototype waits {defaultSeconds} s.</p>
      </div>
    </div>
  );
}
