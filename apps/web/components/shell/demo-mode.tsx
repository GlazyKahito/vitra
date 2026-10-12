"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Whether this server instance is the temporary Vercel demo fallback (no DATABASE_URL: embedded PGlite
 * under /tmp, migrated and seeded on cold start, wiped when the instance recycles). Decided on the server
 * by lib/runtime-mode.ts and passed down from the (app) layout.
 */
const EphemeralDemoContext = createContext(false);

export function EphemeralDemoProvider({ value, children }: { value: boolean; children: ReactNode }) {
  return <EphemeralDemoContext.Provider value={value}>{children}</EphemeralDemoContext.Provider>;
}

export function useEphemeralDemo(): boolean {
  return useContext(EphemeralDemoContext);
}

export const EPHEMERAL_DEMO_TITLE =
  "Temporary demo fallback: no PostgreSQL DATABASE_URL is configured, so this instance runs an embedded database in /tmp that is re-seeded with SYNTHETIC data on every cold start. Anything you create here will be lost.";

/** Small amber pill for the app header. Renders nothing outside ephemeral demo mode. */
export function EphemeralDemoNotice({ className }: { className?: string }) {
  const on = useEphemeralDemo();
  if (!on) return null;
  return (
    <span
      role="note"
      title={EPHEMERAL_DEMO_TITLE}
      className={
        "inline-flex items-center gap-1.5 rounded-full border border-[rgba(232,181,90,0.35)] bg-notice-dim px-2.5 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-notice " +
        (className ?? "")
      }
    >
      <span className="size-1.5 rounded-full bg-notice" aria-hidden />
      Ephemeral demo instance · data resets
    </span>
  );
}
