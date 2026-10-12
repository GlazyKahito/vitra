import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { ResultInspector } from "@/components/analysis/result-inspector";
import { RunActions } from "@/components/analysis/run-actions";
import { requireUser, can } from "@/lib/auth";
import { logoutAction } from "@/lib/auth/actions";
import { getRun, getRunByCode } from "@/lib/data/runs";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Run ${id}` };
}

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("runs.read");
  const { id } = await params;
  const run = (await getRun(id)) ?? (id.startsWith("R-") ? await getRunByCode(id) : null);
  if (!run) notFound();

  return (
    <AppShell
      user={user}
      eyebrow="03 / Inspect"
      title={run.run.runCode}
      onLogout={logoutAction}
      actions={
        <Button href="/history" variant="ghost" size="sm">
          History
        </Button>
      }
    >
      <ResultInspector
        run={run}
        actions={
          <RunActions
            runId={run.run.id}
            canGenerate={can(user, "reports.generate")}
            canReview={can(user, "reviews.write") && ["pending_review", "reviewed", "rejected"].includes(run.run.status)}
            existing={run.reports.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((r) => ({ id: r.id, format: r.format }))}
          />
        }
      />
    </AppShell>
  );
}
