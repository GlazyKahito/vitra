import Link from "next/link";
import type { CalibrationStatus } from "@/lib/data/contract";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { ANALYTE_BY_KEY, isAnalyteKey } from "@/lib/analytes";

export interface CalibrationStatusPanelProps {
  statuses: CalibrationStatus[];
  recalibrationIntervalDays: number;
  minPerAnalyte?: number;
}

const STATUS_META: Record<CalibrationStatus["perAnalyte"][number]["status"], { label: string; tone: ChipTone }> = {
  none: { label: "No model", tone: "muted" },
  synthetic_only: { label: "Synthetic only", tone: "muted" },
  experimental: { label: "Experimental", tone: "notice" },
  validated: { label: "Validated", tone: "signal" },
};

export function CalibrationStatusPanel({ statuses, recalibrationIntervalDays, minPerAnalyte = 30 }: CalibrationStatusPanelProps) {
  const dueCount = statuses.flatMap((s) => s.perAnalyte).filter((a) => a.recalibrationDue).length;
  return (
    <div className="flex flex-col gap-5">
      {dueCount > 0 ? (
        <div role="note" className="rounded-[var(--radius-sm)] border border-[rgba(232,181,90,0.35)] bg-notice-dim px-3 py-2 text-[12.5px] text-fg-2">
          <span className="font-medium text-notice">{dueCount} analyte model{dueCount === 1 ? "" : "s"} past the {recalibrationIntervalDays}-day recalibration interval.</span> Predictions continue but should be re-fitted against fresh reference measurements.
        </div>
      ) : null}
      {statuses.length === 0 ? <p className="text-[12.5px] text-fg-4">No strip products configured.</p> : null}
      {statuses.map((s) => (
        <section key={s.stripProductId}>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[13px] font-medium text-fg">{s.stripProductName}</span>
            <span className="t-mono text-[11px] text-fg-4">{s.perAnalyte.filter((a) => a.status === "validated").length}/10 validated</span>
          </div>
          <table className="table-instrument">
            <thead>
              <tr>
                <th>Analyte</th>
                <th>Status</th>
                <th>Age</th>
              </tr>
            </thead>
            <tbody>
              {s.perAnalyte.map((a) => {
                const meta = STATUS_META[a.status];
                const label = isAnalyteKey(a.analyteKey) ? ANALYTE_BY_KEY[a.analyteKey].label : a.analyteKey;
                return (
                  <tr key={a.analyteKey}>
                    <td className="text-fg">
                      {a.model ? (
                        <Link href={`/model-lab?model=${encodeURIComponent(a.model.id)}`} className="hover:text-signal">
                          {label}
                        </Link>
                      ) : (
                        label
                      )}
                    </td>
                    <td>
                      <Chip tone={meta.tone}>{meta.label}</Chip>
                    </td>
                    <td className="t-mono text-[12px]">
                      {a.ageDays === null ? "—" : `${a.ageDays} d`}
                      {a.recalibrationDue ? <span className="ml-1 text-notice">· due</span> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}

      <section className="panel-inset p-3">
        <div className="t-eyebrow mb-2">What enables a valid prediction</div>
        <pre className="t-mono whitespace-pre-wrap text-[11.5px] leading-relaxed text-fg-3">{`state           requirement
──────────────  ─────────────────────────────────────────
calibration     no model, or only a synthetic-data model
required        → research mode shows no value

experimental    model fitted on REAL reference values:
                • same physical samples imaged by VITRA
                  and measured on a laboratory analyser
                  (method = lab_analyser), in the
                  analyte's unit
                • ≥ ${minPerAnalyte} reference rows per analyte,
                  spanning the chart scale
                • ≥ 2 strip batches (lot numbers)
                • held-out test set ≥ 30 rows

measured        experimental model + admin marks
                "validated" with written evidence
                (method comparison, bias/limits of
                agreement, batch coverage, date)

synthetic demo  synthetic-trained model, demo mode only
                — never a measurement

recalibration   model older than ${recalibrationIntervalDays} d, or new
due             strip batch, or illumination change`}</pre>
      </section>
    </div>
  );
}
