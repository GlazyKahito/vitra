"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export interface ParallaxProps {
  children: ReactNode;
  /** Scroll speed factor; 0.2 moves 20% of scroll distance. Negative inverts. */
  speed?: number;
  className?: string;
}

/** GSAP ScrollTrigger parallax. Registers the plugin in the effect, cleans up, no-ops under reduced motion. */
export function Parallax({ children, speed = 0.2, className }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      gsap.fromTo(
        el,
        { yPercent: -speed * 50 },
        {
          yPercent: speed * 50,
          ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true },
        },
      );
    }, el);
    return () => ctx.revert();
  }, [speed, reduced]);

  return (
    <div ref={ref} className={className} style={{ willChange: reduced ? undefined : "transform" }}>
      {children}
    </div>
  );
}
