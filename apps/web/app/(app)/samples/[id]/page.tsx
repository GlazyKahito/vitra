import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { StateChip } from "@/components/ui/state-chip";
import { ChartFrame, LineChart } from "@/components/charts";
import { RunTable } from "@/components/console/run-table";
import { SyntheticTag } from "@/components/console/run-status-chip";
import { ANALYTE_BY_KEY, formatAnalyteValue, isAnalyteKey } from "@/lib/analytes";
import { requireUser, can } from "@/lib/auth";
import { logoutAction } from "@/lib/auth/actions";
import { getSample } from "@/lib/data/samples";
import { RESULT_STATE_META, type ResultState } from "@/lib/inference/policy";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Sample ${id}` };
}

export default async function SamplePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("runs.read");
  const { id } = await params;
  const detail = await getSample(id);
  if (!detail) notFound();
  const { sample, runs, references, trend } = detail;

  const trendWithValues = trend.filter((t) => t.points.some((p) => p.value !== null));
  const lastTwo = runs.slice(0, 2);
  const metadataEntries = Object.entries(sample.metadata ?? {});

  return (
    <AppShell
      user={user}
      eyebrow="05 / Sample"
      title={sample.sampleCode}
      onLogout={logoutAction}
      actions={
        <>
          <Button href="/samples" variant="ghost" size="sm">
            All samples
          </Button>
          {can(user, "runs.create") ? (
            <Button href="/analysis/new" size="sm">
              New analysis
            </Button>
          ) : null}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-12 gap-4">
          <Panel eyebrow="Sample" title="Identity" className="col-span-4" flush>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 px-5 py-4 text-[12.5px]">
              <dt className="text-fg-4">Code</dt>
              <dd className="t-mono text-fg">
                {sample.sampleCode}
                {sample.synthetic ? <SyntheticTag className="ml-2" /> : null}
              </dd>
              <dt className="text-fg-4">Subject</dt>
              <dd className="t-mono text-fg-2">{sample.subjectPseudonym ?? "—"}</dd>
              <dt className="text-fg-4">Created</dt>
              <dd className="t-mono text-fg-2">{formatDateTime(sample.createdAt)}</dd>
              <dt className="text-fg-4">Runs</dt>
              <dd className="t-mono text-fg-2">{runs.length}</dd>
              {metadataEntries.map(([k, v]) => (
                <Fragment2 key={k} k={k} v={typeof v === "string" ? v : JSON.stringify(v)} />
              ))}
            </dl>
          </Panel>

          <Panel eyebrow="Reference measurements" title={`${references.length} measurement${references.length === 1 ? "" : "s"}`} description="Laboratory or chart references attached to this sample code; these are calibration targets, not VITRA results." className="col-span-8" flush>
            {references.length === 0 ? (
              <div className="p-5 text-[12.5px] text-fg-4">No reference measurements for this sample.</div>
            ) : (
              <table className="table-instrument">
                <thead>
                  <tr>
                    <th>Analyte</th>
                    <th className="text-right">Value</th>
                    <th>Unit</th>
                    <th>Method</th>
                    <th>Measured</th>
                    <th>Synthetic</th>
                  </tr>
                </thead>
                <tbody>
                  {references.map((r) => (
                    <tr key={r.id}>
                      <td className="text-fg">{isAnalyteKey(r.analyteKey) ? ANALYTE_BY_KEY[r.analyteKey].label : r.analyteKey}</td>
                      <td className="t-mono text-right text-fg">{isAnalyteKey(r.analyteKey) ? formatAnalyteValue(r.analyteKey, r.value) : r.value}</td>
                      <td className="t-mono text-[12px] text-fg-3">{r.unit}</td>
                      <td className="text-[12px]">{r.method.replace("_", " ")}</td>
                      <td className="t-mono text-[12px] text-fg-3">{formatDateTime(r.measuredAt)}</td>
                      <td>{r.synthetic ? <SyntheticTag /> : <span className="text-fg-4">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <Panel eyebrow="Trends" title="Per-analyte values over runs" description="State-aware points: filled = model value, hollow = synthetic demo value, square = experimental estimate. Gaps are runs where no value could be reported.">
          {trendWithValues.length === 0 ? (
            <div className="text-[12.5px] text-fg-4">No reported values yet for this sample.</div>
          ) : (
            <div className="grid grid-cols-5 gap-3">
              {trendWithValues.map((t) => {
                const def = isAnalyteKey(t.analyteKey) ? ANALYTE_BY_KEY[t.analyteKey] : null;
                const pts = t.points.map((p, i) => ({ x: i, y: p.value, state: p.state, synthetic: p.state === "synthetic", label: p.runCode }));
                return (
                  <ChartFrame key={t.analyteKey} eyebrow={def?.short ?? t.analyteKey} title={def?.label ?? t.analyteKey} meta={t.unit}>
                    <LineChart width={240} height={110} series={[{ id: t.analyteKey, label: def?.label, tone: "signal", points: pts }]} xTicks={pts.length > 1 ? [{ x: 0, label: pts[0].label }, { x: pts.length - 1, label: pts[pts.length - 1].label }] : [{ x: 0, label: pts[0]?.label ?? "" }]} yFormat={(v) => (def ? v.toFixed(def.decimals) : String(v))} />
                  </ChartFrame>
                );
              })}
            </div>
          )}
        </Panel>

        {lastTwo.length === 2 ? (
          <Panel eyebrow="Comparison" title="Last two runs" description="Side by side per analyte. Differences between non-validated estimates are not clinically meaningful." flush>
            <table className="table-instrument">
              <thead>
                <tr>
                  <th>Analyte</th>
                  {lastTwo.map((r) => (
                    <th key={r.run.id}>
                      <Link href={`/analysis/${r.run.id}`} className="hover:text-signal">
                        {r.run.runCode}
                      </Link>
                      <span className="ml-2 normal-case tracking-normal text-fg-4">{formatDateTime(r.run.createdAt)}</span>
                      {r.run.synthetic ? <SyntheticTag className="ml-2" /> : null}
                    </th>
                  ))}
                  <th className="text-right">Δ</th>
                </tr>
              </thead>
              <tbody>
                {(isAnalyteKey(lastTwo[0].stripProduct.padMap[0] ?? "") ? lastTwo[0].stripProduct.padMap : Object.keys(ANALYTE_BY_KEY)).filter(isAnalyteKey).map((key) => {
                  const def = ANALYTE_BY_KEY[key];
                  const cells = lastTwo.map((r) => r.resultSummary.find((s) => s.analyteKey === key) ?? null);
                  const vals = cells.map((c) => (c && RESULT_STATE_META[c.state as ResultState]?.showsValue && c.value !== null ? c.value : null));
                  const delta = vals[0] !== null && vals[1] !== null ? vals[0] - vals[1] : null;
                  return (
                    <tr key={key}>
                      <td className="text-fg">{def.label}</td>
                      {cells.map((c, i) => (
                        <td key={i}>
                          <span className="flex items-center gap-2">
                            {c ? <StateChip state={c.state as ResultState} /> : <span className="text-fg-4">—</span>}
                            {vals[i] !== null ? (
                              <span className="t-mono text-fg">
                                {formatAnalyteValue(key, vals[i])} <span className="text-fg-4">{def.unit}</span>
                              </span>
                            ) : null}
                          </span>
                        </td>
                      ))}
                      <td className="t-mono text-right text-fg-3">{delta === null || def.kind === "qualitative" ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(def.decimals)}`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        ) : null}

        <Panel eyebrow="Runs" title={`${runs.length} run${runs.length === 1 ? "" : "s"}`} flush>
          <RunTable items={runs} showQuality emptyMessage="No runs for this sample yet." />
        </Panel>
      </div>
    </AppShell>
  );
}

function Fragment2({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-fg-4">{k}</dt>
      <dd className="truncate text-fg-2" title={v}>
        {v}
      </dd>
    </>
  );
}
