"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useStage } from "./smooth-scroll";

/**
 * Mounts its children only once the opening has finished and the browser is
 * idle, so the intro never competes with hydrating the chapters below the
 * cover. A full-height spacer holds the scroll length meanwhile.
 */
export function AfterIntro({ children }: { children: ReactNode }) {
  const { introDone } = useStage();
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!introDone || show) return;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setShow(true), { timeout: 600 });
      return () => (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setShow(true), 120);
    return () => window.clearTimeout(t);
  }, [introDone, show]);
  return show ? <>{children}</> : <div aria-hidden style={{ height: "100vh" }} />;
}
