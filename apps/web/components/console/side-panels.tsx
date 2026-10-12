import Link from "next/link";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { Panel } from "@/components/ui/panel";
import { ANALYTE_BY_KEY, isAnalyteKey } from "@/lib/analytes";
import type { CalibrationStatus, ConsoleStats, DeviceWithHealth, ModelWithEvals } from "@/lib/data/contract";
import { formatDateTime, formatRelative } from "@/lib/utils";
import { SyntheticTag } from "./run-status-chip";

const CAL_STATUS: Record<CalibrationStatus["perAnalyte"][number]["status"], { label: string; tone: ChipTone }> = {
  none: { label: "none", tone: "muted" },
  synthetic_only: { label: "synthetic-only", tone: "muted" },
  experimental: { label: "experimental", tone: "notice" },
  validated: { label: "validated", tone: "signal" },
};

export function CalibrationPanel({ status, intervalDays }: { status: CalibrationStatus | null; intervalDays: number }) {
  if (!status) {
    return (
      <Panel eyebrow="Calibration" title="No strip product configured" flush>
        <div className="p-5 text-[12.5px] text-fg-3">Add a strip product before training models.</div>
      </Panel>
    );
  }
  return (
    <Panel eyebrow="Calibration status" title={status.stripProductName} flush actions={<Link href="/calibration" className="t-mono text-[11px] uppercase tracking-[0.1em] text-fg-3 hover:text-[var(--lux-gold)]">Open</Link>}>
      <table className="table-instrument ws-compact">
        <thead>
          <tr>
            <th>Analyte</th>
            <th>Model</th>
            <th className="text-right">Age</th>
            <th>Recal.</th>
          </tr>
        </thead>
        <tbody>
          {status.perAnalyte.map((a) => {
            const def = isAnalyteKey(a.analyteKey) ? ANALYTE_BY_KEY[a.analyteKey] : null;
            const meta = CAL_STATUS[a.status];
            return (
              <tr key={a.analyteKey}>
                <td className="whitespace-nowrap text-fg">
                  <span className="t-mono mr-2 text-[10.5px] text-fg-4">{def?.short ?? a.analyteKey}</span>
                  {def?.label ?? a.analyteKey}
                </td>
                <td>
                  <Chip tone={meta.tone} className="px-1.5 tracking-[0.05em]" title={a.model ? `${a.model.id} v${a.model.version}` : "No model"}>
                    {meta.label}
                  </Chip>
                </td>
                <td className="t-mono whitespace-nowrap text-right text-[12px]">{a.ageDays === null ? "—" : `${a.ageDays} d`}</td>
                <td className="t-mono text-[11px] uppercase tracking-[0.08em]">{a.recalibrationDue ? <span className="text-notice">due</span> : a.model ? <span className="text-fg-4">ok</span> : <span className="text-fg-4">—</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="border-t border-line px-5 py-2.5 text-[11.5px] text-fg-4">Recalibration interval {intervalDays} d. No model is clinically validated.</div>
    </Panel>
  );
}

export function ModelVersionsPanel({ models }: { models: ModelWithEvals[] }) {
  return (
    <Panel eyebrow="Model versions" title={`${models.length} model${models.length === 1 ? "" : "s"}`} flush>
      {models.length === 0 ? (
        <div className="p-5 text-[12.5px] text-fg-3">No calibration models trained yet.</div>
      ) : (
        <ul className="divide-y divide-line">
          {models.slice(0, 8).map(({ model, dataset, evaluations }) => {
            const test = evaluations.find((e) => e.split === "test");
            return (
              <li key={model.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link href={`/calibration/models/${model.id}`} className="t-mono truncate text-[12px] text-fg hover:text-signal">
                      {model.id}
                    </Link>
                    {model.trainedOnSynthetic ? <SyntheticTag /> : null}
                  </div>
                  <div className="mt-0.5 text-[11px] text-fg-4">
                    v{model.version} · {model.modelType} · {model.featureSet}
                    {dataset ? ` · ${dataset.name}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <Chip tone={model.status === "validated" ? "signal" : model.status === "trained" ? "notice" : "muted"}>{model.status}</Chip>
                  {test && test.mae !== null ? <div className="t-mono mt-1 text-[10.5px] text-fg-4">MAE {test.mae.toFixed(2)}</div> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

const HEALTH_TONE: Record<DeviceWithHealth["health"], ChipTone> = { simulated: "muted", online: "signal", degraded: "notice", offline: "neutral" };

export function DevicesPanel({ devices }: { devices: DeviceWithHealth[] }) {
  return (
    <Panel eyebrow="Device status" title="Capture devices" flush actions={<Link href="/devices" className="t-mono text-[11px] uppercase tracking-[0.1em] text-fg-3 hover:text-signal">Manage</Link>}>
      {devices.length === 0 ? (
        <div className="p-5 text-[12.5px] text-fg-3">No devices registered. Browser capture and upload remain available.</div>
      ) : (
        <ul className="divide-y divide-line">
          {devices.map(({ device, health, errorCount24h, lastCapture }) => (
            <li key={device.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[13px] text-fg">
                  <span className="truncate">{device.name}</span>
                  {device.simulated ? <span className="t-mono text-[9.5px] uppercase tracking-[0.14em] text-fg-4">simulated</span> : <span className="t-mono text-[9.5px] uppercase tracking-[0.14em] text-fg-3">real hardware</span>}
                </div>
                <div className="mt-0.5 text-[11px] text-fg-4">
                  {device.kind} · last seen {device.lastSeenAt ? formatRelative(device.lastSeenAt) : "never"}
                  {lastCapture ? ` · capture ${formatRelative(lastCapture.createdAt)}` : ""}
                  {errorCount24h > 0 ? ` · ${errorCount24h} errors 24 h` : ""}
                </div>
              </div>
              <Chip tone={HEALTH_TONE[health]} dot pulse={health === "online"}>
                {health}
              </Chip>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-line px-5 py-2.5 text-[11.5px] text-fg-4">Simulated devices generate events locally; nothing here is live telemetry from the physical prototype.</div>
    </Panel>
  );
}

export function QualityFailuresPanel({ failures }: { failures: ConsoleStats["recentQualityFailures"] }) {
  return (
    <Panel eyebrow="Image quality" title="Recent failures" flush>
      {failures.length === 0 ? (
        <div className="p-5 text-[12.5px] text-fg-3">No image-quality failures recorded.</div>
      ) : (
        <ul className="divide-y divide-line">
          {failures.slice(0, 6).map(({ run, sample, failedChecks }) => (
            <li key={run.id} className="px-5 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <Link href={`/analysis/${run.id}`} className="t-mono text-[12px] text-fg hover:text-signal">
                  {run.runCode}
                </Link>
                <span className="t-mono text-[11px] text-fg-4">{formatDateTime(run.createdAt)}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="t-mono text-[11px] text-fg-3">{sample.sampleCode}</span>
                {failedChecks.map((c) => (
                  <Chip key={c} tone="fault">
                    {c}
                  </Chip>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
