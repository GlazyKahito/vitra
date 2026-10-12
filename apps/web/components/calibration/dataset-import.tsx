"use client";

import { useMemo, useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SyntheticTag } from "@/components/common/synthetic-tag";
import { importDatasetAction } from "@/app/actions/calibration";
import { ANALYTE_BY_KEY, isAnalyteKey } from "@/lib/analytes";
import { countRows, parseCsv, validateClient, type ClientValidation, type ParsedCsv } from "./csv";

export interface DatasetImportProps {
  products: { id: string; name: string; batches: { id: string; lotNumber: string }[] }[];
  canImport: boolean;
}

const PREVIEW_ROWS = 20;
const MAX_BYTES = 25 * 1024 * 1024;

interface ServerIssue {
  level: string;
  message: string;
}

export function DatasetImport({ products, canImport }: DatasetImportProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState<string>("");
  const [name, setName] = useState("");
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [batchId, setBatchId] = useState("");
  const [synthetic, setSynthetic] = useState(false);
  const [notes, setNotes] = useState("");
  const [readError, setReadError] = useState<string | null>(null);
  const [server, setServer] = useState<{ error?: string; issues: ServerIssue[]; datasetId?: string } | null>(null);
  const [pending, start] = useTransition();

  const preview: ParsedCsv | null = useMemo(() => (text ? parseCsv(text, PREVIEW_ROWS) : null), [text]);
  const full: ClientValidation | null = useMemo(() => (text ? validateClient(parseCsv(text)) : null), [text]);
  const totalRows = useMemo(() => (text ? countRows(text) : 0), [text]);
  const batches = products.find((p) => p.id === productId)?.batches ?? [];

  const mustTickSynthetic = !!full?.declaresSynthetic && !synthetic;
  const blocking = !file || !name.trim() || !productId || !full || full.missingRequired.length > 0 || mustTickSynthetic || totalRows === 0;

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setServer(null);
    setReadError(null);
    setFile(f);
    setText("");
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setReadError(`File is ${(f.size / 1024 / 1024).toFixed(1)} MB; limit is 25 MB.`);
      setFile(null);
      return;
    }
    try {
      const t = await f.text();
      setText(t);
      if (!name) setName(f.name.replace(/\.csv$/i, ""));
    } catch (err) {
      setReadError(`Could not read file: ${(err as Error).message}`);
    }
  }

  function submit() {
    if (!file || blocking) return;
    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("stripProductId", productId);
    if (batchId) fd.set("stripBatchId", batchId);
    fd.set("synthetic", synthetic ? "true" : "false");
    fd.set("notes", notes);
    fd.set("file", file, file.name);
    start(async () => {
      const res = await importDatasetAction(fd);
      if (res.ok) {
        setServer({ issues: res.issues, datasetId: res.datasetId });
        router.push(`/calibration?dataset=${encodeURIComponent(res.datasetId)}`);
        router.refresh();
      } else {
        setServer({ error: res.error, issues: [] });
      }
    });
  }

  const missingTotal = full ? Object.values(full.missingValues).reduce((a, b) => a + b, 0) : 0;
  const nonNumericTotal = full ? Object.values(full.nonNumeric).reduce((a, b) => a + b, 0) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[1fr_1fr] gap-3">
        <Field label="CSV file" required help="Header must contain sample_id and p01_r … p10_b. Reference columns ref_<analyte>. Optional: strip_product, batch, synthetic, split, p01_l/a/bb …" error={readError ?? undefined}>
          <Input type="file" accept=".csv,text/csv" onChange={onFile} disabled={!canImport} className="h-10 py-2 file:mr-3 file:rounded-[var(--radius-xs)] file:border-0 file:bg-ink-3 file:px-2 file:py-1 file:text-[12px] file:text-fg-2" />
        </Field>
        <Field label="Dataset name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. lot-2026-03 glucose reference set" disabled={!canImport} />
        </Field>
        <Field label="Strip product" required>
          <Select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setBatchId("");
            }}
            disabled={!canImport}
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Strip batch" hint="optional">
          <Select value={batchId} onChange={(e) => setBatchId(e.target.value)} disabled={!canImport || batches.length === 0}>
            <option value="">— any / unknown —</option>
            {batches.map((b) => (
              <option key={b.id} value={b.id}>
                Lot {b.lotNumber}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Notes" hint="optional">
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canImport} placeholder="Provenance: who measured the references, which analyser, when." />
      </Field>

      <label className={"flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border px-4 py-3 " + (mustTickSynthetic ? "border-[rgba(232,181,90,0.5)] bg-notice-dim" : "border-line bg-ink-1")}>
        <input type="checkbox" className="mt-1 accent-[var(--color-signal)]" checked={synthetic} onChange={(e) => setSynthetic(e.target.checked)} disabled={!canImport} />
        <span className="text-[13px] leading-relaxed text-fg-2">
          <span className="font-medium text-fg">This dataset is synthetic.</span> Models trained on it can only ever produce <em>Synthetic demo</em> values in demo mode and are never eligible for research or validated use.
          {full?.hasSyntheticColumn ? (
            <span className="mt-1 block text-[12px] text-fg-3">
              The file&apos;s <code className="t-mono">synthetic</code> column marks {full.syntheticRows} of {totalRows} rows true.
              {mustTickSynthetic ? <strong className="text-notice"> You must tick this box to import a file that declares synthetic rows.</strong> : null}
            </span>
          ) : null}
        </span>
      </label>

      {full && preview ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="neutral">{totalRows} rows</Chip>
            <Chip tone="neutral">{full.columns.length} columns</Chip>
            <Chip tone={full.missingRequired.length ? "fault" : "signal"}>{full.missingRequired.length ? `${full.missingRequired.length} required columns missing` : "required columns present"}</Chip>
            <Chip tone={missingTotal ? "notice" : "muted"}>{missingTotal} missing values</Chip>
            <Chip tone={nonNumericTotal ? "notice" : "muted"}>{nonNumericTotal} non-numeric</Chip>
            <Chip tone={full.duplicateSampleIds.length ? "notice" : "muted"}>{full.duplicateSampleIds.length} duplicate sample_id</Chip>
            {full.declaresSynthetic ? <SyntheticTag /> : null}
          </div>
          {full.missingRequired.length ? (
            <p className="text-[12px] text-fault" role="alert">
              Missing required: <span className="t-mono">{full.missingRequired.join(", ")}</span>
            </p>
          ) : null}
          {full.unknownColumns.length ? (
            <p className="text-[12px] text-fg-3">
              Ignored columns (not in contract): <span className="t-mono">{full.unknownColumns.join(", ")}</span>
            </p>
          ) : null}
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(full.perAnalyteCounts).map(([k, n]) => (
              <span key={k} className="t-mono rounded-[var(--radius-xs)] border border-line px-2 py-0.5 text-[11px] text-fg-3">
                {isAnalyteKey(k) ? ANALYTE_BY_KEY[k].short : k} ref n={n}
                {n < 30 ? <span className="text-notice"> · insufficient</span> : null}
              </span>
            ))}
            {full.referenceColumns.length === 0 ? <span className="text-[12px] text-notice">No ref_* columns: the file can be imported but nothing can be trained from it.</span> : null}
          </div>
          <div className="max-h-[260px] overflow-auto rounded-[var(--radius-sm)] border border-line">
            <table className="table-instrument min-w-max">
              <thead>
                <tr>
                  {preview.header.map((h, i) => (
                    <th key={`${h}-${i}`} className={full.missingRequired.includes(h) ? "text-fault" : undefined}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, i) => (
                  <tr key={i}>
                    {preview.header.map((_, j) => (
                      <td key={j} className="t-mono text-[12px]">
                        {r[j] === undefined || r[j] === "" ? <span className="text-fg-4">·</span> : r[j]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="t-mono text-[11px] text-fg-4">
            Preview: first {Math.min(PREVIEW_ROWS, totalRows)} of {totalRows} rows. Validation counts cover the whole file (client-side); the CV service re-validates on import.
          </p>
        </div>
      ) : null}

      {server?.error ? (
        <p className="text-[12.5px] text-fault" role="alert">
          Import failed: {server.error}
        </p>
      ) : null}
      {server?.issues.length ? (
        <ul className="flex flex-col gap-1 rounded-[var(--radius-sm)] border border-line bg-ink-1 px-4 py-3">
          {server.issues.map((i, k) => (
            <li key={k} className="flex gap-2 text-[12.5px]">
              <Chip tone={i.level === "error" ? "fault" : i.level === "warn" ? "notice" : "muted"}>{i.level}</Chip>
              <span className="text-fg-2">{i.message}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        {!canImport ? <span className="text-[12px] text-fg-4">Requires calibration.manage.</span> : null}
        <Button onClick={submit} loading={pending} disabled={!canImport || blocking} leading={<Upload className="size-4" />}>
          Import dataset
        </Button>
      </div>
    </div>
  );
}
