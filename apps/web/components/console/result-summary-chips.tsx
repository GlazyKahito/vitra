import { ANALYTE_BY_KEY, formatAnalyteValue, isAnalyteKey } from "@/lib/analytes";
import { RESULT_STATE_META, type ResultState } from "@/lib/inference/policy";
import { cn } from "@/lib/utils";

export interface ResultSummaryEntry {
  analyteKey: string;
  state: ResultState;
  value: number | null;
  unit: string;
}

const STATE_GLYPH: Record<ResultState, string> = {
  measured: "",
  experimental: "~",
  synthetic: "≈",
  out_of_range: "↕",
  indeterminate: "?",
  invalid_image: "✕",
  unavailable: "–",
  calibration_required: "cal",
};

/**
 * Compact per-analyte mini-chips for tables. A chip shows a number only when the
 * result state permits it; otherwise it shows the state glyph. Tone follows the
 * state (provenance), never normal/abnormal.
 */
export function ResultSummaryChips({ entries, max = 10, className }: { entries: ResultSummaryEntry[]; max?: number; className?: string }) {
  if (entries.length === 0) return <span className="t-mono text-[11px] text-fg-4">no results</span>;
  const shown = entries.slice(0, max);
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {shown.map((e) => {
        const def = isAnalyteKey(e.analyteKey) ? ANALYTE_BY_KEY[e.analyteKey] : null;
        const meta = RESULT_STATE_META[e.state];
        const showsValue = meta?.showsValue && e.value !== null;
        const text = showsValue && def ? formatAnalyteValue(def.key, e.value) : STATE_GLYPH[e.state] ?? "–";
        return (
          <span
            key={e.analyteKey}
            title={`${def?.label ?? e.analyteKey}: ${meta?.label ?? e.state}${showsValue ? ` ${text} ${e.unit}` : ""}`}
            className={cn(
              "inline-flex h-[18px] items-center gap-1 rounded-[2px] border px-1 font-mono text-[10px] tabular-nums",
              meta?.tone === "signal" && "border-[rgba(95,212,230,0.35)] text-signal",
              meta?.tone === "notice" && "border-[rgba(232,181,90,0.35)] text-notice",
              meta?.tone === "fault" && "border-[rgba(224,108,108,0.35)] text-fault",
              (meta?.tone === "neutral" || !meta) && "border-line-strong text-fg-3",
              meta?.tone === "muted" && "border-dashed border-line-strong text-fg-3",
            )}
          >
            <span className="text-fg-4">{def?.short ?? e.analyteKey.slice(0, 3).toUpperCase()}</span>
            <span>{text}</span>
          </span>
        );
      })}
      {entries.length > max ? <span className="t-mono text-[10px] text-fg-4">+{entries.length - max}</span> : null}
    </div>
  );
}
