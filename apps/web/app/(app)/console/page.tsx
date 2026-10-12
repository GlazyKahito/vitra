import Link from "next/link";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { BarChart, ChartFrame, DonutStatus, type DonutSlice } from "@/components/charts";
import { StatBand } from "@/components/console/stat-band";
import { CalibrationPanel, DevicesPanel, ModelVersionsPanel, QualityFailuresPanel } from "@/components/console/side-panels";
import { AnalyteMultiples } from "@/components/console/analyte-multiples";
import { ActivityFeed } from "@/components/console/activity-feed";
import { RunFilters } from "@/components/console/run-filters";
import { RunTable } from "@/components/console/run-table";
import { RUN_STATUS_META } from "@/components/console/run-status-chip";
import { parseRunFilter, type SearchParams } from "@/components/console/filter-params";
import { requireUser, can } from "@/lib/auth";
import { logoutAction } from "@/lib/auth/actions";
import { getConsoleStats, getRecentActivity, listRuns } from "@/lib/data/runs";
import { getCalibrationStatus, listModels } from "@/lib/data/calibration";
import { listDevices } from "@/lib/data/devices";
import { getSettings } from "@/lib/data/settings";

export const dynamic = "force-dynamic";

export const metadata = { title: "Console" };

const STATUS_TONE: Record<string, DonutSlice["tone"]> = {
  reviewed: "signal",
  pending_review: "notice",
  calibration_required: "neutral",
  rejected: "muted",
  invalid_image: "fault",
  failed: "fault",
  queued: "muted",
  processing: "signal",
};

export default async function ConsolePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser("runs.read");
  const sp = await searchParams;
  const filter = parseRunFilter(sp, { limit: 12 });

  const [stats, runs, calibration, devices, models, activity, settings] = await Promise.all([
    getConsoleStats(),
    listRuns(filter),
    getCalibrationStatus(),
    listDevices(),
    listModels(),
    getRecentActivity(12),
    getSettings(),
  ]);

  const calStatus = calibration.find((c) => c.stripProductId === settings.defaultStripProductId) ?? calibration[0] ?? null;
  const recalDue = calibration.flatMap((c) => c.perAnalyte.filter((a) => a.recalibrationDue || a.status === "synthetic_only"));
  const staleCount = recalDue.filter((a) => a.recalibrationDue).length;
  const synthOnlyCount = recalDue.filter((a) => a.status === "synthetic_only").length;

  const statusSlices: DonutSlice[] = Object.entries(stats.byStatus)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([status, n]) => ({ label: RUN_STATUS_META[status]?.label ?? status, value: n, tone: STATUS_TONE[status] ?? "neutral" }));

  const perDay = stats.runsPerDay.map((d) => ({
    label: d.date.slice(5),
    value: d.count,
    overlay: d.invalid,
    title: `${d.date}: ${d.count} runs, ${d.invalid} invalid`,
  }));

  return (
    <AppShell
      user={user}
      eyebrow="01 / Console"
      title="Analysis console"
      onLogout={logoutAction}
      actions={
        <>
          <Button href="/history" variant="ghost" size="sm">
            Full history
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
        {recalDue.length > 0 ? (
          <div className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-[rgba(232,181,90,0.35)] bg-notice-dim px-4 py-3 text-[13px] text-fg-2" role="status">
            <span className="t-mono mt-0.5 text-[10.5px] uppercase tracking-[0.12em] text-notice">Recalibration</span>
            <div>
              {staleCount > 0 ? <span>{staleCount} model{staleCount === 1 ? "" : "s"} older than the {settings.recalibrationIntervalDays}-day recalibration interval. </span> : null}
              {synthOnlyCount > 0 ? <span>{synthOnlyCount} analyte{synthOnlyCount === 1 ? "" : "s"} only have a synthetic-data model and cannot report values in research mode. </span> : null}
              <Link href="/calibration" className="text-notice underline-offset-2 hover:underline">
                Open calibration
              </Link>
            </div>
          </div>
        ) : null}

        <StatBand stats={stats} />

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-8 flex flex-col gap-4">
            <Panel eyebrow="Throughput" title="Runs per day" description="Last 14 days. Invalid-image runs are overlaid in amber.">
              <div className="grid grid-cols-12 gap-6">
                <div className="col-span-8">
                  <ChartFrame
                    legend={[
                      { label: "runs", tone: "signal", kind: "block" },
                      { label: "invalid image", tone: "notice", kind: "block" },
                    ]}
                    meta="14 D"
                  >
                    <BarChart data={perDay} width={560} height={190} ariaLabel="Runs per day for the last 14 days" emptyMessage="No runs in the last 14 days" />
                  </ChartFrame>
                </div>
                <div className="col-span-4 border-l border-line pl-6">
                  <div className="t-eyebrow mb-3">Status distribution</div>
                  <DonutStatus slices={statusSlices} size={120} />
                </div>
              </div>
            </Panel>
            <AnalyteMultiples series={stats.analyteValueSeries} />
          </div>

          <div className="col-span-4 flex flex-col gap-4">
            <CalibrationPanel status={calStatus} intervalDays={settings.recalibrationIntervalDays} />
            <ModelVersionsPanel models={models} />
            <DevicesPanel devices={devices} />
            <QualityFailuresPanel failures={stats.recentQualityFailures} />
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-9">
            <Panel
              eyebrow="Runs"
              title={`${runs.total} run${runs.total === 1 ? "" : "s"}`}
              description="Most recent first. Synthetic runs carry the SYNTHETIC tag."
              flush
              actions={
                <Suspense fallback={null}>
                  <RunFilters />
                </Suspense>
              }
              footer={
                runs.total > filter.limit! ? (
                  <Link href="/history" className="hover:text-signal">
                    Showing {Math.min(filter.limit!, runs.items.length)} of {runs.total} — open full history →
                  </Link>
                ) : undefined
              }
            >
              <RunTable items={runs.items} />
            </Panel>
          </div>
          <div className="col-span-3">
            <ActivityFeed events={activity} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}
