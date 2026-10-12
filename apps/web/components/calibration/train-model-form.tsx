"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field, Input, Select } from "@/components/ui/field";
import { SyntheticTag } from "@/components/common/synthetic-tag";
import { ANALYTES, ANALYTE_BY_KEY, isAnalyteKey } from "@/lib/analytes";
import { trainModelAction } from "@/app/actions/calibration";

export interface TrainModelFormProps {
  datasets: { id: string; name: string; version: number; stripProductId: string; synthetic: boolean; rowCount: number; perAnalyteCounts: Record<string, number> | null }[];
  products: { id: string; name: string; padMap: string[] }[];
  canTrain: boolean;
  /** Pre-selected dataset (from ?dataset=). */
  initialDatasetId?: string;
}

const MODEL_TYPES: { key: string; label: string; note: string }[] = [
  { key: "linear", label: "Linear", note: "Ordinary least squares on the feature set. Baseline; assumes a straight colour→value relationship." },
  { key: "poly2_ridge", label: "Polynomial 2 + ridge", note: "Quadratic features with L2 shrinkage. Usual first choice for reagent-pad colour curves." },
  { key: "poly3_ridge", label: "Polynomial 3 + ridge", note: "Cubic features with L2 shrinkage. Needs more rows; prone to extrapolation artefacts." },
  { key: "knn", label: "k-nearest neighbours", note: "Non-parametric; predicts from the closest training colours. Cannot extrapolate at all." },
  { key: "rf", label: "Random forest", note: "Ensemble of trees; robust to outliers, step-like outside the training range." },
];

const FEATURE_SETS: { key: string; label: string; note: string }[] = [
  { key: "rgb30", label: "rgb30", note: "Mean R,G,B of all 10 pads (30 features)." },
  { key: "pad_rgb", label: "pad_rgb", note: "Only the analyte's own pad R,G,B (3 features). Pad index comes from the product pad map." },
  { key: "lab30", label: "lab30", note: "CIELAB L*,a*,b* of all 10 pads (30 features)." },
];

export function TrainModelForm({ datasets, products, canTrain, initialDatasetId }: TrainModelFormProps) {
  const [datasetId, setDatasetId] = useState(initialDatasetId && datasets.some((d) => d.id === initialDatasetId) ? initialDatasetId : (datasets[0]?.id ?? ""));
  const [analyte, setAnalyte] = useState<string>("glucose");
  const [modelType, setModelType] = useState("poly2_ridge");
  const [featureSet, setFeatureSet] = useState("rgb30");
  const [version, setVersion] = useState("");
  const [testFraction, setTestFraction] = useState("0.25");
  const [result, setResult] = useState<{ ok: true; modelId: string; warning: string | null } | { ok: false; error: string } | null>(null);
  const [pending, start] = useTransition();

  const dataset = datasets.find((d) => d.id === datasetId) ?? null;
  const product = dataset ? (products.find((p) => p.id === dataset.stripProductId) ?? null) : null;
  const padIndex = product ? product.padMap.indexOf(analyte) : -1;
  const refCount = dataset?.perAnalyteCounts?.[analyte];
  const tf = Number(testFraction);
  const tfOk = Number.isFinite(tf) && tf >= 0.1 && tf <= 0.5;
  // Left empty, the server derives the next free version (<analyte>-<type>-<features>-vN).
  const versionAuto = useMemo(() => `auto: ${analyte}-${modelType.replace(/_ridge$/, "")}-${featureSet}-vN`, [analyte, modelType, featureSet]);
  const padRequired = featureSet === "pad_rgb";
  const blocking = !canTrain || !dataset || !tfOk || (padRequired && padIndex < 0) || (refCount !== undefined && refCount < 20);

  function submit() {
    if (blocking || !dataset) return;
    const fd = new FormData();
    fd.set("datasetId", dataset.id);
    fd.set("analyteKey", analyte);
    fd.set("modelType", modelType);
    fd.set("featureSet", featureSet);
    if (padIndex >= 0) fd.set("padIndex", String(padIndex));
    if (version.trim()) fd.set("version", version.trim());
    fd.set("testFraction", String(tf));
    start(async () => {
      const res = await trainModelAction(fd);
      setResult(res.ok ? { ok: true, modelId: res.modelId, warning: res.warning } : { ok: false, error: res.error });
    });
  }

  const mt = MODEL_TYPES.find((m) => m.key === modelType);
  const fs = FEATURE_SETS.find((f) => f.key === featureSet);

  return (
    <div className="flex flex-col gap-3">
      <Field label="Dataset" required>
        <Select value={datasetId} onChange={(e) => setDatasetId(e.target.value)} disabled={!canTrain || datasets.length === 0}>
          {datasets.length === 0 ? <option value="">No datasets imported</option> : null}
          {datasets.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} v{d.version} · {d.rowCount} rows{d.synthetic ? " · SYNTHETIC" : ""}
            </option>
          ))}
        </Select>
      </Field>
      {dataset?.synthetic ? (
        <div className="flex items-center gap-2 text-[12px] text-fg-3">
          <SyntheticTag /> The resulting model will be tagged synthetic-trained and can only serve demo mode.
        </div>
      ) : null}

      <Field label="Analyte" required help={refCount === undefined ? "Reference counts unknown for this dataset." : `${refCount} reference values in dataset${refCount < 20 ? " — the service requires ≥ 20 usable rows" : refCount < 30 ? " — insufficient (< 30)" : ""}.`}>
        <Select value={analyte} onChange={(e) => setAnalyte(e.target.value)} disabled={!canTrain}>
          {ANALYTES.map((a) => (
            <option key={a.key} value={a.key}>
              {a.label} · {a.unit}
              {a.kind === "qualitative" ? " (qualitative)" : ""}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Model type" required help={mt?.note}>
        <Select value={modelType} onChange={(e) => setModelType(e.target.value)} disabled={!canTrain}>
          {MODEL_TYPES.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Feature set" required help={fs?.note} error={padRequired && padIndex < 0 ? `${isAnalyteKey(analyte) ? ANALYTE_BY_KEY[analyte].label : analyte} is not on the ${product?.name ?? "product"} pad map.` : undefined}>
        <Select value={featureSet} onChange={(e) => setFeatureSet(e.target.value)} disabled={!canTrain}>
          {FEATURE_SETS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid grid-cols-[1fr_120px] gap-3">
        <Field label="Version" hint="optional">
          <Input mono value={version} onChange={(e) => setVersion(e.target.value)} placeholder={versionAuto} disabled={!canTrain} />
        </Field>
        <Field label="Test fraction" error={tfOk ? undefined : "0.10 – 0.50"}>
          <Input mono type="number" step="0.05" min={0.1} max={0.5} value={testFraction} onChange={(e) => setTestFraction(e.target.value)} disabled={!canTrain} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[12px] text-fg-3">
        <Chip tone="neutral">pad index {padIndex >= 0 ? padIndex : "—"}</Chip>
        <Chip tone="neutral">{product?.name ?? "no product"}</Chip>
        <span className="t-mono text-[11px] text-fg-4">seeded split, grouped by sample_id</span>
      </div>

      {result && !result.ok ? (
        <p className="text-[12.5px] text-fault" role="alert">
          Training failed: {result.error}
        </p>
      ) : null}
      {result && result.ok ? (
        <p className="text-[12.5px] text-fg-2" role="status">
          Model trained:{" "}
          <Link href={`/model-lab?model=${encodeURIComponent(result.modelId)}`} className="t-mono text-signal underline-offset-2 hover:underline">
            {result.modelId}
          </Link>{" "}
          — open in Model Lab to evaluate.
          {result.warning ? <span className="mt-1 block text-notice">{result.warning}</span> : null}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        {!canTrain ? <span className="text-[12px] text-fg-4">Requires calibration.manage.</span> : null}
        <Button onClick={submit} loading={pending} disabled={blocking}>
          Train model
        </Button>
      </div>
    </div>
  );
}
