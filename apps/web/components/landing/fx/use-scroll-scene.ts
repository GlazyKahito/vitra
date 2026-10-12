"use client";

import { useEffect, useRef, type DependencyList, type RefObject } from "react";
import { useReducedMotion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useStage } from "@/components/stage/smooth-scroll";

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

/**
 * One GSAP scope per scene. The setup runs inside `gsap.context` (so every
 * tween / ScrollTrigger it makes is reverted on unmount), only after the film
 * intro has finished (so pinned sections measure the real page), and never
 * under reduced motion — callers render their static, fully visible layout.
 *
 * Returns `reduced` so the caller can branch its markup.
 */
export function useScrollScene(scope: RefObject<HTMLElement | null>, setup: (el: HTMLElement) => void | (() => void), deps: DependencyList = []): boolean {
  const reduced = useReducedMotion() ?? false;
  const { introDone } = useStage();
  const setupRef = useRef(setup);
  setupRef.current = setup;

  useEffect(() => {
    const el = scope.current;
    if (!el || reduced || !introDone) return;
    let cleanup: void | (() => void);
    const ctx = gsap.context(() => {
      cleanup = setupRef.current(el);
    }, el);
    return () => {
      if (typeof cleanup === "function") cleanup();
      ctx.revert();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, introDone, ...deps]);

  return reduced;
}
