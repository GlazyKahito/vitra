import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import type { AuditEvent } from "@/lib/data/contract";
import { formatDateTime, formatRelative } from "@/lib/utils";

const ENTITY_HREF: Record<string, (id: string) => string> = {
  run: (id) => `/analysis/${id}`,
  analysis_run: (id) => `/analysis/${id}`,
  sample: (id) => `/samples/${id}`,
  calibration_model: (id) => `/calibration/models/${id}`,
};

export function ActivityFeed({ events }: { events: AuditEvent[] }) {
  return (
    <Panel eyebrow="Audit trail" title="Recent activity" flush>
      {events.length === 0 ? (
        <div className="p-5 text-[12.5px] text-fg-3">No activity yet.</div>
      ) : (
        <ol className="divide-y divide-line">
          {events.map((e) => {
            const href = ENTITY_HREF[e.entityType]?.(e.entityId);
            return (
              <li key={e.id} className="flex items-start gap-3 px-5 py-2.5">
                <span className="t-mono mt-0.5 w-14 shrink-0 text-[10.5px] text-fg-4" title={formatDateTime(e.createdAt, { seconds: true })}>
                  {formatRelative(e.createdAt)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="t-mono text-[11.5px] text-signal">{e.action}</span>
                    <span className="truncate text-[12px] text-fg-3">by {e.actorLabel}</span>
                  </div>
                  <div className="t-mono mt-0.5 truncate text-[11px] text-fg-4">
                    {e.entityType} ·{" "}
                    {href ? (
                      <Link href={href} className="hover:text-signal">
                        {e.entityId}
                      </Link>
                    ) : (
                      e.entityId
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
