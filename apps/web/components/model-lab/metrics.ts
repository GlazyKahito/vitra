import type { ModelEvaluation, ModelWithEvals } from "@/lib/data/contract";

export type Prediction = NonNullable<ModelEvaluation["predictions"]>[number];

export function evalFor(m: ModelWithEvals, split: "train" | "test" | "cv5"): ModelEvaluation | null {
  return m.evaluations.find((e) => e.split === split) ?? null;
}

export function fmt(v: number | null | undefined, decimals = 3): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toFixed(decimals);
}

/** All predictions across evaluations, de-duplicated by (split, sample_id). */
export function allPredictions(m: ModelWithEvals): Prediction[] {
  const seen = new Set<string>();
  const out: Prediction[] = [];
  for (const e of m.evaluations) {
    for (const p of e.predictions ?? []) {
      const k = `${p.split}:${p.sample_id}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(p);
    }
  }
  return out;
}

export interface BatchPerf {
  batch: string;
  n: number;
  mae: number;
  rmse: number;
  bias: number;
}

export function perBatch(preds: Prediction[]): BatchPerf[] {
  const groups = new Map<string, Prediction[]>();
  for (const p of preds) {
    if (!p.batch) continue;
    const g = groups.get(p.batch) ?? [];
    g.push(p);
    groups.set(p.batch, g);
  }
  return [...groups.entries()]
    .map(([batch, ps]) => {
      const n = ps.length;
      const mae = ps.reduce((a, p) => a + Math.abs(p.residual), 0) / n;
      const rmse = Math.sqrt(ps.reduce((a, p) => a + p.residual * p.residual, 0) / n);
      const bias = ps.reduce((a, p) => a + p.residual, 0) / n;
      return { batch, n, mae, rmse, bias };
    })
    .sort((a, b) => a.batch.localeCompare(b.batch));
}

export function predictionsCsv(preds: Prediction[]): string {
  const header = ["sample_id", "split", "batch", "reference", "predicted", "residual"];
  const esc = (v: string | number | undefined) => {
    const s = v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header.join(","), ...preds.map((p) => [p.sample_id, p.split, p.batch ?? "", p.reference, p.predicted, p.residual].map(esc).join(","))].join("\n") + "\n";
}
