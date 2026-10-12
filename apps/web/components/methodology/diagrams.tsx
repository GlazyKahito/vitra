import type { ReactNode } from "react";

/* Small, consistent line diagrams for the eleven methodology steps.
   One stroke colour (fg-4), one accent (signal). 240×120 viewBox. */

const S = "var(--color-fg-4)";
const A = "var(--color-signal)";
const N = "var(--color-notice)";

function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 240 120" className="h-[120px] w-[240px]" role="img" aria-label={label}>
      {children}
    </svg>
  );
}

const Strip = ({ x = 20, y = 50, pads = 10, w = 200 }: { x?: number; y?: number; pads?: number; w?: number }) => {
  const handle = w * 0.3;
  const padW = (w - handle - 6) / pads - 3;
  return (
    <g>
      <rect x={x} y={y} width={w} height={16} rx="2" fill="none" stroke={S} />
      {Array.from({ length: pads }).map((_, i) => (
        <rect key={i} x={x + handle + 6 + i * (padW + 3)} y={y + 3} width={padW} height={10} rx="1" fill={S} opacity="0.35" />
      ))}
    </g>
  );
};

export const DIAGRAMS: Record<number, ReactNode> = {
  1: (
    <Frame label="Strip dipped into a sample cup">
      <path d="M70 40 h100 l-8 60 h-84 z" fill="none" stroke={S} />
      <line x1="78" y1="70" x2="162" y2="70" stroke={A} strokeDasharray="2 3" />
      <g transform="rotate(-20 120 60)">
        <Strip x={60} y={30} w={140} />
      </g>
    </Frame>
  ),
  2: (
    <Frame label="A 120 second timer">
      <circle cx="120" cy="60" r="40" fill="none" stroke={S} />
      <path d="M120 20 A40 40 0 1 1 86 82" fill="none" stroke={A} strokeWidth="2" />
      <text x="120" y="66" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="14" fill="var(--color-fg)">
        120 s
      </text>
    </Frame>
  ),
  3: (
    <Frame label="Camera above an LED-lit strip inside an enclosure">
      <rect x="30" y="14" width="180" height="92" rx="4" fill="none" stroke={S} />
      <rect x="108" y="22" width="24" height="12" rx="2" fill="none" stroke={A} />
      <line x1="50" y1="28" x2="50" y2="90" stroke={N} strokeDasharray="2 2" />
      <line x1="190" y1="28" x2="190" y2="90" stroke={N} strokeDasharray="2 2" />
      <Strip x={60} y={80} w={120} />
    </Frame>
  ),
  4: (
    <Frame label="Image quality checklist">
      {["Focus", "Exposure", "Glare", "Tilt"].map((t, i) => (
        <g key={t} transform={`translate(40 ${22 + i * 22})`}>
          <rect width="12" height="12" rx="2" fill="none" stroke={i === 2 ? N : A} />
          {i !== 2 ? <path d="M3 6 l3 3 l4 -6" fill="none" stroke={A} strokeWidth="1.5" /> : <path d="M3 3 l6 6 M9 3 l-6 6" stroke={N} strokeWidth="1.5" />}
          <text x="22" y="10" fontFamily="var(--font-mono)" fontSize="10" fill="var(--color-fg-2)">
            {t}
          </text>
        </g>
      ))}
    </Frame>
  ),
  5: (
    <Frame label="Strip outline found within the frame">
      <rect x="20" y="14" width="200" height="92" fill="none" stroke={S} strokeDasharray="3 3" />
      <g transform="rotate(-4 120 60)">
        <rect x="40" y="52" width="160" height="16" rx="2" fill="none" stroke={A} strokeWidth="1.5" />
      </g>
      <circle cx="42" cy="57" r="2.5" fill={A} />
      <circle cx="198" cy="46" r="2.5" fill={A} />
      <circle cx="201" cy="62" r="2.5" fill={A} />
      <circle cx="44" cy="73" r="2.5" fill={A} />
    </Frame>
  ),
  6: (
    <Frame label="Ten pad regions segmented">
      <Strip x={20} y={52} w={200} />
      {Array.from({ length: 10 }).map((_, i) => (
        <rect key={i} x={20 + 66 + i * 13.4 - 1.5} y={53.5} width={13.4} height={13} fill="none" stroke={A} strokeWidth="0.8" />
      ))}
      <text x="86" y="44" fontFamily="var(--font-mono)" fontSize="8" letterSpacing="1" fill={A}>
        P01 … P10
      </text>
    </Frame>
  ),
  7: (
    <Frame label="RGB to CIELAB conversion">
      <rect x="30" y="40" width="40" height="40" rx="2" fill={S} opacity="0.35" />
      <text x="50" y="98" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--color-fg-2)">
        R G B
      </text>
      <path d="M84 60 h52" stroke={A} />
      <path d="M130 55 l8 5 l-8 5" fill="none" stroke={A} />
      <rect x="150" y="40" width="60" height="40" rx="2" fill="none" stroke={S} />
      <text x="180" y="64" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="10" fill="var(--color-fg)">
        L* a* b*
      </text>
    </Frame>
  ),
  8: (
    <Frame label="Calibration curve through reference points">
      <line x1="30" y1="96" x2="210" y2="96" stroke={S} />
      <line x1="30" y1="96" x2="30" y2="20" stroke={S} />
      {[
        [50, 84],
        [80, 76],
        [110, 62],
        [140, 52],
        [170, 38],
        [200, 30],
      ].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="2.5" fill="none" stroke={S} />
      ))}
      <path d="M40 90 C 100 78, 150 50, 206 26" fill="none" stroke={A} strokeWidth="1.5" />
    </Frame>
  ),
  9: (
    <Frame label="Model inference producing a value and a state">
      <rect x="30" y="40" width="60" height="40" rx="3" fill="none" stroke={S} />
      <text x="60" y="64" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--color-fg-2)">
        features
      </text>
      <path d="M96 60 h28" stroke={A} />
      <rect x="130" y="34" width="80" height="52" rx="3" fill="none" stroke={A} />
      <text x="170" y="54" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--color-fg)">
        value
      </text>
      <text x="170" y="72" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" letterSpacing="1" fill={N}>
        STATE
      </text>
    </Frame>
  ),
  10: (
    <Frame label="Report document">
      <rect x="80" y="14" width="80" height="92" rx="3" fill="none" stroke={S} />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x="92" y={30 + i * 12} width={i === 4 ? 30 : 56} height="4" rx="1" fill={S} opacity="0.5" />
      ))}
      <rect x="92" y="90" width="20" height="6" rx="1" fill={A} opacity="0.6" />
    </Frame>
  ),
  11: (
    <Frame label="Reviewer sign-off">
      <circle cx="70" cy="50" r="14" fill="none" stroke={S} />
      <path d="M48 92 a22 22 0 0 1 44 0" fill="none" stroke={S} />
      <rect x="120" y="36" width="90" height="48" rx="3" fill="none" stroke={S} />
      <path d="M134 60 l10 10 l24 -22" fill="none" stroke={A} strokeWidth="2" />
      <text x="170" y="78" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" letterSpacing="1" fill="var(--color-fg-3)">
        SIGNED
      </text>
    </Frame>
  ),
};
