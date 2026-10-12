import { Sparkline } from "@/components/charts";
import type { ConsoleStats } from "@/lib/data/contract";
import { pct } from "@/lib/utils";

interface Stat {
  label: string;
  value: string;
  caption?: string;
  spark?: number[];
  tone?: "default" | "notice" | "fault";
}

export function StatBand({ stats }: { stats: ConsoleStats }) {
  const perDay = stats.runsPerDay.map((d) => d.count);
  const items: Stat[] = [
    { label: "Total runs", value: String(stats.totalRuns), caption: "all time" },
    { label: "Last 7 d", value: String(stats.runsLast7d), caption: `${stats.reviewedLast7d} reviewed`, spark: perDay.slice(-7) },
    { label: "Pending review", value: String(stats.pendingReview), caption: "awaiting decision", tone: stats.pendingReview > 0 ? "notice" : "default" },
    { label: "Quality failures 30 d", value: String(stats.qualityFailuresLast30), caption: "invalid images", tone: stats.qualityFailuresLast30 > 0 ? "fault" : "default" },
    { label: "Synthetic share", value: `${pct(stats.syntheticRuns, stats.totalRuns)}%`, caption: `${stats.syntheticRuns} synthetic runs` },
  ];
  return (
    <div className="panel grid grid-cols-5 divide-x divide-line">
      {items.map((s) => (
        <div key={s.label} className="flex flex-col gap-2 px-5 py-4">
          <div className="t-eyebrow">{s.label}</div>
          <div className="flex items-end justify-between gap-3">
            <div className={"t-mono text-[28px] leading-none tracking-[-0.02em] " + (s.tone === "notice" ? "text-notice" : s.tone === "fault" ? "text-fault" : "text-fg")}>{s.value}</div>
            {s.spark ? <Sparkline values={s.spark} width={72} height={22} tone="neutral" ariaLabel="Runs per day, last 7 days" /> : null}
          </div>
          {s.caption ? <div className="text-[11.5px] text-fg-4">{s.caption}</div> : null}
        </div>
      ))}
    </div>
  );
}
