import { useId } from "react";
import { cn } from "@/lib/utils";

export interface DeviceIllustrationProps {
  width?: number;
  /** Show the screen glow and the LED slot glow. Default true. */
  powered?: boolean;
  className?: string;
}

/**
 * Original isometric illustration of the VITRA enclosure: a matte black box,
 * touchscreen on the upper front face, strip slot along the bottom edge with a
 * half-inserted strip and a cyan LED glow. Pure SVG — used as the R3F fallback.
 */
export function DeviceIllustration({ width = 520, powered = true, className }: DeviceIllustrationProps) {
  const uid = useId().replace(/:/g, "");
  const h = (width * 420) / 560;
  return (
    <svg viewBox="0 0 560 420" width={width} height={h} className={cn("block overflow-visible", className)} role="img" aria-label="Illustration of the VITRA prototype enclosure">
      <defs>
        <linearGradient id={`${uid}-top`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2b2d31" />
          <stop offset="1" stopColor="#1a1c1f" />
        </linearGradient>
        <linearGradient id={`${uid}-front`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#17181b" />
          <stop offset="1" stopColor="#0c0d0f" />
        </linearGradient>
        <linearGradient id={`${uid}-side`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0f1012" />
          <stop offset="1" stopColor="#060607" />
        </linearGradient>
        <linearGradient id={`${uid}-screen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0d1518" />
          <stop offset="1" stopColor="#071012" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#5fd4e6" stopOpacity="0.55" />
          <stop offset="1" stopColor="#5fd4e6" stopOpacity="0" />
        </radialGradient>
        <filter id={`${uid}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
        <filter id={`${uid}-shadow`} x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="26" stdDeviation="22" floodColor="#000" floodOpacity="0.7" />
        </filter>
      </defs>

      {/* ground glow */}
      {powered ? <ellipse cx="300" cy="372" rx="170" ry="26" fill={`url(#${uid}-glow)`} opacity="0.5" /> : null}

      <g filter={`url(#${uid}-shadow)`}>
        {/* main body: isometric box. front face (x 120..400, y 150..340), top, right side */}
        {/* right side */}
        <polygon points="400,150 470,110 470,300 400,340" fill={`url(#${uid}-side)`} />
        {/* top */}
        <polygon points="120,150 190,110 470,110 400,150" fill={`url(#${uid}-top)`} />
        {/* front */}
        <rect x="120" y="150" width="280" height="190" fill={`url(#${uid}-front)`} />
        {/* raised screen bezel (top-front cap) */}
        <polygon points="100,120 170,80 480,80 410,120" fill="#24262a" />
        <polygon points="410,120 480,80 480,200 410,240" fill="#0b0c0e" />
        <rect x="100" y="120" width="310" height="120" fill="#141518" />
        {/* edge hairlines */}
        <line x1="100" y1="120" x2="410" y2="120" stroke="rgba(255,255,255,0.14)" />
        <line x1="120" y1="150" x2="400" y2="150" stroke="rgba(255,255,255,0.05)" />
        <line x1="410" y1="120" x2="480" y2="80" stroke="rgba(255,255,255,0.12)" />

        {/* screen */}
        <rect x="118" y="134" width="274" height="92" rx="3" fill={`url(#${uid}-screen)`} stroke="rgba(255,255,255,0.08)" />
        {powered ? (
          <g>
            <rect x="118" y="134" width="274" height="92" rx="3" fill="#5fd4e6" opacity="0.08" filter={`url(#${uid}-blur)`} />
            {/* screen UI: ten small pads + a readout line */}
            {Array.from({ length: 10 }).map((_, i) => (
              <rect key={i} x={132 + i * 24} y="150" width="16" height="16" rx="1.5" fill="rgba(95,212,230,0.18)" stroke="rgba(95,212,230,0.5)" strokeWidth="0.8" />
            ))}
            <rect x="132" y="178" width="140" height="3" rx="1.5" fill="rgba(255,255,255,0.18)" />
            <rect x="132" y="188" width="92" height="3" rx="1.5" fill="rgba(255,255,255,0.1)" />
            <rect x="132" y="204" width="56" height="10" rx="2" fill="rgba(95,212,230,0.25)" />
            <text x="312" y="212" fontFamily="var(--font-mono)" fontSize="9" letterSpacing="1.5" fill="#5fd4e6" opacity="0.9">
              120 s
            </text>
          </g>
        ) : null}

        {/* side buttons */}
        {[0, 1, 2].map((i) => (
          <rect key={i} x="402" y={160 + i * 12} width="4" height="8" rx="1" fill="#2d3035" />
        ))}

        {/* strip slot at the bottom-left edge of the front face */}
        <rect x="140" y="318" width="110" height="8" rx="2" fill="#000" />
        {powered ? <rect x="140" y="318" width="110" height="8" rx="2" fill="#5fd4e6" opacity="0.35" filter={`url(#${uid}-blur)`} /> : null}
        <rect x="140" y="321" width="110" height="2" fill={powered ? "#5fd4e6" : "#1a1c20"} opacity={powered ? 0.9 : 1} />
      </g>

      {/* half-inserted strip (handle sticking out to the left, pads inside) */}
      <g transform="translate(40 316) rotate(-3)">
        <rect x="0" y="0" width="124" height="12" rx="2" fill="#ecebe4" />
        <rect x="0" y="0" width="124" height="4" rx="2" fill="rgba(255,255,255,0.4)" />
        {["#e9e27a", "#c8b84a", "#e7c9a8"].map((c, i) => (
          <rect key={i} x={94 + i * 11} y="2" width="8" height="8" rx="0.8" fill={c} opacity="0.9" />
        ))}
      </g>

      {/* callout labels */}
      <g fontFamily="var(--font-mono)" fontSize="9" letterSpacing="1.6" fill="var(--color-fg-4)">
        <text x="500" y="78">TOUCHSCREEN</text>
        <line x1="482" y1="84" x2="440" y2="100" stroke="var(--color-fg-4)" strokeWidth="0.6" />
        <text x="20" y="372">STRIP SLOT · LED</text>
        <line x1="90" y1="364" x2="130" y2="330" stroke="var(--color-fg-4)" strokeWidth="0.6" />
      </g>
    </svg>
  );
}
