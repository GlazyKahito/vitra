"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface TimecodeProps {
  /** frames per second for the ff field; default 24 */
  fps?: number;
  /** show "IST" suffix; default true */
  zone?: boolean;
  className?: string;
}

function formatIST(now: Date, fps: number): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const ff = Math.floor((now.getMilliseconds() / 1000) * fps)
    .toString()
    .padStart(2, "0");
  return `${get("hour")}:${get("minute")}:${get("second")}:${ff}`;
}

/** Live hh:mm:ss:ff timecode in IST. Renders a placeholder on the server to avoid hydration drift. */
export function Timecode({ fps = 24, zone = true, className }: TimecodeProps) {
  const [tc, setTc] = useState<string>("--:--:--:--");

  useEffect(() => {
    let raf = 0;
    let last = "";
    const tick = () => {
      const next = formatIST(new Date(), fps);
      if (next !== last) {
        last = next;
        setTc(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fps]);

  return (
    <span className={cn("font-mono text-[11px] tabular-nums tracking-[0.08em] text-fg-3", className)} suppressHydrationWarning>
      {tc}
      {zone ? <span className="ml-1.5 text-fg-4">IST</span> : null}
    </span>
  );
}
