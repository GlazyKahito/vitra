import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { requireUser, can } from "@/lib/auth";
import { logoutAction } from "@/lib/auth/actions";
import { listReports } from "@/lib/data/reports";
import { listRuns } from "@/lib/data/runs";
import { getSettings } from "@/lib/data/settings";
import { PrototypeBanner } from "@/components/common/prototype-banner";
import { ReportsTable } from "@/components/reports/reports-table";
import { GenerateReportPanel, type RunOption } from "@/components/reports/generate-report-panel";

export const dynamic = "force-dynamic";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ q?: string; format?: string }> }) {
  const user = await requireUser("reports.read");
  const canGenerate = can(user, "reports.generate");
  const { q = "", format = "all" } = await searchParams;
  const fmt: "pdf" | "json" | "all" = format === "pdf" || format === "json" ? format : "all";

  const [reports, runs, settings] = await Promise.all([listReports({ q: q || undefined, format: fmt }), listRuns({ limit: 50 }), getSettings()]);

  const runOptions: RunOption[] = runs.items.map((r) => ({
    id: r.run.id,
    runCode: r.run.runCode,
    sampleCode: r.sample.sampleCode,
    status: r.run.status,
    mode: r.run.mode,
    synthetic: r.run.synthetic,
    createdAt: r.run.createdAt.toISOString(),
    reviewed: r.latestReview !== null,
  }));

  return (
    <AppShell user={{ displayName: user.displayName, roleKey: user.roleKey }} eyebrow="07 / Reports" title="Reports" onLogout={logoutAction}>
      <div className="flex flex-col gap-6">
        <PrototypeBanner variant="inline" detail="Every generated report carries this banner on each page, the result-state chip for every analyte, and a SYNTHETIC marker when the run, sample or model is synthetic. Reports are research records, not clinical documents." />

        <div className="grid grid-cols-[minmax(0,1fr)_380px] items-start gap-6">
          <Panel
            eyebrow="Generated"
            title={`${reports.length} report${reports.length === 1 ? "" : "s"}`}
            flush
            actions={
              <form method="get" className="flex items-center gap-2">
                <Input name="q" defaultValue={q} placeholder="run / sample code" className="h-8 w-[200px] text-[12.5px]" />
                <span className="w-[120px]">
                  <Select name="format" defaultValue={fmt} className="h-8 text-[12.5px]">
                    <option value="all">All formats</option>
                    <option value="pdf">PDF</option>
                    <option value="json">JSON</option>
                  </Select>
                </span>
                <Button type="submit" variant="secondary" size="sm">
                  Filter
                </Button>
              </form>
            }
          >
            <ReportsTable reports={reports} canDownload={can(user, "reports.read")} />
          </Panel>

          <Panel eyebrow="Generate" title="Generate a report" description={`Recent runs (last ${runOptions.length}). ${settings.requireReviewForReports ? "Clinical review is required before a report can be generated." : "Review is not required before generation (settings)."}`}>
            <GenerateReportPanel runs={runOptions} canGenerate={canGenerate} requireReview={settings.requireReviewForReports} />
          </Panel>
        </div>

        <PrototypeBanner />
      </div>
    </AppShell>
  );
}
