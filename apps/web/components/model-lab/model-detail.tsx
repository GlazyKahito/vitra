import Link from "next/link";
import type { ModelWithEvals } from "@/lib/data/contract";
import { Panel } from "@/components/ui/panel";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { SyntheticTag } from "@/components/common/synthetic-tag";
import { MiniHistogram, MiniScatter } from "@/components/common/mini-charts";
import { ANALYTE_BY_KEY, isAnalyteKey } from "@/lib/analytes";
import { formatDateTime } from "@/lib/utils";
import { ModelStatusChip } from "./models-table";
import { ModelStatusControls } from "./model-status-controls";
import { allPredictions, evalFor, fmt, perBatch } from "./metrics";

export interface ModelDetailProps {
  m: ModelWithEvals;
  canManage: boolean;
  canValidate: boolean;
}

function MetricCard({ label, e, unit }: { label: string; e: ReturnType<typeof evalFor>; unit: string }) {
  return (
    <div className="panel-inset p-3">
      <div className="t-eyebrow mb-2 flex items-baseline justify-between">
        <span>{label}</span>
        <span>n={e?.n ?? "—"}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]">
        <dt className="text-fg-3">MAE</dt>
        <dd className="t-mono text-right text-fg">
          {fmt(e?.mae)} <span className="text-fg-4">{unit}</span>
        </dd>
        <dt className="text-fg-3">RMSE</dt>
        <dd className="t-mono text-right text-fg">
          {fmt(e?.rmse)} <span className="text-fg-4">{unit}</span>
        </dd>
        <dt className="text-fg-3">Bias</dt>
        <dd className="t-mono text-right text-fg">{fmt(e?.bias)}</dd>
        <dt className="text-fg-3">R²</dt>
        <dd className="t-mono text-right text-fg">{fmt(e?.r2)}</dd>
      </dl>
    </div>
  );
}

export function ModelDetail({ m, canManage, canValidate }: ModelDetailProps) {
  const { model, dataset, stripProduct } = m;
  const def = isAnalyteKey(model.analyteKey) ? ANALYTE_BY_KEY[model.analyteKey] : null;
  const unit = def?.unit ?? "";
  const preds = allPredictions(m);
  const testPreds = preds.filter((p) => p.split === "test");
  const trainPreds = preds.filter((p) => p.split !== "test");
  const batches = perBatch(preds);
  const nTest = model.nTest ?? evalFor(m, "test")?.n ?? null;
  const residualQ = evalFor(m, "test")?.residualQuantiles ?? null;

  return (
    <Panel
      eyebrow={`Model · ${model.version}`}
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span className="t-mono">{model.id}</span>
          <ModelStatusChip status={model.status} />
          {model.trainedOnSynthetic ? <SyntheticTag variant="synthetic-trained" /> : null}
        </span>
      }
      description={`${def?.label ?? model.analyteKey} · ${stripProduct.name} · ${model.modelType} on ${model.featureSet} · trained ${formatDateTime(model.createdAt)}${dataset ? ` · dataset ${dataset.name} v${dataset.version}` : ""}`}
      actions={
        <>
          <Button variant="secondary" size="sm" href={`/model-lab/${encodeURIComponent(model.id)}/export?format=json`}>
            Export JSON
          </Button>
          <Button variant="secondary" size="sm" href={`/model-lab/${encodeURIComponent(model.id)}/export?format=csv`}>
            Export CSV
          </Button>
          <Link href="/model-lab" className="ml-2 text-[12.5px] text-fg-3 hover:text-fg">
            Close
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {model.trainedOnSynthetic ? (
          <div role="note" className="rounded-[var(--radius-sm)] border border-line-strong bg-ink-1 px-4 py-3 text-[12.5px] text-fg-2">
            <span className="font-medium text-fg">Synthetic data — not real-world performance.</span> Every metric and plot on this page comes from generated colour/reference pairs. They show that the fitting pipeline works; they say nothing about how a strip behaves in a real sample.
          </div>
        ) : null}
        {nTest !== null && nTest < 30 ? (
          <div role="note" className="rounded-[var(--radius-sm)] border border-[rgba(232,181,90,0.35)] bg-notice-dim px-4 py-3 text-[12.5px] text-fg-2">
            <span className="font-medium text-notice">Sample-size warning:</span> only {nTest} held-out test rows. MAE/RMSE/R² estimates at this size are unstable; do not compare models on them.
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-3">
          <MetricCard label="Train" e={evalFor(m, "train")} unit={unit} />
          <MetricCard label="Test (held-out)" e={evalFor(m, "test")} unit={unit} />
          <MetricCard label="CV 5-fold" e={evalFor(m, "cv5")} unit={unit} />
        </div>

        <div className="flex flex-wrap gap-2 text-[12px]">
          <Chip tone="neutral">
            reference range {model.referenceLow ?? "—"} – {model.referenceHigh ?? "—"} {unit}
          </Chip>
          <Chip tone="neutral">
            n train {model.nTrain ?? "—"} · test {model.nTest ?? "—"}
          </Chip>
          {residualQ ? (
            <Chip tone="neutral">
              residual p05/p50/p95 {fmt(residualQ.p05, 2)} / {fmt(residualQ.p50, 2)} / {fmt(residualQ.p95, 2)}
            </Chip>
          ) : null}
          {dataset?.synthetic ? <SyntheticTag /> : null}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="panel-inset p-3">
            <MiniScatter
              title="Predicted vs reference"
              identity
              xLabel={`reference (${unit})`}
              yLabel={`predicted (${unit})`}
              series={[
                { label: "train", tone: "muted", points: trainPreds.map((p) => ({ x: p.reference, y: p.predicted, label: p.sample_id })) },
                { label: "test", tone: "signal", points: testPreds.map((p) => ({ x: p.reference, y: p.predicted, label: p.sample_id })) },
              ]}
            />
          </div>
          <div className="panel-inset p-3">
            <MiniScatter
              title="Residual vs reference"
              zeroLine
              fitted
              xLabel={`reference (${unit})`}
              yLabel={`residual (${unit})`}
              series={[
                { label: "train", tone: "muted", points: trainPreds.map((p) => ({ x: p.reference, y: p.residual, label: p.sample_id })) },
                { label: "test", tone: "signal", points: testPreds.map((p) => ({ x: p.reference, y: p.residual, label: p.sample_id })) },
              ]}
            />
          </div>
          <div className="panel-inset p-3">
            <MiniHistogram title="Residual distribution (test)" unit={unit} values={testPreds.map((p) => p.residual)} width={420} height={140} tone="signal" bins={24} />
          </div>
          <div className="panel-inset p-3">
            <div className="t-eyebrow mb-2">Per-batch performance</div>
            {batches.length === 0 ? (
              <p className="text-[12px] text-fg-4">Predictions carry no batch column; per-batch breakdown unavailable. Include a `batch` column in the dataset to see lot-to-lot drift.</p>
            ) : (
              <table className="table-instrument">
                <thead>
                  <tr>
                    <th>Batch</th>
                    <th>n</th>
                    <th>MAE</th>
                    <th>RMSE</th>
                    <th>Bias</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.batch}>
                      <td className="t-mono text-fg">{b.batch}</td>
                      <td className="t-mono">{b.n}</td>
                      <td className="t-mono">{fmt(b.mae)}</td>
                      <td className="t-mono">{fmt(b.rmse)}</td>
                      <td className="t-mono">{fmt(b.bias)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {preds.length === 0 ? <p className="text-[12px] text-fg-4">No stored predictions for this model; plots are empty.</p> : null}

        <section className="border-t border-line pt-4">
          <div className="t-eyebrow mb-2">Status</div>
          <ModelStatusControls modelId={model.id} status={model.status} trainedOnSynthetic={model.trainedOnSynthetic} canManage={canManage} canValidate={canValidate} />
          {model.validationEvidence ? (
            <div className="mt-3 panel-inset p-3">
              <div className="t-eyebrow mb-1">Validation evidence</div>
              <p className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-fg-2">{model.validationEvidence}</p>
            </div>
          ) : null}
        </section>

        {model.trainingMeta && Object.keys(model.trainingMeta).length > 0 ? (
          <details className="group">
            <summary className="cursor-pointer t-eyebrow">Training metadata</summary>
            <pre className="mt-2 panel-inset max-h-[280px] overflow-auto p-3 t-mono text-[11px] text-fg-3">{JSON.stringify(model.trainingMeta, null, 2)}</pre>
          </details>
        ) : null}
      </div>
    </Panel>
  );
}
