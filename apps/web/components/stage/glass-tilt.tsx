"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface GlassTiltProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Max tilt in degrees. */
  max?: number;
  /** Render as a different element (section, figure, …). */
  as?: "div" | "figure" | "section" | "article" | "aside";
}

/**
 * A pane of glass that leans toward the pointer. The tilt and the specular
 * highlight (--mx/--my, read by `.glass-sheen`) are written straight to the
 * element's style from one rAF, so React never re-renders on pointer moves.
 */
export function GlassTilt({ children, className, style, max = 6, as: Tag = "div" }: GlassTiltProps) {
  const ref = useRef<HTMLElement | null>(null);
  const raf = useRef(0);
  const target = useRef({ x: 0.5, y: 0.5, on: false });
  const cur = useRef({ x: 0.5, y: 0.5, k: 0 });

  const loop = () => {
    const el = ref.current;
    if (!el) return;
    const t = target.current;
    const c = cur.current;
    c.x += (t.x - c.x) * 0.14;
    c.y += (t.y - c.y) * 0.14;
    c.k += ((t.on ? 1 : 0) - c.k) * 0.1;
    const rx = (0.5 - c.y) * max * 2 * c.k;
    const ry = (c.x - 0.5) * max * 2 * c.k;
    el.style.transform = `perspective(1100px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateZ(0)`;
    el.style.setProperty("--mx", `${(c.x * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(c.y * 100).toFixed(1)}%`);
    el.style.setProperty("--sheen", (0.35 + 0.65 * c.k).toFixed(3));
    const settled = !t.on && c.k < 0.002;
    if (settled) {
      el.style.transform = "";
      raf.current = 0;
      return;
    }
    raf.current = requestAnimationFrame(loop);
  };
  const kick = () => {
    if (!raf.current) raf.current = requestAnimationFrame(loop);
  };

  return (
    <Tag
      ref={ref as never}
      className={cn("glass glass-sheen will-change-transform", className)}
      style={{ transformStyle: "preserve-3d", ...style }}
      onPointerMove={(e: React.PointerEvent<HTMLElement>) => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const r = e.currentTarget.getBoundingClientRect();
        target.current = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, on: true };
        kick();
      }}
      onPointerLeave={() => {
        target.current = { ...target.current, on: false };
        kick();
      }}
    >
      {children}
    </Tag>
  );
}
