"use client";

import { ReactLenis, useLenis } from "lenis/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

gsap.registerPlugin(ScrollTrigger);
// The intro and transitions must finish in real time, not stretch on a dropped frame.
gsap.ticker.lagSmoothing(0);

interface StageContextValue {
  /** True once the film leader has finished (or was skipped). */
  introDone: boolean;
  finishIntro: () => void;
}

const StageContext = createContext<StageContextValue>({ introDone: true, finishIntro: () => {} });

export function useStage() {
  return useContext(StageContext);
}

/** Drives Lenis from GSAP's ticker so ScrollTrigger and smooth scroll share one clock. */
function LenisGsapBridge() {
  const lenis = useLenis(() => ScrollTrigger.update());
  useEffect(() => {
    if (!lenis) return;
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [lenis]);
  return null;
}

function ScrollLock({ locked }: { locked: boolean }) {
  const lenis = useLenis();
  useEffect(() => {
    if (!lenis) return;
    if (locked) lenis.stop();
    else {
      lenis.start();
      // Pinned sections measured while the intro covered the page.
      requestAnimationFrame(() => ScrollTrigger.refresh());
    }
  }, [lenis, locked]);
  return null;
}

/**
 * The landing's runtime: Lenis smooth scrolling (desktop wheel), GSAP sync,
 * and the intro gate every scene waits on.
 */
export function StageProvider({ children }: { children: ReactNode }) {
  const [introDone, setIntroDone] = useState(false);
  const doneRef = useRef(false);
  const finishIntro = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    setIntroDone(true);
    document.documentElement.dataset.introDone = "true";
  }, []);

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    return () => {
      delete document.documentElement.dataset.introDone;
    };
  }, []);

  const value = useMemo(() => ({ introDone, finishIntro }), [introDone, finishIntro]);

  return (
    <ReactLenis root options={{ autoRaf: false, lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: true, syncTouch: false }}>
      <LenisGsapBridge />
      <ScrollLock locked={!introDone} />
      <StageContext.Provider value={value}>{children}</StageContext.Provider>
    </ReactLenis>
  );
}
