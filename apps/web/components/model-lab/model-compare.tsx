import Link from "next/link";
import type { ModelWithEvals } from "@/lib/data/contract";
import { Panel } from "@/components/ui/panel";
import { SyntheticTag } from "@/components/common/synthetic-tag";
import { MiniScatter } from "@/components/common/mini-charts";
import { ANALYTE_BY_KEY, isAnalyteKey } from "@/lib/analytes";
import { ModelStatusChip } from "./models-table";
import { allPredictions, evalFor, fmt } from "./metrics";

export interface ModelCompareProps {
  a: ModelWithEvals;
  b: ModelWithEvals;
}

const SPLITS = ["train", "test", "cv5"] as const;
const METRICS = ["mae", "rmse", "bias", "r2"] as const;

export function ModelCompare({ a, b }: ModelCompareProps) {
  const sameAnalyte = a.model.analyteKey === b.model.analyteKey;
  const unit = isAnalyteKey(a.model.analyteKey) ? ANALYTE_BY_KEY[a.model.analyteKey].unit : "";
  const aTest = allPredictions(a).filter((p) => p.split === "test");
  const bTest = allPredictions(b).filter((p) => p.split === "test");
  const anySynthetic = a.model.trainedOnSynthetic || b.model.trainedOnSynthetic;

  return (
    <Panel
      eyebrow="Compare"
      title={
        <span className="t-mono text-[14px]">
          {a.model.id} <span className="text-fg-4">vs</span> {b.model.id}
        </span>
      }
      description={sameAnalyte ? `${isAnalyteKey(a.model.analyteKey) ? ANALYTE_BY_KEY[a.model.analyteKey].label : a.model.analyteKey} · held-out test predictions overlaid` : "Different analytes — metrics are not comparable; shown for reference only."}
      actions={
        <Link href={`/model-lab?model=${encodeURIComponent(a.model.id)}`} className="text-[12.5px] text-fg-3 hover:text-fg">
          Exit compare
        </Link>
      }
    >
      <div className="flex flex-col gap-5">
        {anySynthetic ? (
          <div role="note" className="rounded-[var(--radius-sm)] border border-line-strong bg-ink-1 px-4 py-3 text-[12.5px] text-fg-2">
            <span className="font-medium text-fg">At least one model is synthetic-trained.</span> Differences between the two reflect the generator, not strip chemistry.
          </div>
        ) : null}
        <table className="table-instrument">
          <thead>
            <tr>
              <th>Metric</th>
              <th>
                <span className="text-signal">A</span> · {a.model.version}
              </th>
              <th>
                <span className="text-notice">B</span> · {b.model.version}
              </th>
              <th>Δ (B − A)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-fg">Status · data</td>
              <td>
                <span className="flex gap-1.5">
                  <ModelStatusChip status={a.model.status} />
                  {a.model.trainedOnSynthetic ? <SyntheticTag variant="synthetic-trained" /> : null}
                </span>
              </td>
              <td>
                <span className="flex gap-1.5">
                  <ModelStatusChip status={b.model.status} />
                  {b.model.trainedOnSynthetic ? <SyntheticTag variant="synthetic-trained" /> : null}
                </span>
              </td>
              <td />
            </tr>
            <tr>
              <td className="text-fg">Type · features</td>
              <td className="t-mono">
                {a.model.modelType} · {a.model.featureSet}
              </td>
              <td className="t-mono">
                {b.model.modelType} · {b.model.featureSet}
              </td>
              <td />
            </tr>
            <tr>
              <td className="text-fg">n train / test</td>
              <td className="t-mono">
                {a.model.nTrain ?? "—"} / {a.model.nTest ?? "—"}
              </td>
              <td className="t-mono">
                {b.model.nTrain ?? "—"} / {b.model.nTest ?? "—"}
              </td>
              <td />
            </tr>
            {SPLITS.flatMap((split) =>
              METRICS.map((metric) => {
                const ea = evalFor(a, split);
                const eb = evalFor(b, split);
                const va = ea?.[metric] ?? null;
                const vb = eb?.[metric] ?? null;
                const delta = va !== null && vb !== null ? vb - va : null;
                return (
                  <tr key={`${split}-${metric}`}>
                    <td className="text-fg">
                      {split} {metric.toUpperCase()}
                      {metric !== "r2" && unit ? <span className="text-fg-4"> ({unit})</span> : null}
                    </td>
                    <td className="t-mono">{fmt(va)}</td>
                    <td className="t-mono">{fmt(vb)}</td>
                    <td className="t-mono text-fg-3">{delta === null ? "—" : (delta > 0 ? "+" : "") + fmt(delta)}</td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>

        <div className="panel-inset p-3">
          <MiniScatter
            title="Predicted vs reference · held-out test"
            identity
            width={820}
            height={320}
            xLabel={`reference (${unit})`}
            yLabel={`predicted (${unit})`}
            series={[
              { label: `A ${a.model.version}`, tone: "signal", points: aTest.map((p) => ({ x: p.reference, y: p.predicted, label: p.sample_id })) },
              { label: `B ${b.model.version}`, tone: "notice", points: bTest.map((p) => ({ x: p.reference, y: p.predicted, label: p.sample_id })) },
            ]}
          />
        </div>
      </div>
    </Panel>
  );
}
