"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { ANALYTES, hexToRgb, mixHex } from "@/lib/analytes";
import { cn } from "@/lib/utils";

/**
 * Miniature, schematic previews of each console module, drawn in the instrument style. They carry no
 * database values: shapes and labels only, plus the protocol constants the app really uses (10 pads,
 * 120 s reaction window, 30-D feature vector). Every frame is tagged "Schematic · synthetic".
 */

const IV = "rgb(var(--lc-ivory-rgb) / 0.10)"; // hairline
const CYAN = "#5fd4e6";

export function PreviewFrame({ path, children, className }: { path: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("glass-inset flex h-full min-h-[360px] flex-col overflow-hidden !rounded-[14px]", className)}>
      <div className="flex items-center gap-3 border-b px-4 py-2.5" style={{ borderColor: IV }}>
        <span className="flex gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-[7px] rounded-full bg-[rgb(var(--lc-ivory-rgb)/0.14)]" />
          ))}
        </span>
        <span className="font-mono text-[10.5px] tracking-[0.12em] text-[var(--lux-platinum)]/70">vitra{path}</span>
        <span className="ml-auto rounded-[3px] border border-dashed border-[rgb(var(--lc-gold-rgb)/0.55)] px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--lux-champagne)]/90">
          Schematic · synthetic
        </span>
      </div>
      <div className="relative flex-1 p-5">{children}</div>
    </div>
  );
}

const Mono = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn("font-mono text-[9.5px] uppercase tracking-[0.16em] text-[var(--lux-platinum)]/65", className)}>{children}</span>
);
const Ghost = ({ w, className }: { w: string | number; className?: string }) => (
  <span className={cn("block h-[6px] rounded-full bg-[rgb(var(--lc-ivory-rgb)/0.12)]", className)} style={{ width: w }} />
);

/** Illustrative pad colours: jewel tones from the deep end of each synthetic demo ramp (as on the homescreen). */
const JEWEL = ANALYTES.map((a) => mixHex(a.demoRamp[2], "#ebdab0", 0.28));

/* ───────────────────────── 01 console ───────────────────────── */
export function ConsolePreview() {
  const bars = [3, 5, 2, 6, 4, 7, 5, 3, 6, 8, 4, 5, 7, 6];
  return (
    <PreviewFrame path=" / console">
      <div className="grid grid-cols-4 border-y" style={{ borderColor: IV }}>
        {["Runs · 7 d", "Pending review", "Image faults", "Active models"].map((l, i) => (
          <div key={l} className="border-l px-3 py-3 first:border-l-0" style={{ borderColor: IV }}>
            <Mono>{l}</Mono>
            <span className={cn("mt-2.5 block h-5 w-10 rounded-[3px]", i === 2 ? "bg-fault/35" : i === 1 ? "bg-[rgb(var(--lc-gold-rgb)/0.35)]" : "bg-[rgb(var(--lc-ivory-rgb)/0.14)]")} />
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-[1fr_120px] gap-6">
        <div>
          <Mono>Runs per day · 14 d</Mono>
          <svg viewBox="0 0 280 96" className="mt-2 h-[110px] w-full" aria-hidden>
            {[24, 48, 72].map((y) => (
              <line key={y} x1="0" x2="280" y1={y} y2={y} stroke="rgba(242,235,221,0.07)" />
            ))}
            {bars.map((b, i) => (
              <g key={i}>
                <rect x={i * 20 + 3} y={96 - b * 11} width="12" height={b * 11} fill={CYAN} opacity="0.75" />
                {i === 3 || i === 9 ? <rect x={i * 20 + 3} y={96 - 11} width="12" height="11" fill="var(--color-fault)" opacity="0.85" /> : null}
              </g>
            ))}
          </svg>
        </div>
        <div>
          <Mono>Status</Mono>
          <svg viewBox="0 0 100 100" className="mt-2 size-[100px] -rotate-90" aria-hidden>
            {[
              [0, 0.42, CYAN],
              [0.42, 0.22, "var(--lux-gold)"],
              [0.64, 0.2, "rgba(191,193,194,0.6)"],
              [0.84, 0.1, "rgba(191,193,194,0.3)"],
              [0.94, 0.06, "var(--color-fault)"],
            ].map(([o, l, c], i) => (
              <circle key={i} cx="50" cy="50" r="38" fill="none" stroke={c as string} strokeWidth="10" pathLength={1} strokeDasharray={`${(l as number) - 0.01} 1`} strokeDashoffset={-(o as number)} />
            ))}
          </svg>
        </div>
      </div>
      <div className="mt-4 flex flex-col">
        {[0, 1, 2].map((r) => (
          <div key={r} className="flex items-center gap-4 border-t py-2" style={{ borderColor: IV }}>
            <Ghost w={56} />
            <Ghost w={44} />
            <span className={cn("ml-auto h-[14px] w-[70px] rounded-full border", r === 1 ? "border-[rgb(var(--lc-gold-rgb)/0.6)]" : "border-[#5fd4e6]/50")} />
          </div>
        ))}
      </div>
    </PreviewFrame>
  );
}

/* ───────────────────────── 02 new analysis + timer ───────────────────────── */
function useCountdown(active: boolean, total = 120, speed = 10) {
  const reduce = useReducedMotion();
  const [left, setLeft] = useState(total);
  useEffect(() => {
    if (!active || reduce) {
      setLeft(total);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = ((now - start) / 1000) * speed;
      setLeft(Math.max(0, total - (elapsed % (total + 20))));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, reduce, total, speed]);
  return left;
}

export function NewAnalysisPreview({ active = true }: { active?: boolean }) {
  const left = useCountdown(active);
  const frac = left / 120;
  const s = Math.ceil(left);
  const done = left <= 0;
  const steps = ["Sample registration", "Reaction timer", "Image acquisition", "Submit"];
  return (
    <PreviewFrame path=" / analysis / new">
      <div className="grid h-full grid-cols-[170px_1fr] gap-6">
        <ol className="flex flex-col gap-1">
          {steps.map((st, i) => {
            const on = i === 1 || (done && i === 2);
            return (
              <li key={st} className={cn("flex items-center gap-3 rounded-[8px] px-2.5 py-2", on && "bg-[rgb(var(--lc-ivory-rgb)/0.06)]")}>
                <span className={cn("grid size-5 place-items-center rounded-full border font-mono text-[9.5px]", on ? "border-[var(--lux-gold)] text-[var(--lux-champagne)]" : "border-[rgb(var(--lc-ivory-rgb)/0.2)] text-[var(--lux-platinum)]/60")}>
                  {"ABCD"[i]}
                </span>
                <span className={cn("text-[12px]", on ? "text-[var(--lux-ivory)]" : "text-[var(--lux-platinum)]/60")}>{st}</span>
              </li>
            );
          })}
          <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
            {["Upload", "Browser camera", "Synthetic strip"].map((x) => (
              <span key={x} className="rounded-full border border-[rgb(var(--lc-ivory-rgb)/0.14)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--lux-platinum)]/70">
                {x}
              </span>
            ))}
          </div>
        </ol>
        <div className="flex flex-col items-center justify-center">
          <div className="relative size-[200px]">
            <svg viewBox="0 0 200 200" className="absolute inset-0 -rotate-90" aria-hidden>
              {Array.from({ length: 60 }, (_, i) => {
                const a = (i / 60) * Math.PI * 2;
                const r1 = i % 5 === 0 ? 86 : 89;
                return (
                  <line
                    key={i}
                    x1={100 + Math.cos(a) * r1}
                    y1={100 + Math.sin(a) * r1}
                    x2={100 + Math.cos(a) * 93}
                    y2={100 + Math.sin(a) * 93}
                    stroke={i / 60 < 1 - frac ? "rgba(242,235,221,0.18)" : "rgba(242,235,221,0.45)"}
                    strokeWidth={i % 5 === 0 ? 1.4 : 0.8}
                  />
                );
              })}
              <circle cx="100" cy="100" r="76" fill="none" stroke="rgba(242,235,221,0.07)" strokeWidth="3" />
              <circle cx="100" cy="100" r="76" fill="none" stroke={done ? CYAN : "var(--lux-gold)"} strokeWidth="3" strokeLinecap="round" pathLength={1} strokeDasharray={`${frac} 1`} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-[44px] font-extralight tabular-nums leading-none text-[var(--lux-ivory)]">
                {String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}
              </span>
              <Mono className="mt-2">{done ? "capture unlocked" : "reaction window"}</Mono>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Mono className="whitespace-nowrap">120 s window</Mono>
            <span className="text-[var(--lux-platinum)]/30">·</span>
            <Mono className="whitespace-nowrap text-[var(--lux-gold)]/80">shown at 10× speed</Mono>
          </div>
        </div>
      </div>
    </PreviewFrame>
  );
}

/* ───────────────────────── 03 result inspector ───────────────────────── */
export function InspectorPreview() {
  const pads = ANALYTES.map((a, i) => ({ a, hex: JEWEL[i] }));
  return (
    <PreviewFrame path=" / analysis / [run]">
      <Mono>Annotated overlay · strip polygon + pad boxes</Mono>
      <svg viewBox="0 0 520 92" className="mt-3 w-full" aria-hidden>
        <rect x="6" y="22" width="508" height="48" rx="4" fill="rgba(255,255,255,0.05)" stroke="#c9a96e" strokeOpacity="0.6" />
        <rect x="11" y="27" width="73" height="38" rx="2" fill="rgba(0,0,0,0.35)" stroke="#c9a96e" strokeOpacity="0.25" />
        <polygon points="2,17 518,15 519,75 3,77" fill="none" stroke="var(--lux-gold)" strokeDasharray="5 4" strokeWidth="1.2" />
        {pads.map((p, i) => {
          const x = 96 + i * 41.5;
          return (
            <g key={p.a.key}>
              <rect x={x} y="31" width="30" height="30" rx="2" fill={p.hex} />
              <rect x={x - 3} y="28" width="36" height="36" fill="none" stroke={CYAN} strokeWidth="1" />
              <text x={x + 15} y="10" textAnchor="middle" fill="rgba(242,235,221,0.6)" fontSize="9" fontFamily="var(--font-mono)">
                {String(i + 1).padStart(2, "0")}
              </text>
              <text x={x + 15} y="89" textAnchor="middle" fill="rgba(191,193,194,0.7)" fontSize="8.5" fontFamily="var(--font-mono)">
                {p.a.short}
              </text>
            </g>
          );
        })}
      </svg>
      <table className="mt-4 w-full text-[11.5px]">
        <thead>
          <tr className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--lux-platinum)]/55">
            <th className="py-1.5 text-left font-normal">Analyte</th>
            <th className="py-1.5 text-left font-normal">Pad RGB mean</th>
            <th className="py-1.5 text-left font-normal">State</th>
            <th className="py-1.5 text-right font-normal">Model · provenance</th>
          </tr>
        </thead>
        <tbody>
          {pads.slice(0, 4).map((p, i) => {
            const [r, g, b] = hexToRgb(p.hex);
            const synth = i !== 2;
            return (
              <tr key={p.a.key} className="border-t" style={{ borderColor: IV }}>
                <td className="py-1.5 text-[var(--lux-ivory)]/85">
                  <span className="mr-2 inline-block size-2.5 rounded-[2px] align-middle" style={{ background: p.hex }} />
                  {p.a.label}
                </td>
                <td className="py-1.5 font-mono tabular-nums text-[var(--lux-platinum)]/75">
                  {r} · {g} · {b}
                </td>
                <td className="py-1.5">
                  <span
                    className={cn(
                      "rounded-full border px-2 py-px font-mono text-[9px] uppercase tracking-[0.12em]",
                      synth ? "border-dashed border-[rgb(var(--lc-gold-rgb)/0.6)] text-[var(--lux-champagne)]" : "border-[rgb(var(--lc-ivory-rgb)/0.25)] text-[var(--lux-platinum)]",
                    )}
                  >
                    {synth ? "synthetic" : "calibration required"}
                  </span>
                </td>
                <td className="py-1.5 text-right">
                  <Ghost w={70} className="ml-auto" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </PreviewFrame>
  );
}

/* ───────────────────────── 04 review ───────────────────────── */
export function ReviewPreview() {
  const decisions = ["Accept", "Reject", "Needs repeat", "Note only"];
  return (
    <PreviewFrame path=" / review">
      <div className="grid h-full grid-cols-[1fr_190px] gap-5">
        <div>
          <div className="flex gap-4 border-b pb-2" style={{ borderColor: IV }}>
            {["Pending review", "Reviewed", "Rejected"].map((t, i) => (
              <span key={t} className={cn("font-mono text-[9.5px] uppercase tracking-[0.14em]", i === 0 ? "text-[var(--lux-champagne)]" : "text-[var(--lux-platinum)]/50")}>
                {t}
              </span>
            ))}
          </div>
          {[0, 1, 2, 3, 4].map((r) => (
            <div key={r} className={cn("flex items-center gap-3 border-b py-2.5", r === 1 && "bg-[rgb(var(--lc-ivory-rgb)/0.05)]")} style={{ borderColor: IV }}>
              <span className="size-1.5 rounded-full bg-[var(--lux-gold)]" />
              <span className="whitespace-nowrap font-mono text-[11px] text-[var(--lux-ivory)]/80">R-······</span>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--lux-gold)]/70">syn</span>
              <Ghost w={50} />
              {r === 3 ? (
                <span className="ml-auto whitespace-nowrap rounded-full border border-[rgb(var(--lc-gold-rgb)/0.55)] px-2 py-px text-[9.5px] text-[var(--lux-champagne)]">critical analyte n/a</span>
              ) : (
                <span className="ml-auto font-mono text-[9.5px] text-[var(--lux-platinum)]/55">waiting</span>
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-col rounded-[10px] border p-3" style={{ borderColor: IV }}>
          <Mono>Decision</Mono>
          <div className="mt-2 flex flex-col gap-1.5">
            {decisions.map((d, i) => (
              <span key={d} className={cn("flex items-center gap-2 rounded-[6px] border px-2 py-1.5 text-[11.5px]", i === 0 ? "border-[var(--lux-gold)] text-[var(--lux-ivory)]" : "text-[var(--lux-platinum)]/70")} style={i === 0 ? undefined : { borderColor: IV }}>
                <span className={cn("size-2 rounded-full border", i === 0 ? "border-[var(--lux-gold)] bg-[var(--lux-gold)]" : "border-[rgb(var(--lc-ivory-rgb)/0.3)]")} />
                {d}
              </span>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-1.5 rounded-[6px] border p-2" style={{ borderColor: IV }}>
            <Ghost w="90%" />
            <Ghost w="70%" />
          </div>
          <span className="mt-auto pt-3 text-[10px] leading-snug text-[var(--lux-platinum)]/55">Attributed to the reviewer and timestamped in the audit trail.</span>
        </div>
      </div>
    </PreviewFrame>
  );
}

/* ───────────────────────── 05 calibration ───────────────────────── */
export function CalibrationPreview() {
  const models = ["Linear", "Poly 2 + ridge", "Poly 3 + ridge", "k-NN", "Random forest"];
  return (
    <PreviewFrame path=" / calibration">
      <Mono>Pad map · left → right, handle on the left</Mono>
      <div className="mt-2.5 grid grid-cols-10 gap-1.5">
        {ANALYTES.map((a, i) => (
          <div key={a.key} className="flex flex-col items-center gap-1 rounded-[6px] border py-2" style={{ borderColor: IV }}>
            <span className="font-mono text-[8.5px] text-[var(--lux-platinum)]/50">{String(i + 1).padStart(2, "0")}</span>
            <span className="h-4 w-4 rounded-[2px]" style={{ background: JEWEL[i] }} />
            <span className="font-mono text-[9px] text-[var(--lux-ivory)]/80">{a.short}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-5">
        <div className="rounded-[10px] border border-dashed p-3" style={{ borderColor: "rgb(var(--lc-ivory-rgb) / 0.2)" }}>
          <Mono>Import dataset · CSV</Mono>
          <div className="mt-2 font-mono text-[9.5px] leading-[1.7] text-[var(--lux-platinum)]/60">
            sample_id, p01_r, p01_g, p01_b … p10_b
            <br />
            ref_glucose, ref_protein … ref_specific_gravity
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="whitespace-nowrap rounded-[3px] border border-dashed border-[rgb(var(--lc-gold-rgb)/0.6)] px-1.5 font-mono text-[8.5px] uppercase tracking-[0.14em] text-[var(--lux-champagne)]">synthetic demo</span>
            <Mono className="text-[8.5px]">validated before import</Mono>
          </div>
        </div>
        <div>
          <Mono>Train · model type</Mono>
          <div className="mt-2 flex flex-col gap-1">
            {models.map((m, i) => (
              <span key={m} className={cn("flex items-center gap-2 text-[11.5px]", i === 1 ? "text-[var(--lux-ivory)]" : "text-[var(--lux-platinum)]/55")}>
                <span className={cn("size-2 rounded-full border", i === 1 ? "border-[var(--lux-gold)] bg-[var(--lux-gold)]" : "border-[rgb(var(--lc-ivory-rgb)/0.3)]")} />
                {m}
              </span>
            ))}
          </div>
          <div className="mt-2.5 flex gap-1.5">
            {["rgb30", "pad_rgb", "lab30"].map((f, i) => (
              <span key={f} className={cn("rounded-full border px-2 py-px font-mono text-[9px]", i === 0 ? "border-[#5fd4e6]/60 text-[#5fd4e6]" : "border-[rgb(var(--lc-ivory-rgb)/0.15)] text-[var(--lux-platinum)]/60")}>
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>
    </PreviewFrame>
  );
}

/* ───────────────────────── 06 model lab ───────────────────────── */
function lcg(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}
const SCATTER = (() => {
  const r = lcg(7);
  return Array.from({ length: 46 }, () => {
    const x = r();
    const y = Math.min(1, Math.max(0, x + (r() - 0.5) * 0.22 + (r() - 0.5) * 0.08));
    return [x, y] as const;
  });
})();

export function ModelLabPreview() {
  const resid = [1, 3, 6, 10, 12, 8, 4, 2];
  return (
    <PreviewFrame path=" / model-lab">
      <div className="grid h-full grid-cols-[1fr_150px] gap-5">
        <div>
          <div className="flex items-center justify-between">
            <Mono>Predicted vs reference · test split</Mono>
            <span className="whitespace-nowrap rounded-[3px] border border-dashed border-[rgb(var(--lc-gold-rgb)/0.6)] px-1.5 font-mono text-[8.5px] uppercase tracking-[0.14em] text-[var(--lux-champagne)]">Synthetic · illustrative</span>
          </div>
          <svg viewBox="0 0 300 220" className="mt-2 h-[240px] w-full" aria-hidden>
            {[0.25, 0.5, 0.75].map((t) => (
              <g key={t}>
                <line x1={30 + t * 260} x2={30 + t * 260} y1="10" y2="200" stroke="rgba(242,235,221,0.06)" />
                <line x1="30" x2="290" y1={200 - t * 190} y2={200 - t * 190} stroke="rgba(242,235,221,0.06)" />
              </g>
            ))}
            <line x1="30" y1="200" x2="290" y2="200" stroke="rgba(242,235,221,0.3)" />
            <line x1="30" y1="10" x2="30" y2="200" stroke="rgba(242,235,221,0.3)" />
            <line x1="30" y1="200" x2="290" y2="10" stroke="var(--lux-gold)" strokeDasharray="4 4" strokeWidth="1" />
            {SCATTER.map(([x, y], i) => (
              <circle key={i} cx={30 + x * 260} cy={200 - y * 190} r="2.6" fill={CYAN} opacity="0.8" />
            ))}
            <text x="160" y="216" textAnchor="middle" fill="rgba(191,193,194,0.6)" fontSize="9" fontFamily="var(--font-mono)">
              REFERENCE
            </text>
            <text x="12" y="105" textAnchor="middle" fill="rgba(191,193,194,0.6)" fontSize="9" fontFamily="var(--font-mono)" transform="rotate(-90 12 105)">
              PREDICTED
            </text>
          </svg>
        </div>
        <div className="flex flex-col">
          <Mono>Residuals</Mono>
          <svg viewBox="0 0 120 90" className="mt-2 w-full" aria-hidden>
            {resid.map((h, i) => (
              <rect key={i} x={i * 15 + 1} y={88 - h * 6.5} width="12" height={h * 6.5} fill="rgba(242,235,221,0.35)" />
            ))}
            <line x1="60" x2="60" y1="0" y2="90" stroke="var(--lux-gold)" strokeDasharray="2 3" />
          </svg>
          <div className="mt-4 flex flex-col gap-2">
            {["MAE", "RMSE", "Bias", "R²"].map((m) => (
              <div key={m} className="flex items-center justify-between border-t pt-1.5" style={{ borderColor: IV }}>
                <Mono>{m}</Mono>
                <Ghost w={36} />
              </div>
            ))}
          </div>
          <span className="mt-auto pt-3 text-[10px] leading-snug text-[var(--lux-platinum)]/55">Compare two models; “validated” needs an admin and written evidence.</span>
        </div>
      </div>
    </PreviewFrame>
  );
}

/* ───────────────────────── 07 reports ───────────────────────── */
export function ReportsPreview() {
  return (
    <PreviewFrame path=" / reports">
      <div className="grid h-full grid-cols-[1fr_200px] gap-5">
        <div className="relative mx-auto w-full max-w-[290px] rounded-[4px] bg-[#f2ebdd] p-4 text-[#1a1c1a] shadow-[0_20px_40px_-20px_rgba(0,0,0,0.8)]">
          <div className="flex items-baseline justify-between border-b border-black/15 pb-2">
            <span className="t-serif text-[18px] leading-none !text-[#1a1c1a]">Vitra</span>
            <span className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-black/50">Analysis report</span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-[5px] rounded-full bg-black/15" />
            ))}
          </div>
          <div className="mt-3 flex flex-col">
            {ANALYTES.map((a, i) => (
              <div key={a.key} className="flex items-center gap-2 border-t border-black/8 py-[3px]">
                <span className="size-2 rounded-[1px]" style={{ background: JEWEL[i] }} />
                <span className="w-10 font-mono text-[7.5px] text-black/70">{a.short}</span>
                <span className="h-[4px] flex-1 rounded-full bg-black/10" />
                <span className="rounded-full border border-dashed border-black/30 px-1 font-mono text-[6.5px] uppercase text-black/55">{i === 4 ? "cal. req." : "synthetic"}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 border-t border-black/15 pt-1.5 font-mono text-[6.5px] uppercase tracking-[0.12em] text-black/45">model · version · reviewer · SYNTHETIC</div>
        </div>
        <div className="flex flex-col gap-3">
          <Mono>Format</Mono>
          <div className="flex gap-1.5">
            {["PDF", "JSON"].map((f, i) => (
              <span key={f} className={cn("rounded-full border px-3 py-1 font-mono text-[10px]", i === 0 ? "border-[var(--lux-gold)] text-[var(--lux-champagne)]" : "text-[var(--lux-platinum)]/60")} style={i === 0 ? undefined : { borderColor: IV }}>
                {f}
              </span>
            ))}
          </div>
          <pre className="overflow-hidden rounded-[8px] border p-2.5 font-mono text-[9px] leading-[1.6] text-[var(--lux-platinum)]/75" style={{ borderColor: IV }}>
            {`{
  "analyte": "glucose",
  "state": "synthetic",
  "model": { … },
  "review": { … }
}`}
          </pre>
          <span className="text-[10px] leading-snug text-[var(--lux-platinum)]/55">Generation can require a clinical review first (a setting).</span>
        </div>
      </div>
    </PreviewFrame>
  );
}

/* ───────────────────────── 08 devices ───────────────────────── */
export function DevicesPreview() {
  const ticks = [
    { x: 6, k: "hb" },
    { x: 16, k: "hb" },
    { x: 24, k: "cap" },
    { x: 34, k: "hb" },
    { x: 45, k: "hb" },
    { x: 52, k: "err" },
    { x: 61, k: "hb" },
    { x: 70, k: "cap" },
    { x: 80, k: "hb" },
    { x: 91, k: "hb" },
  ];
  return (
    <PreviewFrame path=" / devices">
      <div className="flex flex-col">
        {[
          ["SIM-01", true],
          ["VITRA-PI-01", false],
        ].map(([n, sim]) => (
          <div key={n as string} className="flex items-center gap-3 border-b py-2.5" style={{ borderColor: IV }}>
            <span className="font-mono text-[12px] text-[var(--lux-ivory)]/85">{n}</span>
            <span
              className={cn(
                "rounded-[3px] px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.14em]",
                sim ? "border border-dashed border-[rgb(var(--lc-gold-rgb)/0.6)] text-[var(--lux-champagne)]" : "border border-[rgb(var(--lc-ivory-rgb)/0.2)] text-[var(--lux-platinum)]/70",
              )}
            >
              {sim ? "Simulated" : "Registered"}
            </span>
            <span className="ml-auto flex gap-5">
              <Mono>last seen</Mono>
              <Mono>capture</Mono>
              <Mono>errors 24 h</Mono>
            </span>
          </div>
        ))}
      </div>
      <div className="mt-5">
        <Mono>Event timeline · simulated adapter</Mono>
        <div className="relative mt-3 h-12">
          <span className="absolute inset-x-0 top-1/2 h-px bg-[rgb(var(--lc-ivory-rgb)/0.18)]" />
          {ticks.map((t, i) => (
            <span
              key={i}
              className={cn(
                "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                t.k === "err" ? "size-2.5 bg-fault" : t.k === "cap" ? "size-2.5 bg-[#5fd4e6]" : "size-1.5 bg-[rgb(var(--lc-ivory-rgb)/0.45)]",
              )}
              style={{ left: `${t.x}%` }}
            />
          ))}
        </div>
        <div className="flex gap-4">
          <Mono className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[rgb(var(--lc-ivory-rgb)/0.45)]" /> heartbeat
          </Mono>
          <Mono className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-[#5fd4e6]" /> capture
          </Mono>
          <Mono className="flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-fault" /> error
          </Mono>
        </div>
      </div>
      <div className="mt-5 rounded-[8px] border p-3 font-mono text-[10px] leading-[1.75] text-[var(--lux-platinum)]/75" style={{ borderColor: IV }}>
        <span className="text-[var(--lux-champagne)]">POST</span> /api/ingest
        <br />
        X-Device-Id · X-Device-Key · Idempotency-Key · X-Capture-Timestamp
      </div>
    </PreviewFrame>
  );
}
