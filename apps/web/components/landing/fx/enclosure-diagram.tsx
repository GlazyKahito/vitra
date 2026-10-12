import { ANALYTES, demoColor } from "@/lib/analytes";
import { cn } from "@/lib/utils";

/**
 * Exploded line drawing of the prototype enclosure (schematic, not to scale):
 * lid with the Pi 5 + camera lifted off an opaque body, LED strips along the
 * inner top edges, light cone onto the strip, strip slot at the base, and a
 * 120 s dial. Every stroke that should "draw on" uses pathLength=1 + a 1/1
 * dash so GSAP can scrub strokeDashoffset 1→0. Data attributes are the hooks:
 *   data-body  data-lid  data-guide  data-led  data-cone  data-strip
 *   data-dial  data-call="0..5" (leader + label groups)
 */

const iv = "rgb(var(--lc-ivory-rgb) / 0.62)";
const ivDim = "rgb(var(--lc-ivory-rgb) / 0.22)";
const gold = "var(--lc-gold)";
const champ = "var(--lc-champagne)";
const plat = "var(--lux-platinum, #bfc1c2)";
const mono = { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1.4 } as const;
const draw = { pathLength: 1, strokeDasharray: "1 1" } as const;

const LEVELS = [0.2, 0.45, 0.5, 0.1, 0.15, 0.1, 0.3, 0.05, 0.25, 0.55] as const;

interface Callout {
  /** leader path */
  d: string;
  /** label lines */
  lines: string[];
  x: number;
  y: number;
  anchor: "start" | "end";
}

/** Indexed in the order they draw on (see instrument.tsx). */
export const CALLOUTS: Callout[] = [
  { d: "M200 400 H20", lines: ["OPAQUE ENCLOSURE"], x: 20, y: 391, anchor: "start" },
  { d: "M300 101 V44 H20", lines: ["RASPBERRY PI 5"], x: 20, y: 35, anchor: "start" },
  { d: "M240 489 L196 540 H20", lines: ["STRIP SLOT · 10 PADS"], x: 20, y: 531, anchor: "start" },
  { d: "M362 141 H572", lines: ["PI CAMERA"], x: 572, y: 132, anchor: "end" },
  { d: "M218 246 L172 290 H20", lines: ["LED STRIPS,", "BRIGHTNESS-REGULATED"], x: 20, y: 281, anchor: "start" },
  { d: "M404 489 H523", lines: ["120 S TIMED REACTION"], x: 572, y: 530, anchor: "end" },
];

export function EnclosureDiagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 600" className={cn("block overflow-visible", className)} role="img" aria-label="Exploded schematic of the VITRA prototype enclosure">
      <defs>
        <linearGradient id="lc-cone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--lc-champagne)" stopOpacity="0.32" />
          <stop offset="1" stopColor="var(--lc-champagne)" stopOpacity="0.03" />
        </linearGradient>
      </defs>

      {/* exploded guides */}
      <g data-guide stroke={ivDim} strokeDasharray="3 5" fill="none">
        <line x1="200" y1="134" x2="200" y2="230" />
        <line x1="440" y1="134" x2="440" y2="230" />
        <line x1="490" y1="100" x2="490" y2="196" />
      </g>

      {/* body: opaque, drawn as a translucent x-ray so the interior reads */}
      <g data-body fill="none" stroke={iv} strokeWidth="1.2" strokeLinejoin="round">
        <polygon points="200,230 440,230 440,500 200,500" fill="rgb(var(--lc-onyx-rgb) / 0.42)" {...draw} />
        <polygon points="200,230 250,196 490,196 440,230" fill="rgb(var(--lc-onyx-rgb) / 0.25)" {...draw} />
        <polygon points="440,230 490,196 490,466 440,500" fill="rgb(var(--lc-onyx-rgb) / 0.55)" {...draw} />
        {/* strip slot */}
        <rect x="240" y="486" width="160" height="6" rx="1.5" {...draw} />
      </g>

      {/* LED strips along the inner top edges */}
      <g data-led strokeLinecap="round">
        <line x1="262" y1="212" x2="472" y2="212" stroke={champ} strokeOpacity="0.18" strokeWidth="7" />
        <line x1="262" y1="212" x2="472" y2="212" stroke={champ} strokeWidth="1.5" />
        <line x1="218" y1="246" x2="422" y2="246" stroke={champ} strokeOpacity="0.18" strokeWidth="7" />
        <line x1="218" y1="246" x2="422" y2="246" stroke={champ} strokeWidth="1.5" />
      </g>

      {/* light cone from the camera onto the pads */}
      <polygon data-cone points="339,156 351,156 412,470 280,470" fill="url(#lc-cone)" />

      {/* the strip, slid in through the slot */}
      <g data-strip>
        <rect x="262" y="462" width="168" height="9" rx="1.5" fill="rgb(var(--lc-ivory-rgb) / 0.85)" />
        {ANALYTES.map((a, i) => (
          <rect key={a.key} x={302 + i * 12} y="463" width="9" height="7" rx="1" fill={demoColor(a.key, LEVELS[i] ?? 0.15)} />
        ))}
      </g>

      {/* lid: Pi 5 board + camera, lifted */}
      <g data-lid fill="none" stroke={iv} strokeWidth="1.2" strokeLinejoin="round">
        <polygon points="200,118 250,84 490,84 440,118" fill="rgb(var(--lc-onyx-rgb) / 0.4)" {...draw} />
        <polygon points="200,118 440,118 440,134 200,134" fill="rgb(var(--lc-onyx-rgb) / 0.5)" {...draw} />
        <polygon points="440,118 490,84 490,100 440,134" fill="rgb(var(--lc-onyx-rgb) / 0.6)" {...draw} />
        {/* Pi 5 board */}
        <polygon points="252,110 277,93 372,93 347,110" stroke={gold} strokeOpacity="0.85" {...draw} />
        <polygon points="296,105 303,100 318,100 311,105" fill={gold} fillOpacity="0.5" stroke="none" />
        {/* camera module + lens, looking down */}
        <rect x="330" y="134" width="30" height="10" rx="2" {...draw} />
        <circle cx="345" cy="150" r="6" stroke={gold} {...draw} />
        <circle cx="345" cy="150" r="2" fill={gold} stroke="none" />
      </g>

      {/* 120 s dial */}
      <g data-dial>
        <circle cx="538" cy="489" r="15" fill="none" stroke={ivDim} strokeWidth="1.5" />
        <circle data-dial-arc cx="538" cy="489" r="15" fill="none" stroke={gold} strokeWidth="1.5" transform="rotate(-90 538 489)" {...draw} />
        <line x1="538" y1="489" x2="538" y2="479" stroke={gold} strokeWidth="1" />
      </g>

      {/* callouts */}
      {CALLOUTS.map((c, i) => (
        <g key={i} data-call={i}>
          <path data-leader d={c.d} fill="none" stroke={gold} strokeOpacity="0.75" strokeWidth="1" {...draw} />
          <text data-label {...mono} fill={plat} textAnchor={c.anchor}>
            {c.lines.map((l, j) => (
              <tspan key={j} x={c.x} y={c.y + j * 13 - (c.lines.length - 1) * 13}>
                {l}
              </tspan>
            ))}
          </text>
        </g>
      ))}
    </svg>
  );
}
