import Link from "next/link";
import type { ReactNode } from "react";
import { Chip } from "@/components/ui/chip";
import { Panel } from "@/components/ui/panel";
import { StateChip } from "@/components/ui/state-chip";
import { ChartFrame, LineChart } from "@/components/charts";
import { ModeTag, RunStatusChip, SyntheticTag } from "@/components/console/run-status-chip";
import { ANALYTE_BY_KEY, formatAnalyteValue, isAnalyteKey } from "@/lib/analytes";
import type { RunDetail } from "@/lib/data/contract";
import { RESULT_STATE_META, type ResultState } from "@/lib/inference/policy";
import { formatDateTime } from "@/lib/utils";
import { SegmentationInspector, type InspectorPad } from "./segmentation-inspector";

function fileUrl(path: string | null | undefined): string | null {
  return path ? `/api/files/${path.split("/").map(encodeURIComponent).join("/")}` : null;
}

function geomNumber(g: Record<string, unknown> | null | undefined, key: string): number | null {
  const v = g?.[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

const BANNERS: Record<string, { tone: "fault" | "neutral" | "notice"; title: string; body: string }> = {
  invalid_image: { tone: "fault", title: "Invalid image", body: "Whole-image quality checks failed, so no pad was analysed and no analyte value exists for this run. Re-capture with the strip flat, in focus and evenly lit." },
  calibration_required: { tone: "neutral", title: "Calibration required", body: "The image passed quality checks but no compatible calibration model exists for any analyte on this strip product in this mode. Train or validate a model, or use demo mode for synthetic demonstration values." },
  failed: { tone: "fault", title: "Run failed", body: "The pipeline or CV service errored. Nothing was inferred." },
};

export function ResultInspector({ run: d, actions }: { run: RunDetail; actions: ReactNode }) {
  const { run, sample, stripProduct, batch, image, operator, pads, results, reviews, previousRunsForSubject, device } = d;
  const banner = BANNERS[run.status];
  const overlayUrl = fileUrl(image?.overlayPath);
  const originalUrl = fileUrl(image?.storagePath);
  const stripUrl = fileUrl(image?.stripCropPath);
  const geometry = run.stripGeometry ?? null;

  const inspectorPads: InspectorPad[] = pads
    .slice()
    .sort((a, b) => a.padIndex - b.padIndex)
    .map((p) => ({
      padId: p.padId,
      padIndex: p.padIndex,
      analyteKey: p.analyteKey,
      roi: p.roi,
      roiSource: p.roiSource,
      qualityStatus: p.qualityStatus,
      qualityMetrics: p.qualityMetrics ?? null,
      flags: p.flags ?? [],
      features: p.features
        ? { rgbMean: p.features.rgbMean, rgbMedian: p.features.rgbMedian, rgbStd: p.features.rgbStd, labMean: p.features.labMean, labStd: p.features.labStd ?? null, hsvMean: p.features.hsvMean ?? null, pixelCount: p.features.pixelCount }
        : null,
    }));

  // 10 rows in pad order (pad map), falling back to stored results order.
  const padMap = stripProduct.padMap ?? [];
  const resultByKey = new Map(results.map((r) => [r.analyteKey, r]));
  const rows = (padMap.length ? padMap : results.map((r) => r.analyteKey)).map((key, i) => ({ key, padIndex: i, result: resultByKey.get(key) ?? null, pad: pads.find((p) => p.padIndex === i) ?? null }));

  const timeline: { label: string; at: Date | string | null; note?: string }[] = [
    { label: "Reaction started", at: run.reactionStartedAt, note: run.reactionSeconds ? `${run.reactionSeconds} s configured` : "untimed" },
    { label: "Captured", at: run.capturedAt ?? image?.capturedAt ?? null, note: run.imageSource },
    { label: "Run created", at: run.createdAt },
    { label: "Processed", at: run.completedAt, note: run.pipelineVersion ?? undefined },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* header strip */}
      <div className="panel flex items-center justify-between gap-6 px-5 py-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="t-eyebrow">Run</div>
            <div className="t-mono text-[22px] leading-none text-fg">{run.runCode}</div>
          </div>
          <div className="h-8 w-px bg-line" />
          <div>
            <div className="t-eyebrow">Sample</div>
            <Link href={`/samples/${sample.id}`} className="t-mono text-[15px] text-fg-2 hover:text-signal">
              {sample.sampleCode}
            </Link>
            {sample.subjectPseudonym ? <span className="ml-2 text-[12px] text-fg-4">{sample.subjectPseudonym}</span> : null}
          </div>
          <div className="h-8 w-px bg-line" />
          <div className="flex items-center gap-2">
            <RunStatusChip status={run.status} />
            <ModeTag mode={run.mode} />
            {run.synthetic || sample.synthetic ? <SyntheticTag /> : null}
          </div>
        </div>
        {actions}
      </div>

      {banner ? (
        <div className={"flex items-start gap-3 rounded-[var(--radius-sm)] border px-4 py-3 text-[13px] " + (banner.tone === "fault" ? "border-[rgba(224,108,108,0.35)] bg-fault-dim" : banner.tone === "notice" ? "border-[rgba(232,181,90,0.35)] bg-notice-dim" : "border-line-strong bg-ink-1")} role="status">
          <span className={"t-mono mt-0.5 text-[10.5px] uppercase tracking-[0.12em] " + (banner.tone === "fault" ? "text-fault" : banner.tone === "notice" ? "text-notice" : "text-fg-3")}>{banner.title}</span>
          <span className="text-fg-2">
            {banner.body}
            {run.errorMessage ? <span className="t-mono ml-2 text-fg-3">{run.errorMessage}</span> : null}
          </span>
        </div>
      ) : null}

      {/* images */}
      <div className="grid grid-cols-12 gap-4">
        <Panel eyebrow="Original" title={image ? `${image.width ?? "?"}×${image.height ?? "?"} · ${image.mimeType}` : "No image"} className="col-span-4" flush>
          <ImageBox url={originalUrl} alt="Original capture" />
        </Panel>
        <Panel eyebrow="Annotated overlay" title="Strip polygon + pad boxes" className="col-span-4" flush>
          <ImageBox url={overlayUrl} alt="Annotated overlay" />
        </Panel>
        <Panel eyebrow="Metadata" title="Acquisition" className="col-span-4" flush>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 px-5 py-4 text-[12px]">
            <dt className="text-fg-4">Strip product</dt>
            <dd className="text-fg-2">
              {stripProduct.manufacturer} {stripProduct.name}
            </dd>
            <dt className="text-fg-4">Batch</dt>
            <dd className="t-mono text-fg-2">{batch ? batch.lotNumber : "—"}</dd>
            <dt className="text-fg-4">Source</dt>
            <dd className="text-fg-2">
              {run.imageSource === "browser_camera" ? "browser camera (not device)" : run.imageSource}
              {device ? ` · ${device.name}${device.simulated ? " (simulated)" : ""}` : ""}
            </dd>
            <dt className="text-fg-4">Operator</dt>
            <dd className="text-fg-2">{run.operatorLabel ?? operator?.displayName ?? "—"}</dd>
            <dt className="text-fg-4">Pipeline</dt>
            <dd className="t-mono text-fg-2">{run.pipelineVersion ?? "—"}</dd>
            <dt className="text-fg-4">SHA-256</dt>
            <dd className="t-mono truncate text-fg-3" title={image?.sha256}>
              {image?.sha256 ? image.sha256.slice(0, 16) + "…" : "—"}
            </dd>
            <dt className="text-fg-4">Strip found</dt>
            <dd className="t-mono text-fg-2">
              {geometry ? String(geometry.found ?? "—") : "—"}
              {geomNumber(geometry, "angle_deg") !== null ? ` · ${geomNumber(geometry, "angle_deg")!.toFixed(1)}°` : ""}
            </dd>
            <dt className="text-fg-4">Quality</dt>
            <dd className={"t-mono " + (run.qualityPassed === false ? "text-fault" : "text-fg-2")}>{run.qualityPassed === null ? "—" : run.qualityPassed ? "passed" : "failed"}</dd>
          </dl>
        </Panel>
      </div>

      <Panel eyebrow="Segmentation" title="Rectified strip and pad features" description="Hover or click a pad to inspect the colour features the CV service extracted. Coordinates are in rectified-strip pixels.">
        <SegmentationInspector stripUrl={stripUrl} rectifiedWidth={geomNumber(geometry, "rectified_width")} rectifiedHeight={geomNumber(geometry, "rectified_height")} pads={inspectorPads} />
      </Panel>

      {/* results */}
      <Panel eyebrow="Results" title="Ten analytes" description="A value is shown only when the result state permits it. States describe provenance, not whether a value is normal." flush>
        <table className="table-instrument">
          <thead>
            <tr>
              <th>Pad</th>
              <th>Analyte</th>
              <th>State</th>
              <th className="text-right">Value</th>
              <th>Supported scale</th>
              <th>Interval</th>
              <th>Model · provenance</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, padIndex, result, pad }) => {
              const def = isAnalyteKey(key) ? ANALYTE_BY_KEY[key] : null;
              const state = (result?.state ?? (run.status === "invalid_image" ? "invalid_image" : run.status === "failed" ? "unavailable" : "calibration_required")) as ResultState;
              const meta = RESULT_STATE_META[state];
              const showsValue = meta.showsValue && result?.value !== null && result?.value !== undefined;
              const model = result?.model ?? null;
              return (
                <tr key={key + padIndex}>
                  <td className="t-mono text-[12px] text-fg-3">
                    {pad?.padId ?? `P${String(padIndex + 1).padStart(2, "0")}`}
                    {pad?.qualityStatus === "fail" ? <span className="ml-1.5 text-fault">fail</span> : pad?.qualityStatus === "warn" ? <span className="ml-1.5 text-notice">warn</span> : null}
                  </td>
                  <td className="text-fg">
                    {def?.label ?? key}
                    {def?.critical ? <span className="t-mono ml-1.5 text-[9.5px] uppercase tracking-[0.12em] text-fg-4">critical</span> : null}
                  </td>
                  <td>
                    <StateChip state={state} />
                  </td>
                  <td className="t-mono text-right text-[13px]">
                    {showsValue && def ? (
                      <span className={state === "synthetic" ? "text-fg-3" : "text-fg"}>
                        {formatAnalyteValue(def.key, result!.value)} <span className="text-fg-4">{result!.unit}</span>
                      </span>
                    ) : (
                      <span className="text-fg-4">—</span>
                    )}
                  </td>
                  <td className="t-mono text-[11px] text-fg-4">{def ? def.chartScale.join(" · ") : "—"}</td>
                  <td className="t-mono text-[11.5px] text-fg-3">{showsValue && result?.intervalLow !== null && result?.intervalHigh !== null && result ? `${result.intervalLow?.toFixed(def?.decimals ?? 1)} – ${result.intervalHigh?.toFixed(def?.decimals ?? 1)}` : "—"}</td>
                  <td className="text-[11.5px]">
                    {model ? (
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Link href={`/calibration/models/${model.id}`} className="t-mono text-fg-2 hover:text-signal">
                          {model.id}
                        </Link>
                        <span className="t-mono text-fg-4">v{model.version}</span>
                        <Chip tone={model.status === "validated" ? "signal" : "muted"}>{model.status}</Chip>
                        {model.trainedOnSynthetic ? <SyntheticTag title="Trained on synthetic data" /> : null}
                      </span>
                    ) : (
                      <span className="text-fg-4">no model</span>
                    )}
                  </td>
                  <td className="max-w-[260px] text-[11.5px] leading-snug text-fg-3">{result?.reason ?? meta.description}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>

      <div className="grid grid-cols-12 gap-4">
        <Panel eyebrow="Image quality" title="Checks" className="col-span-5" flush>
          {run.qualityChecks && run.qualityChecks.length > 0 ? (
            <ul className="divide-y divide-line">
              {run.qualityChecks.map((c) => (
                <li key={c.id} className="flex items-start gap-3 px-5 py-2.5 text-[12.5px]">
                  <Chip tone={c.status === "fail" ? "fault" : c.status === "warn" ? "notice" : "neutral"} className="mt-0.5 w-14 justify-center">
                    {c.status}
                  </Chip>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-fg">{c.label}</span>
                      <span className="t-mono text-[11px] text-fg-3">
                        {c.value === null ? "—" : String(c.value)}
                        {c.threshold ? <span className="text-fg-4"> / {c.threshold}</span> : null}
                      </span>
                    </div>
                    <div className="text-[11.5px] text-fg-4">{c.message}</div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-5 text-[12.5px] text-fg-4">No quality checks recorded.</div>
          )}
        </Panel>

        <div className="col-span-4 flex flex-col gap-4">
          <Panel eyebrow="Processing" title="Timeline" flush>
            <ol className="divide-y divide-line">
              {timeline.map((t) => (
                <li key={t.label} className="flex items-center justify-between px-5 py-2.5 text-[12.5px]">
                  <span className="text-fg-2">{t.label}</span>
                  <span className="t-mono text-right text-[11.5px] text-fg-3">
                    {formatDateTime(t.at, { seconds: true })}
                    {t.note ? <span className="ml-2 text-fg-4">{t.note}</span> : null}
                  </span>
                </li>
              ))}
              {run.timings ? (
                <li className="px-5 py-2.5">
                  <div className="t-eyebrow mb-1.5">timings_ms</div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {Object.entries(run.timings).map(([k, v]) => (
                      <span key={k} className="t-mono text-[11px] text-fg-3">
                        {k} <span className="text-fg">{typeof v === "number" ? Math.round(v) : String(v)}</span>
                      </span>
                    ))}
                  </div>
                </li>
              ) : null}
            </ol>
          </Panel>
          <Panel eyebrow="Warnings" title={`${run.warnings?.length ?? 0} warning${run.warnings?.length === 1 ? "" : "s"}`} flush>
            {run.warnings && run.warnings.length > 0 ? (
              <ul className="divide-y divide-line">
                {run.warnings.map((w, i) => (
                  <li key={i} className="px-5 py-2 text-[12px] text-notice">
                    {w}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-5 text-[12.5px] text-fg-4">None.</div>
            )}
          </Panel>
        </div>

        <Panel eyebrow="Clinical review" title="History" className="col-span-3" flush>
          {reviews.length === 0 ? (
            <div className="p-5 text-[12.5px] text-fg-4">No review recorded.</div>
          ) : (
            <ol className="divide-y divide-line">
              {reviews.map((r) => (
                <li key={r.id} className="px-5 py-2.5 text-[12.5px]">
                  <div className="flex items-center justify-between gap-2">
                    <Chip tone={r.decision === "accepted" ? "signal" : r.decision === "note" ? "muted" : "neutral"}>{r.decision.replace("_", " ")}</Chip>
                    <span className="t-mono text-[11px] text-fg-4">{formatDateTime(r.createdAt)}</span>
                  </div>
                  <div className="mt-1 text-fg-2">{r.reviewerLabel}</div>
                  {r.note ? <div className="mt-1 text-[12px] leading-snug text-fg-3">{r.note}</div> : null}
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      {sample.subjectPseudonym ? <PreviousRuns subject={sample.subjectPseudonym} current={d} previous={previousRunsForSubject} /> : null}
    </div>
  );
}

function ImageBox({ url, alt }: { url: string | null; alt: string }) {
  return (
    <div className="flex min-h-[200px] items-center justify-center overflow-hidden bg-ink-0">
      {url ? (
         
        <img src={url} alt={alt} className="max-h-[260px] w-full object-contain" />
      ) : (
        <span className="t-eyebrow">not available</span>
      )}
    </div>
  );
}

function PreviousRuns({ subject, current, previous }: { subject: string; current: RunDetail; previous: RunDetail["previousRunsForSubject"] }) {
  const all = [...previous.map((p) => ({ run: p.run, results: p.results })), { run: current.run, results: current.results }].sort((a, b) => new Date(a.run.createdAt).getTime() - new Date(b.run.createdAt).getTime());
  const keys = current.stripProduct.padMap.filter(isAnalyteKey);
  const charts = keys
    .map((key) => {
      const pts = all.map((r, i) => {
        const res = r.results.find((x) => x.analyteKey === key);
        const show = res && RESULT_STATE_META[res.state as ResultState]?.showsValue && res.value !== null;
        return { x: i, y: show ? res!.value : null, state: res?.state as ResultState | undefined, synthetic: r.run.synthetic || res?.state === "synthetic", label: r.run.runCode };
      });
      return { key, pts, has: pts.some((p) => p.y !== null) };
    })
    .filter((c) => c.has);

  return (
    <Panel eyebrow="Same subject" title={`Previous runs · ${subject}`} description={`${all.length} run${all.length === 1 ? "" : "s"} for this pseudonym. Points are plotted only where a value was reported; hollow markers are synthetic.`}>
      {charts.length === 0 ? (
        <div className="text-[12.5px] text-fg-4">No reported values across this subject&apos;s runs yet.</div>
      ) : (
        <div className="grid grid-cols-5 gap-3">
          {charts.map((c) => {
            const def = ANALYTE_BY_KEY[c.key];
            return (
              <ChartFrame key={c.key} eyebrow={def.short} title={def.label} meta={def.unit}>
                <LineChart width={240} height={100} series={[{ id: c.key, label: def.label, tone: "signal", points: c.pts }]} xTicks={c.pts.length > 1 ? [{ x: 0, label: c.pts[0].label }, { x: c.pts.length - 1, label: "now" }] : [{ x: 0, label: "now" }]} yFormat={(v) => v.toFixed(def.decimals)} />
              </ChartFrame>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
