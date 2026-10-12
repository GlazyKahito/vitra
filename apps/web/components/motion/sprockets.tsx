import { cn } from "@/lib/utils";

export interface SprocketsProps {
  /** Which gutter this strip sits in; sets the inner hairline side. */
  side: "left" | "right";
  /** Scroll the holes (film running). Static otherwise. */
  running?: boolean;
  className?: string;
}

/**
 * A vertical gutter of 35 mm sprocket holes. Two copies stacked so the CSS
 * translateY(-50%) loop is seamless. Pure SVG, no JS.
 */
export function Sprockets({ side, running = true, className }: SprocketsProps) {
  const holes = Array.from({ length: 28 }, (_, i) => i);
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 w-10 overflow-hidden bg-ink-0",
        side === "left" ? "left-0 border-r border-[rgba(239,231,214,0.12)]" : "right-0 border-l border-[rgba(239,231,214,0.12)]",
        className,
      )}
    >
      <div className={cn("absolute inset-x-0 top-0 h-[200%]", running && "film-sprocket-run")}>
        <svg width="40" height="100%" viewBox="0 0 40 1120" preserveAspectRatio="none" className="h-full w-full">
          {holes.map((i) => (
            <rect key={i} x="12" y={i * 40 + 10} width="16" height="22" rx="3" fill="none" stroke="rgba(239,231,214,0.35)" strokeWidth="1" />
          ))}
        </svg>
      </div>
    </div>
  );
}
