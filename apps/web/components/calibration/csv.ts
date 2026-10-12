/**
 * Minimal CSV parsing + contract checks for calibration datasets
 * (docs/cv-service-contract.md → POST /v1/calibration/validate).
 * Pure functions: used client-side for the import preview and server-side for
 * dataset detail plots. Handles quoted fields; does not attempt full RFC 4180.
 */
import { ANALYTE_KEYS } from "@/lib/analytes";

export const PAD_COUNT = 10;
export const FEATURE_COLUMNS: readonly string[] = Array.from({ length: PAD_COUNT }, (_, i) => {
  const p = `p${String(i + 1).padStart(2, "0")}`;
  return [`${p}_r`, `${p}_g`, `${p}_b`];
}).flat();
export const LAB_COLUMNS: readonly string[] = Array.from({ length: PAD_COUNT }, (_, i) => {
  const p = `p${String(i + 1).padStart(2, "0")}`;
  return [`${p}_l`, `${p}_a`, `${p}_bb`];
}).flat();
export const REQUIRED_COLUMNS: readonly string[] = ["sample_id", ...FEATURE_COLUMNS];
export const OPTIONAL_COLUMNS: readonly string[] = ["strip_product", "batch", "synthetic", "split", ...LAB_COLUMNS];
export const REFERENCE_COLUMNS: readonly string[] = ANALYTE_KEYS.map((k) => `ref_${k}`);

export interface ParsedCsv {
  header: string[];
  rows: string[][];
}

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseCsv(text: string, maxRows = Infinity): ParsedCsv {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = parseLine(lines[0]).map((h) => h.toLowerCase());
  const rows: string[][] = [];
  for (let i = 1; i < lines.length && rows.length < maxRows; i++) rows.push(parseLine(lines[i]));
  return { header, rows };
}

export function countRows(text: string): number {
  return Math.max(0, text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim().length > 0).length - 1);
}

export interface ClientValidation {
  rows: number;
  columns: string[];
  missingRequired: string[];
  unknownColumns: string[];
  referenceColumns: string[];
  missingValues: Record<string, number>;
  nonNumeric: Record<string, number>;
  duplicateSampleIds: string[];
  perAnalyteCounts: Record<string, number>;
  syntheticRows: number;
  /** True when any row's `synthetic` column parses as true. */
  declaresSynthetic: boolean;
  hasSyntheticColumn: boolean;
}

export function isTruthy(v: string | undefined): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes" || s === "y";
}

/** Client-side contract check. The CV service re-validates server-side; this is for immediate feedback. */
export function validateClient(parsed: ParsedCsv): ClientValidation {
  const { header, rows } = parsed;
  const colIdx = new Map(header.map((h, i) => [h, i] as const));
  const missingRequired = REQUIRED_COLUMNS.filter((c) => !colIdx.has(c));
  const known = new Set<string>([...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS, ...REFERENCE_COLUMNS]);
  const unknownColumns = header.filter((h) => !known.has(h) && !h.startsWith("ref_"));
  const referenceColumns = header.filter((h) => h.startsWith("ref_"));
  const missingValues: Record<string, number> = {};
  const nonNumeric: Record<string, number> = {};
  const numericCols = header.filter((h) => FEATURE_COLUMNS.includes(h) || LAB_COLUMNS.includes(h) || h.startsWith("ref_"));
  const seen = new Map<string, number>();
  const perAnalyteCounts: Record<string, number> = {};
  let syntheticRows = 0;
  const sIdx = colIdx.get("sample_id");
  const synIdx = colIdx.get("synthetic");
  for (const r of rows) {
    if (sIdx !== undefined) {
      const sid = r[sIdx] ?? "";
      seen.set(sid, (seen.get(sid) ?? 0) + 1);
    }
    if (synIdx !== undefined && isTruthy(r[synIdx])) syntheticRows++;
    for (const c of numericCols) {
      const v = r[colIdx.get(c)!];
      if (v === undefined || v === "") {
        missingValues[c] = (missingValues[c] ?? 0) + 1;
        continue;
      }
      if (!Number.isFinite(Number(v))) {
        nonNumeric[c] = (nonNumeric[c] ?? 0) + 1;
        continue;
      }
      if (c.startsWith("ref_")) {
        const key = c.slice(4);
        perAnalyteCounts[key] = (perAnalyteCounts[key] ?? 0) + 1;
      }
    }
  }
  const duplicateSampleIds = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);
  return {
    rows: rows.length,
    columns: header,
    missingRequired,
    unknownColumns,
    referenceColumns,
    missingValues,
    nonNumeric,
    duplicateSampleIds,
    perAnalyteCounts,
    syntheticRows,
    declaresSynthetic: syntheticRows > 0,
    hasSyntheticColumn: synIdx !== undefined,
  };
}

/** Numeric column extraction for plots. */
export function column(parsed: ParsedCsv, name: string): number[] {
  const i = parsed.header.indexOf(name);
  if (i < 0) return [];
  const out: number[] = [];
  for (const r of parsed.rows) {
    const v = Number(r[i]);
    if (r[i] !== undefined && r[i] !== "" && Number.isFinite(v)) out.push(v);
  }
  return out;
}
