import { useId } from "react";
import { ANALYTES, demoColor, type AnalyteKey } from "@/lib/analytes";
import { cn } from "@/lib/utils";

export type StripLevels = Partial<Record<AnalyteKey, number>>;

export interface ReagentStripProps {
  /** 0..1 per analyte; missing keys default to 0.15 (an unreacted-looking pad). */
  levels?: StripLevels;
  /** Total rendered width in px (height follows the 8.6:1 aspect). Default 560. */
  width?: number;
  /** Print the analyte short codes under each pad. */
  labels?: boolean;
  /** Draw the strip vertically (handle at the bottom). */
  vertical?: boolean;
  /** Highlight one pad (cyan outline). */
  highlight?: AnalyteKey | null;
  className?: string;
}

/**
 * Ten-pad reagent strip, handle on the left. Pure SVG, server-safe.
 * Pad colours come from each analyte's synthetic demoRamp — these are
 * illustrative only and never represent a real chart colour.
 */
export function ReagentStrip({ levels = {}, width = 560, labels = false, vertical = false, highlight = null, className }: ReagentStripProps) {
  const uid = useId().replace(/:/g, "");
  const VB_W = 860;
  const VB_H = labels ? 124 : 100;
  const stripY = 22;
  const stripH = 56;
  const padSize = 44;
  const handleW = 290;
  const gap = 12;
  const padsStartX = handleW + 10;

  const height = (width * VB_H) / VB_W;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      width={vertical ? height : width}
      height={vertical ? width : height}
      className={cn("block overflow-visible", className)}
      role="img"
      aria-label="Illustration of a ten-pad urine reagent strip"
      style={vertical ? { transform: "rotate(-90deg)", transformOrigin: "center" } : undefined}
    >
      <defs>
        <linearGradient id={`${uid}-plastic`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f7f5ef" />
          <stop offset="0.5" stopColor="#ecebe4" />
          <stop offset="1" stopColor="#dcdad2" />
        </linearGradient>
        <filter id={`${uid}-texture`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="grey" />
          <feComponentTransfer in="grey" result="soft">
            <feFuncA type="linear" slope="0.08" />
          </feComponentTransfer>
          <feBlend in="SourceGraphic" in2="soft" mode="multiply" />
        </filter>
        <filter id={`${uid}-shadow`} x="-5%" y="-40%" width="110%" height="200%">
          <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#000" floodOpacity="0.55" />
        </filter>
        <filter id={`${uid}-padgrain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="3" result="n" />
          <feColorMatrix type="saturate" values="0" in="n" result="g" />
          <feComponentTransfer in="g" result="s">
            <feFuncA type="linear" slope="0.12" />
          </feComponentTransfer>
          <feBlend in="SourceGraphic" in2="s" mode="multiply" />
        </filter>
      </defs>

      {/* body */}
      <g filter={`url(#${uid}-shadow)`}>
        <rect x="0" y={stripY} width={VB_W - 2} height={stripH} rx="4" fill={`url(#${uid}-plastic)`} filter={`url(#${uid}-texture)`} />
      </g>
      {/* handle sheen */}
      <rect x="0" y={stripY} width={handleW} height={stripH} rx="4" fill="rgba(255,255,255,0.18)" />
      <rect x="18" y={stripY + 20} width="86" height="2" rx="1" fill="rgba(0,0,0,0.12)" />
      <rect x="18" y={stripY + 28} width="54" height="2" rx="1" fill="rgba(0,0,0,0.09)" />
      <text x="18" y={stripY + 44} fontFamily="var(--font-mono)" fontSize="9" letterSpacing="2" fill="rgba(0,0,0,0.32)">
        10-PARAMETER · ILLUSTRATIVE
      </text>

      {/* pads */}
      {ANALYTES.map((a, i) => {
        const x = padsStartX + i * (padSize + gap);
        const y = stripY + (stripH - padSize) / 2;
        const level = levels[a.key] ?? 0.15;
        const fill = demoColor(a.key, level);
        const hot = highlight === a.key;
        return (
          <g key={a.key}>
            <rect x={x} y={y} width={padSize} height={padSize} rx="1.5" fill={fill} filter={`url(#${uid}-padgrain)`} />
            <rect x={x} y={y} width={padSize} height={padSize} rx="1.5" fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="1" />
            <rect x={x + 1} y={y + 1} width={padSize - 2} height={padSize * 0.35} rx="1" fill="rgba(255,255,255,0.12)" />
            {hot ? <rect x={x - 4} y={y - 4} width={padSize + 8} height={padSize + 8} rx="2.5" fill="none" stroke="var(--color-signal)" strokeWidth="1.5" /> : null}
            {labels ? (
              <text x={x + padSize / 2} y={VB_H - 10} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" letterSpacing="1.5" fill="var(--color-fg-3)">
                {a.short}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
