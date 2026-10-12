"use client";

import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Children, useEffect, useState, type ReactNode } from "react";
import { markReady } from "./film-intro";

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

/**
 * Builds the chapters below the cover one per idle slot WHILE the intro is
 * still on screen — its LED climb is a compositor animation, so it stays smooth
 * while the page assembles underneath. The intro waits for this ("chapters"
 * ready step) before it opens, so nothing heavy is left to do afterwards.
 * A spacer holds the scroll length for chapters still to come.
 */
export function AfterIntro({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (count >= items.length) return;
    const w = window as IdleWindow;
    let id = 0;
    if (w.requestIdleCallback) id = w.requestIdleCallback(() => setCount((c) => c + 1), { timeout: 160 });
    else id = window.setTimeout(() => setCount((c) => c + 1), 16);
    return () => {
      if (w.cancelIdleCallback) w.cancelIdleCallback(id);
      else window.clearTimeout(id);
    };
  }, [count, items.length]);

  // everything in place: measure every pinned section against the final layout, then let the intro open
  useEffect(() => {
    if (count !== items.length) return;
    requestAnimationFrame(() => {
      ScrollTrigger.refresh();
      markReady("chapters");
    });
  }, [count, items.length]);

  return (
    <>
      {items.slice(0, count)}
      {count < items.length && <div aria-hidden style={{ height: `${(items.length - count) * 100}vh` }} />}
    </>
  );
}
