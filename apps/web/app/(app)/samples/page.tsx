import Link from "next/link";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { CreateSampleDialog } from "@/components/console/create-sample-dialog";
import { RunStatusChip, SyntheticTag } from "@/components/console/run-status-chip";
import { requireUser, can } from "@/lib/auth";
import { logoutAction } from "@/lib/auth/actions";
import { listSamples, nextSampleCode } from "@/lib/data/samples";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Samples" };

type SP = Record<string, string | string[] | undefined>;

export default async function SamplesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser("runs.read");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const syn = sp.synthetic === "only" || sp.synthetic === "exclude" ? sp.synthetic : "all";
  const [items, suggested] = await Promise.all([listSamples(q || undefined, { synthetic: syn, limit: 500 }), can(user, "samples.manage") ? nextSampleCode() : Promise.resolve("")]);

  return (
    <AppShell user={user} eyebrow="05 / Samples" title="Samples" onLogout={logoutAction} actions={can(user, "samples.manage") ? <CreateSampleDialog suggestedCode={suggested} /> : null}>
      <Panel
        eyebrow="Registry"
        title={`${items.length} sample${items.length === 1 ? "" : "s"}`}
        description="Pseudonymous sample codes. Reference measurements attach to a sample code for calibration."
        flush
        actions={
          <form className="flex items-center gap-2" action="/samples" method="get">
            <input name="q" defaultValue={q} placeholder="Code or pseudonym…" className="h-9 w-56 rounded-[var(--radius-sm)] border border-line-strong bg-ink-1 px-3 font-mono text-[12.5px] text-fg placeholder:text-fg-4 focus:border-signal focus:outline-none" aria-label="Search samples" />
            <select name="synthetic" defaultValue={syn} className="h-9 rounded-[var(--radius-sm)] border border-line-strong bg-ink-1 px-3 text-[12.5px] text-fg" aria-label="Synthetic filter">
              <option value="all">Real + synthetic</option>
              <option value="exclude">Exclude synthetic</option>
              <option value="only">Synthetic only</option>
            </select>
            <button type="submit" className="h-9 rounded-[var(--radius-sm)] border border-line-strong px-3 text-[12.5px] text-fg hover:border-[rgba(255,255,255,0.3)]">
              Search
            </button>
          </form>
        }
      >
        {items.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-1">
            <span className="t-eyebrow">No samples</span>
            <span className="text-[12px] text-fg-4">{q ? "Nothing matches the search." : "Register a sample to start an analysis."}</span>
          </div>
        ) : (
          <table className="table-instrument">
            <thead>
              <tr>
                <th>Code</th>
                <th>Subject pseudonym</th>
                <th>Synthetic</th>
                <th className="text-right">Runs</th>
                <th>Last run</th>
                <th>Last status</th>
                <th className="text-right">References</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ sample, runCount, lastRunAt, lastStatus, referenceCount }) => (
                <tr key={sample.id}>
                  <td>
                    <Link href={`/samples/${sample.id}`} className="t-mono text-[12.5px] text-fg hover:text-signal">
                      {sample.sampleCode}
                    </Link>
                  </td>
                  <td className="t-mono text-[12px]">{sample.subjectPseudonym ?? <span className="text-fg-4">—</span>}</td>
                  <td>{sample.synthetic ? <SyntheticTag /> : <span className="text-fg-4">—</span>}</td>
                  <td className="t-mono text-right">{runCount}</td>
                  <td className="t-mono text-[12px] text-fg-3">{formatDateTime(lastRunAt)}</td>
                  <td>{lastStatus ? <RunStatusChip status={lastStatus} /> : <span className="text-fg-4">—</span>}</td>
                  <td className="t-mono text-right">{referenceCount}</td>
                  <td className="t-mono text-[12px] text-fg-3">{formatDateTime(sample.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </AppShell>
  );
}
