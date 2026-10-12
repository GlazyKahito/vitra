import type { DeviceEvent } from "@/lib/data/contract";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { SyntheticTag } from "@/components/common/synthetic-tag";
import { formatDateTime } from "@/lib/utils";

const LEVEL_TONE: Record<string, ChipTone> = { info: "muted", warn: "notice", error: "fault" };

function payloadSummary(p: Record<string, unknown> | null | undefined): string {
  if (!p) return "";
  const entries = Object.entries(p).slice(0, 5);
  return entries.map(([k, v]) => `${k}=${typeof v === "object" && v !== null ? JSON.stringify(v).slice(0, 40) : String(v)}`).join(" · ");
}

export function EventTimeline({ events, emptyText = "No events recorded." }: { events: DeviceEvent[]; emptyText?: string }) {
  if (events.length === 0) return <p className="px-5 py-6 text-[12.5px] text-fg-4">{emptyText}</p>;
  return (
    <ol className="flex flex-col">
      {events.map((e) => (
        <li key={e.id} className="grid grid-cols-[150px_110px_64px_minmax(0,1fr)] items-start gap-3 border-b border-line px-5 py-2.5 last:border-b-0">
          <span className="t-mono pt-0.5 text-[11.5px] text-fg-4">{formatDateTime(e.createdAt, { seconds: true })}</span>
          <span className="t-mono pt-0.5 text-[11.5px] text-fg-3">{e.kind}</span>
          <Chip tone={LEVEL_TONE[e.level] ?? "neutral"}>{e.level}</Chip>
          <span className="min-w-0">
            <span className="text-[13px] text-fg-2">{e.message}</span>
            <span className="flex flex-wrap items-center gap-2 pt-0.5">
              {e.simulated ? <SyntheticTag variant="simulated" /> : null}
              {e.payload ? <span className="t-mono truncate text-[11px] text-fg-4">{payloadSummary(e.payload)}</span> : null}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
