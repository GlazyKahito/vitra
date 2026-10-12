import Link from "next/link";
import type { ModelWithEvals } from "@/lib/data/contract";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { SyntheticTag } from "@/components/common/synthetic-tag";
import { ANALYTE_BY_KEY, isAnalyteKey } from "@/lib/analytes";
import { formatDateTime } from "@/lib/utils";
import { evalFor, fmt } from "./metrics";

export const MODEL_STATUS_TONE: Record<string, ChipTone> = { draft: "muted", trained: "neutral", validated: "signal", retired: "muted" };

export function ModelStatusChip({ status }: { status: string }) {
  return <Chip tone={MODEL_STATUS_TONE[status] ?? "neutral"}>{status}</Chip>;
}

export interface ModelsTableProps {
  models: ModelWithEvals[];
  selectedId?: string;
  compareId?: string;
}

export function ModelsTable({ models, selectedId, compareId }: ModelsTableProps) {
  if (models.length === 0) {
    return (
      <p className="px-5 py-8 text-[12.5px] text-fg-4">
        No calibration models yet. Train one from the{" "}
        <Link href="/calibration" className="text-signal">
          Calibration Studio
        </Link>
        .
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="table-instrument ws-compact">
        <thead>
          <tr>
            <th>Model</th>
            <th>Analyte</th>
            <th>Product</th>
            <th>Type</th>
            <th>Features</th>
            <th>Status</th>
            <th>Data</th>
            <th>n train / test</th>
            <th>Test MAE</th>
            <th>Test RMSE</th>
            <th>Test R²</th>
            <th>Created</th>
            <th aria-label="compare" />
          </tr>
        </thead>
        <tbody>
          {models.map((m) => {
            const { model, stripProduct } = m;
            const test = evalFor(m, "test");
            const isSel = model.id === selectedId;
            const isCmp = model.id === compareId;
            return (
              <tr key={model.id} className={isSel ? "bg-[rgba(95,212,230,0.05)]" : isCmp ? "bg-[rgba(232,181,90,0.05)]" : undefined}>
                <td className="whitespace-nowrap">
                  <Link href={`/model-lab?model=${encodeURIComponent(model.id)}`} className="t-mono text-[12px] text-fg hover:text-signal">
                    {model.id}
                  </Link>
                  <div className="t-mono text-[10.5px] text-fg-4">{model.version}</div>
                </td>
                <td>{isAnalyteKey(model.analyteKey) ? ANALYTE_BY_KEY[model.analyteKey].label : model.analyteKey}</td>
                <td className="min-w-[140px]">{stripProduct.name}</td>
                <td className="t-mono text-[12px]">{model.modelType}</td>
                <td className="t-mono text-[12px]">{model.featureSet}</td>
                <td>
                  <ModelStatusChip status={model.status} />
                </td>
                <td>{model.trainedOnSynthetic ? <SyntheticTag variant="synthetic-trained" /> : <Chip tone="neutral">real refs</Chip>}</td>
                <td className="t-mono">
                  {model.nTrain ?? "—"} / {model.nTest ?? "—"}
                  {model.nTest !== null && model.nTest < 30 ? <span className="ml-1 text-notice" title="test set smaller than 30">†</span> : null}
                </td>
                <td className="t-mono">{fmt(test?.mae)}</td>
                <td className="t-mono">{fmt(test?.rmse)}</td>
                <td className="t-mono">{fmt(test?.r2)}</td>
                <td className="t-mono whitespace-nowrap text-[12px]">{formatDateTime(model.createdAt)}</td>
                <td>
                  {selectedId && selectedId !== model.id ? (
                    <Link href={`/model-lab?model=${encodeURIComponent(selectedId)}&compare=${encodeURIComponent(model.id)}`} className="text-[12px] text-fg-3 hover:text-fg">
                      compare
                    </Link>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-4 py-2 t-mono text-[10.5px] text-fg-4">† test set &lt; 30 rows — metrics are unstable. Click a model id to open the detail view.</p>
    </div>
  );
}
