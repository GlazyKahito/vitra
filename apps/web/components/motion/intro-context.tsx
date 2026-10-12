"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export interface IntroState {
  /** True once the film leader has finished (or was skipped / not shown). */
  introDone: boolean;
  /** Called by the leader. Idempotent. */
  markIntroDone: () => void;
}

const IntroContext = createContext<IntroState>({ introDone: true, markIntroDone: () => undefined });

/**
 * Tiny event bus between the film leader and anything that should wait for it
 * (the hero headline reveal, the hero "landing" tween). Outside the provider
 * `introDone` is always true so components still work on other pages.
 */
export function IntroProvider({ children }: { children: ReactNode }) {
  const [introDone, setIntroDone] = useState(false);
  const markIntroDone = useCallback(() => setIntroDone(true), []);
  const value = useMemo<IntroState>(() => ({ introDone, markIntroDone }), [introDone, markIntroDone]);
  return <IntroContext.Provider value={value}>{children}</IntroContext.Provider>;
}

export function useIntro(): IntroState {
  return useContext(IntroContext);
}
