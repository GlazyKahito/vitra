import Link from "next/link";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { RunFilters } from "@/components/console/run-filters";
import { RunTable } from "@/components/console/run-table";
import { parseRunFilter, type SearchParams } from "@/components/console/filter-params";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/lib/auth/actions";
import { listRuns } from "@/lib/data/runs";
import { listStripProducts } from "@/lib/data/strips";

export const dynamic = "force-dynamic";
export const metadata = { title: "History" };

const PAGE_SIZE = 25;

function withParams(sp: SearchParams, patch: Record<string, string | null>): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s) next.set(k, s);
  }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) next.delete(k);
    else next.set(k, v);
  }
  const qs = next.toString();
  return qs ? `?${qs}` : "";
}

export default async function HistoryPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser("runs.read");
  const sp = await searchParams;
  const filter = parseRunFilter(sp, { limit: PAGE_SIZE });
  const [runs, products] = await Promise.all([listRuns(filter), listStripProducts()]);
  const pages = Math.max(1, Math.ceil(runs.total / PAGE_SIZE));
  const exportHref = `/history/export${withParams(sp, { page: null })}`;

  return (
    <AppShell
      user={user}
      eyebrow="04 / History"
      title="Analysis history"
      onLogout={logoutAction}
      actions={
        <>
          <Button href={exportHref} variant="secondary" size="sm">
            Export CSV
          </Button>
          <Button href="/analysis/new" size="sm">
            New analysis
          </Button>
        </>
      }
    >
      <Panel
        eyebrow="Runs"
        title={`${runs.total} run${runs.total === 1 ? "" : "s"}`}
        description="Every analysis run, filterable. The CSV export respects the active filter."
        flush
        footer={
          <div className="flex items-center justify-between">
            <span>
              Page {filter.page} of {pages} · {PAGE_SIZE} per page
            </span>
            <span className="flex items-center gap-3">
              {filter.page > 1 ? (
                <Link href={`/history${withParams(sp, { page: String(filter.page - 1) })}`} className="hover:text-signal">
                  ← Previous
                </Link>
              ) : (
                <span className="text-fg-4">← Previous</span>
              )}
              {filter.page < pages ? (
                <Link href={`/history${withParams(sp, { page: String(filter.page + 1) })}`} className="hover:text-signal">
                  Next →
                </Link>
              ) : (
                <span className="text-fg-4">Next →</span>
              )}
            </span>
          </div>
        }
      >
        <div className="border-b border-line px-5 py-3">
          <Suspense fallback={null}>
            <RunFilters extended stripProducts={products.map((p) => ({ id: p.id, name: `${p.manufacturer} ${p.name}` }))} />
          </Suspense>
        </div>
        <RunTable items={runs.items} showQuality />
      </Panel>
    </AppShell>
  );
}
