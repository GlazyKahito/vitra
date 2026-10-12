"use client";

import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Children, useEffect, useState, type ReactNode } from "react";
import { useStage } from "./smooth-scroll";

/** Wait for the intro's fade to finish before doing any heavy work. */
const START_DELAY_MS = 1100;

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/**
 * Mounts the chapters below the cover only after the opening has fully faded,
 * and then one chapter per idle slot, so the hand-off from the intro to the
 * homescreen never stalls on hydrating ten animated sections at once. A spacer
 * holds the scroll length for the chapters still to come.
 */
export function AfterIntro({ children }: { children: ReactNode }) {
  const { introDone } = useStage();
  const items = Children.toArray(children);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!introDone || count >= items.length) return;
    const w = window as IdleWindow;
    let idle = 0;
    const next = () => {
      if (w.requestIdleCallback) idle = w.requestIdleCallback(() => setCount((c) => c + 1), { timeout: 400 });
      else idle = window.setTimeout(() => setCount((c) => c + 1), 60);
    };
    const t = window.setTimeout(next, count === 0 ? START_DELAY_MS : 0);
    return () => {
      window.clearTimeout(t);
      if (w.cancelIdleCallback) w.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
    };
  }, [introDone, count, items.length]);

  // once everything is in place, measure every pinned section against the final layout
  useEffect(() => {
    if (count === items.length && count > 0) requestAnimationFrame(() => ScrollTrigger.refresh());
  }, [count, items.length]);

  return (
    <>
      {items.slice(0, count)}
      {count < items.length && <div aria-hidden style={{ height: `${(items.length - count) * 100}vh` }} />}
    </>
  );
}
