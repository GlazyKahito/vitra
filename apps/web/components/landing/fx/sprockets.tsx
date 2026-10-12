import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * 35 mm perforations as a repeating CSS background (one element, no SVG nodes),
 * so a whole row can be translated by GSAP as a single composited layer.
 * `axis="x"` runs along the top/bottom edge of a strip; `axis="y"` down a gutter.
 */
export function Perforations({ axis, className, style }: { axis: "x" | "y"; className?: string; style?: CSSProperties }) {
  return <div aria-hidden className={cn(axis === "x" ? "lc-perf-x" : "lc-perf-y", "pointer-events-none", className)} style={style} />;
}
