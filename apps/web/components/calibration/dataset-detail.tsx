import Link from "next/link";
import type { CalibrationDataset, StripProduct } from "@/lib/data/contract";
import { Panel } from "@/components/ui/panel";
import { Chip } from "@/components/ui/chip";
import { SyntheticTag } from "@/components/common/synthetic-tag";
import { MiniHistogram } from "@/components/common/mini-charts";
import { ANALYTE_BY_KEY, ANALYTE_KEYS, isAnalyteKey } from "@/lib/analytes";
import { formatDateTime, shortId } from "@/lib/utils";
import { column, parseCsv, validateClient } from "./csv";

export interface DatasetDetailProps {
  dataset: CalibrationDataset & { csvText: string };
  product: StripProduct | null;
}

const MIN_PER_ANALYTE = 30;

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export function DatasetDetail({ dataset, product }: DatasetDetailProps) {
  const parsed = parseCsv(dataset.csvText);
  const local = validateClient(parsed);
  const stored = (dataset.validation ?? {}) as Record<string, unknown>;
  const storedCounts = (stored.per_analyte_counts as Record<string, number> | undefined) ?? local.perAnalyteCounts;
  const storedIssues = Array.isArray(stored.issues) ? (stored.issues as { level?: string; message?: string }[]) : [];
  const missingValues = (stored.missing_values as Record<string, number> | undefined) ?? local.missingValues;
  const missingTotal = Object.values(missingValues).reduce((a, b) => a + b, 0);
  const duplicateRows = num(stored.duplicate_rows) ?? local.duplicateSampleIds.length;
  const padMap = product?.padMap ?? [];

  return (
    <Panel
      eyebrow={`Dataset · ${shortId(dataset.id)}`}
      title={
        <span className="flex items-center gap-2">
          {dataset.name} <span className="t-mono text-[12px] text-fg-4">v{dataset.version}</span>
          {dataset.synthetic ? <SyntheticTag /> : null}
        </span>
      }
      description={`${dataset.rowCount} rows · ${dataset.columns.length} columns · imported ${formatDateTime(dataset.createdAt)} · sha256 ${shortId(dataset.sha256, 12)}`}
      actions={
        <Link href="/calibration" className="text-[12.5px] text-fg-3 hover:text-fg">
          Close
        </Link>
      }
    >
      <div className="flex flex-col gap-6">
        {dataset.synthetic ? <p className="text-[12.5px] text-fg-3">Synthetic dataset: every distribution below is generated. It describes the pipeline, not any population of samples.</p> : null}

        <section>
          <div className="t-eyebrow mb-2">Stored validation</div>
          <div className="flex flex-wrap gap-2">
            <Chip tone={stored.ok === false ? "fault" : "signal"}>{stored.ok === false ? "rejected" : "accepted"}</Chip>
            <Chip tone={missingTotal ? "notice" : "muted"}>{missingTotal} missing values</Chip>
            <Chip tone={duplicateRows ? "notice" : "muted"}>{duplicateRows} duplicate rows</Chip>
            <Chip tone="neutral">{num(stored.synthetic_rows) ?? local.syntheticRows} synthetic rows</Chip>
            <Chip tone="neutral">{(stored.reference_columns as string[] | undefined)?.length ?? local.referenceColumns.length} reference columns</Chip>
          </div>
          {storedIssues.length ? (
            <ul className="mt-3 flex flex-col gap-1">
              {storedIssues.map((i, k) => (
                <li key={k} className="flex items-start gap-2 text-[12.5px] text-fg-2">
                  <Chip tone={i.level === "error" ? "fault" : i.level === "warn" ? "notice" : "muted"}>{i.level ?? "info"}</Chip>
                  <span>{i.message}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[12px] text-fg-4">No issues recorded by the CV service validator.</p>
          )}
          {dataset.notes ? <p className="mt-3 text-[12.5px] text-fg-3">{dataset.notes}</p> : null}
        </section>

        <section>
          <div className="t-eyebrow mb-2">Per-analyte reference counts</div>
          <table className="table-instrument">
            <thead>
              <tr>
                <th>Analyte</th>
                <th>Pad</th>
                <th>Reference n</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ANALYTE_KEYS.map((k) => {
                const n = storedCounts[k] ?? 0;
                const pad = padMap.indexOf(k);
                return (
                  <tr key={k}>
                    <td className="text-fg">{ANALYTE_BY_KEY[k].label}</td>
                    <td className="t-mono">{pad >= 0 ? `P${String(pad + 1).padStart(2, "0")}` : "—"}</td>
                    <td className="t-mono">{n}</td>
                    <td>{n === 0 ? <Chip tone="muted">no references</Chip> : n < MIN_PER_ANALYTE ? <Chip tone="notice">insufficient (&lt;{MIN_PER_ANALYTE})</Chip> : <Chip tone="neutral">trainable</Chip>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section>
          <div className="t-eyebrow mb-2">Reference-value distributions</div>
          <div className="grid grid-cols-3 gap-3">
            {local.referenceColumns.map((c) => {
              const key = c.slice(4);
              const vals = column(parsed, c);
              const def = isAnalyteKey(key) ? ANALYTE_BY_KEY[key] : null;
              return (
                <div key={c} className="panel-inset p-2">
                  <MiniHistogram values={vals} title={def?.label ?? key} unit={def?.unit} tone="notice" domain={def ? { min: def.span[0], max: def.span[1] } : undefined} width={240} height={96} />
                </div>
              );
            })}
            {local.referenceColumns.length === 0 ? <p className="col-span-3 text-[12.5px] text-fg-4">No ref_* columns in this dataset.</p> : null}
          </div>
        </section>

        <section>
          <div className="t-eyebrow mb-2">Feature distributions · pad mean R / G / B (0–255)</div>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 10 }, (_, i) => {
              const p = `p${String(i + 1).padStart(2, "0")}`;
              const analyte = padMap[i];
              const label = analyte && isAnalyteKey(analyte) ? ANALYTE_BY_KEY[analyte].short : "—";
              return (
                <div key={p} className="panel-inset flex items-center gap-2 p-2">
                  <div className="t-mono w-14 shrink-0 text-[11px] text-fg-3">
                    {p.toUpperCase()}
                    <div className="text-fg-4">{label}</div>
                  </div>
                  <MiniHistogram values={column(parsed, `${p}_r`)} title="R" domain={{ min: 0, max: 255 }} width={150} height={72} tone="neutral" />
                  <MiniHistogram values={column(parsed, `${p}_g`)} title="G" domain={{ min: 0, max: 255 }} width={150} height={72} tone="signal" />
                  <MiniHistogram values={column(parsed, `${p}_b`)} title="B" domain={{ min: 0, max: 255 }} width={150} height={72} tone="muted" />
                </div>
              );
            })}
          </div>
          <p className="mt-2 t-mono text-[11px] text-fg-4">Histograms are computed from the stored CSV on each view ({parsed.rows.length} rows). Channel tones are palette tokens, not colour-coded results.</p>
        </section>
      </div>
    </Panel>
  );
}
