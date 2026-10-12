import Link from "next/link";
import type { RunListItem } from "@/lib/data/contract";
import { formatDateTime } from "@/lib/utils";
import { ResultSummaryChips } from "./result-summary-chips";
import { ModeTag, RunStatusChip, SyntheticTag } from "./run-status-chip";

const SOURCE_LABEL: Record<string, string> = {
  upload: "Upload",
  browser_camera: "Browser camera",
  device: "Device",
  synthetic: "Synthetic",
};

export function RunTable({ items, showQuality = false, emptyMessage = "No runs match the current filter." }: { items: RunListItem[]; showQuality?: boolean; emptyMessage?: string }) {
  if (items.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center">
        <span className="t-eyebrow">{emptyMessage}</span>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="table-instrument">
        <thead>
          <tr>
            <th>Run</th>
            <th>Sample</th>
            <th>Mode</th>
            <th>Source</th>
            <th>Status</th>
            {showQuality ? <th>Quality</th> : null}
            <th>Result summary</th>
            <th>Reviewed by</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {items.map(({ run, sample, device, resultSummary, latestReview }) => (
            <tr key={run.id}>
              <td>
                <Link href={`/analysis/${run.id}`} className="t-mono text-[12.5px] text-fg hover:text-signal">
                  {run.runCode}
                </Link>
                {run.synthetic ? <SyntheticTag className="ml-2" /> : null}
              </td>
              <td>
                <Link href={`/samples/${sample.id}`} className="t-mono text-[12.5px] hover:text-signal">
                  {sample.sampleCode}
                </Link>
                {sample.subjectPseudonym ? <span className="ml-2 text-[11.5px] text-fg-4">{sample.subjectPseudonym}</span> : null}
              </td>
              <td>
                <ModeTag mode={run.mode} />
              </td>
              <td className="text-[12.5px]">
                {SOURCE_LABEL[run.imageSource] ?? run.imageSource}
                {device ? <span className="ml-1.5 text-fg-4">{device.simulated ? "(simulated)" : device.name}</span> : null}
              </td>
              <td>
                <RunStatusChip status={run.status} />
              </td>
              {showQuality ? (
                <td className="t-mono text-[11.5px]">
                  {run.qualityPassed === null || run.qualityPassed === undefined ? <span className="text-fg-4">—</span> : run.qualityPassed ? <span className="text-fg-2">passed</span> : <span className="text-fault">failed</span>}
                </td>
              ) : null}
              <td>
                <ResultSummaryChips entries={resultSummary} />
              </td>
              <td className="text-[12.5px]">
                {latestReview ? (
                  <span title={`${latestReview.decision} · ${formatDateTime(latestReview.createdAt)}`}>
                    {latestReview.reviewerLabel}
                    <span className="ml-1.5 t-mono text-[10.5px] uppercase tracking-[0.08em] text-fg-4">{latestReview.decision.replace("_", " ")}</span>
                  </span>
                ) : (
                  <span className="text-fg-4">—</span>
                )}
              </td>
              <td className="t-mono whitespace-nowrap text-[12px] text-fg-3">{formatDateTime(run.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
