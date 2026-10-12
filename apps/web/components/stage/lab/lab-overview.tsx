import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { Chapter, ChapterCopy, ChapterHeadline } from "@/components/landing/chapter";
import { cn } from "@/lib/utils";
import { getLabSnapshot, type CalState, type LabSnapshot } from "./lab-data";
import { CountUp, GrowSegment, RiseIn } from "./lab-motion";

/* ───────────────────────── palette for marks ─────────────────────────
   cyan = data marks; gold/champagne = accent; platinum/ivory = neutral;
   fault red ONLY for image / pipeline faults. No "normal/abnormal" colours. */
const STATUS: Record<string, { label: string; color: string; text: string }> = {
  reviewed: { label: "Reviewed", color: "#5fd4e6", text: "text-[#5fd4e6]" },
  pending_review: { label: "Awaiting review", color: "var(--lux-gold)", text: "text-[var(--lux-gold)]" },
  calibration_required: { label: "Calibration required", color: "rgba(191,193,194,0.62)", text: "text-[var(--lux-platinum)]" },
  rejected: { label: "Rejected / repeat", color: "rgba(191,193,194,0.3)", text: "text-[var(--lux-platinum)]/70" },
  processing: { label: "Processing", color: "rgba(95,212,230,0.45)", text: "text-[#5fd4e6]/80" },
  queued: { label: "Queued", color: "rgba(242,235,221,0.16)", text: "text-[var(--lux-ivory)]/60" },
  invalid_image: { label: "Invalid image", color: "var(--color-fault)", text: "text-fault" },
  failed: { label: "Pipeline failed", color: "rgba(224,108,108,0.6)", text: "text-fault" },
};

const CAL: Record<CalState, { label: string; note: string }> = {
  synthetic_only: { label: "Synthetic-trained", note: "Model fitted on synthetic data — demo values only" },
  experimental: { label: "Experimental", note: "Fitted on reference data, not validated" },
  validated: { label: "Validated", note: "Marked validated by an admin with written evidence" },
  none: { label: "Calibration required", note: "No model — the analyte reports “calibration required”" },
};

const TZ_FMT = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
const STAMP_FMT = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
const fmt = (iso: string) => TZ_FMT.format(new Date(iso));

/* ───────────────────────── chapter wrapper ───────────────────────── */

export interface LabOverviewProps {
  /** Scene number on the chapter slate. */
  index?: string;
  label?: string;
  id?: string;
}

/**
 * "The lab, right now" — a live instrument readout of this instance's database. The chapter frame
 * renders immediately; the readout streams in behind a skeleton (it awaits `connection()`, so it is
 * never baked at build time).
 */
export function LabOverview({ index = "07", label = "The lab, right now", id = "lab" }: LabOverviewProps) {
  return (
    <Chapter index={index} label={label} id={id}>
      <div className="pb-28 pt-20">
        <div className="grid grid-cols-[1.25fr_1fr] items-end gap-16">
          <ChapterHeadline size="text-[100px]" className="max-w-[11ch]">
            {"The lab, *right now.*"}
          </ChapterHeadline>
          <ChapterCopy className="pb-3">
            Not a mock-up. Every figure below is counted from this instance&rsquo;s database when the page loads. The seeded records are synthetic &mdash; they
            exist so every screen has something honest to show, and they are labelled that way everywhere.
          </ChapterCopy>
        </div>
        <div className="mt-16">
          <Suspense fallback={<LabReadoutSkeleton />}>
            <LabReadout />
          </Suspense>
        </div>
      </div>
    </Chapter>
  );
}

/* ───────────────────────── readout (async server) ───────────────────────── */

export async function LabReadout() {
  await connection();
  let snap: LabSnapshot | null = null;
  try {
    snap = await getLabSnapshot();
  } catch (err) {
    console.error("[lab-overview] snapshot failed:", err);
  }
  if (!snap) return <LabUnavailable />;
  return <ReadoutView snap={snap} />;
}

function SyntheticTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-2 rounded-[3px] border border-dashed border-[rgb(var(--lc-gold-rgb)/0.7)] px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--lux-champagne)]",
        className,
      )}
      title="All seeded samples, runs, models and devices are synthetic demo records."
    >
      <span className="size-1.5 rounded-full bg-[var(--lux-gold)]" aria-hidden />
      Synthetic demo data
    </span>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--lux-platinum)]/75", className)}>{children}</div>;
}

function ReadoutView({ snap }: { snap: LabSnapshot }) {
  const statusTotal = snap.runs.byStatus.reduce((s, r) => s + r.count, 0);
  const presentStatuses = snap.runs.byStatus.filter((r) => r.count > 0);
  const simulated = snap.devices.filter((d) => d.simulated).length;
  const real = snap.devices.length - simulated;
  const calCounts = (["synthetic_only", "experimental", "validated", "none"] as CalState[]).map((s) => ({
    state: s,
    n: snap.calibration.perAnalyte.filter((a) => a.state === s).length,
  }));

  return (
    <div className="glass overflow-hidden p-0" role="region" aria-label="Live lab readout">
      {/* ── header strip ── */}
      <div className="flex items-center gap-5 border-b border-[rgb(var(--lc-ivory-rgb)/0.1)] px-7 py-3.5">
        <span className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--lux-ivory)]">
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inset-0 animate-ping rounded-full bg-[#5fd4e6]/50 motion-reduce:hidden" />
            <span className="relative size-2 rounded-full bg-[#5fd4e6]" />
          </span>
          Lab readout
        </span>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--lux-platinum)]/60">read from database · per request</span>
        <span className="ml-auto font-mono text-[10.5px] tabular-nums tracking-[0.12em] text-[var(--lux-platinum)]/70">
          {STAMP_FMT.format(new Date(snap.takenAt))} IST
        </span>
        <SyntheticTag />
      </div>

      {/* ── primary readings ── */}
      <dl className="grid grid-cols-4 divide-x divide-[rgb(var(--lc-ivory-rgb)/0.1)] border-b border-[rgb(var(--lc-ivory-rgb)/0.1)]">
        <Reading
          index={0}
          label="Samples registered"
          value={snap.samples.total}
          prefix={snap.samples.capped ? "≥" : undefined}
          sub={`${snap.samples.synthetic} of ${snap.samples.total} marked synthetic`}
        />
        <Reading index={1} label="Analysis runs" value={snap.runs.total} sub={`${snap.runs.last7d} in the last 7 days · ${snap.runs.synthetic} synthetic`} />
        <Reading
          index={2}
          label="Awaiting clinical review"
          value={snap.review.pending}
          tone="gold"
          sub={`${snap.review.reviewedLast7d} review decision${snap.review.reviewedLast7d === 1 ? "" : "s"} in 7 days`}
        />
        <Reading
          index={3}
          label="Image-quality failures · 30 d"
          value={snap.quality.failuresLast30}
          tone={snap.quality.failuresLast30 > 0 ? "fault" : undefined}
          sub="runs whose capture failed quality checks"
        />
      </dl>

      {/* ── distribution + calibration ── */}
      <div className="grid grid-cols-12 divide-x divide-[rgb(var(--lc-ivory-rgb)/0.1)] border-b border-[rgb(var(--lc-ivory-rgb)/0.1)]">
        <section className="col-span-7 px-7 py-6" aria-labelledby="lab-dist">
          <div className="flex items-baseline justify-between">
            <Label>
              <span id="lab-dist">Runs by status</span>
            </Label>
            <span className="font-mono text-[10.5px] tabular-nums tracking-[0.12em] text-[var(--lux-platinum)]/60">n = {statusTotal}</span>
          </div>
          {statusTotal === 0 ? (
            <p className="mt-6 text-[13px] text-[var(--lux-platinum)]/70">No runs stored yet. Start one from New analysis.</p>
          ) : (
            <>
              <div className="mt-4 flex h-3 w-full gap-px overflow-hidden rounded-[2px] bg-[rgb(var(--lc-ivory-rgb)/0.05)]" role="img" aria-label={presentStatuses.map((r) => `${STATUS[r.status]?.label ?? r.status}: ${r.count}`).join(", ")}>
                {presentStatuses.map((r, i) => (
                  <GrowSegment
                    key={r.status}
                    pct={(r.count / statusTotal) * 100}
                    delay={0.15 + i * 0.08}
                    style={{ background: STATUS[r.status]?.color ?? "rgba(242,235,221,0.2)" }}
                    title={`${STATUS[r.status]?.label ?? r.status}: ${r.count}`}
                  />
                ))}
              </div>
              {/* scale ticks */}
              <div className="mt-1.5 flex justify-between font-mono text-[9.5px] tabular-nums text-[var(--lux-platinum)]/40" aria-hidden>
                {[0, 25, 50, 75, 100].map((t) => (
                  <span key={t}>{t}%</span>
                ))}
              </div>
              <table className="mt-5 w-full text-[12.5px]">
                <caption className="sr-only">Analysis runs by lifecycle status</caption>
                <tbody>
                  {snap.runs.byStatus.map((r) => {
                    const meta = STATUS[r.status] ?? { label: r.status, color: "#888", text: "" };
                    const pct = statusTotal ? (r.count / statusTotal) * 100 : 0;
                    return (
                      <tr key={r.status} className={cn("border-t border-[rgb(var(--lc-ivory-rgb)/0.07)]", r.count === 0 && "opacity-40")}>
                        <td className="py-[7px] pr-3">
                          <span className="inline-flex items-center gap-2.5">
                            <span className="h-2 w-3.5 rounded-[1px]" style={{ background: meta.color }} aria-hidden />
                            <span className="text-[var(--lux-ivory)]/85">{meta.label}</span>
                          </span>
                        </td>
                        <td className="py-[7px] pr-3 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--lux-platinum)]/45">{r.status}</td>
                        <td className={cn("py-[7px] pr-4 text-right font-mono tabular-nums", meta.text)}>{r.count}</td>
                        <td className="w-[64px] py-[7px] text-right font-mono tabular-nums text-[var(--lux-platinum)]/60">{pct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </section>

        <section className="col-span-5 px-7 py-6" aria-labelledby="lab-cal">
          <div className="flex items-baseline justify-between gap-4">
            <Label>
              <span id="lab-cal">Calibration · per analyte</span>
            </Label>
            <span className="truncate font-mono text-[10.5px] tracking-[0.1em] text-[var(--lux-platinum)]/60">{snap.calibration.productName ?? "no strip product"}</span>
          </div>
          {/* ten pads, left to right as on the strip */}
          <ol className="mt-4 grid grid-cols-10 gap-1.5" aria-label="Calibration state of each analyte">
            {snap.calibration.perAnalyte.map((a) => (
              <li key={a.key} className="flex flex-col items-center gap-1.5" title={`${a.label}: ${CAL[a.state].label}${a.ageDays !== null ? ` · ${a.ageDays} d old` : ""}${a.recalibrationDue ? " · recalibration due" : ""}`}>
                <CalPad state={a.state} due={a.recalibrationDue} />
                <span className="font-mono text-[9.5px] tracking-[0.06em] text-[var(--lux-platinum)]/70">{a.short}</span>
              </li>
            ))}
          </ol>
          <dl className="mt-5 grid grid-cols-2 gap-x-6">
            {calCounts.map(({ state, n }) => (
              <div key={state} className="flex items-center justify-between border-t border-[rgb(var(--lc-ivory-rgb)/0.07)] py-2" title={CAL[state].note}>
                <dt className="flex items-center gap-2 text-[12.5px] text-[var(--lux-ivory)]/85">
                  <CalPad state={state} small />
                  {CAL[state].label}
                </dt>
                <dd className="font-mono tabular-nums text-[var(--lux-ivory)]">{n}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex items-baseline gap-3 border-t border-[rgb(var(--lc-ivory-rgb)/0.1)] pt-4">
            <span className="font-display text-[34px] font-light leading-none tabular-nums text-[var(--lux-ivory)]">
              <CountUp value={snap.calibration.models.active} />
            </span>
            <span className="text-[12.5px] leading-snug text-[var(--lux-platinum)]/75">
              active calibration models · {snap.calibration.models.syntheticTrained} synthetic-trained, {snap.calibration.models.experimental} experimental,{" "}
              {snap.calibration.models.validated} validated
            </span>
          </div>
        </section>
      </div>

      {/* ── latest runs + devices/faults ── */}
      <div className="grid grid-cols-12 divide-x divide-[rgb(var(--lc-ivory-rgb)/0.1)]">
        <section className="col-span-8 py-5" aria-labelledby="lab-latest">
          <div className="flex items-baseline justify-between px-7">
            <Label>
              <span id="lab-latest">Latest runs</span>
            </Label>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--lux-platinum)]/50">sign-in required to open</span>
          </div>
          {snap.latest.length === 0 ? (
            <p className="px-7 pt-5 text-[13px] text-[var(--lux-platinum)]/70">No runs yet.</p>
          ) : (
            <table className="mt-3 w-full text-[12.5px]">
              <thead>
                <tr className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-[var(--lux-platinum)]/55">
                  <th scope="col" className="py-2 pl-7 pr-3 text-left font-normal">Run</th>
                  <th scope="col" className="py-2 pr-3 text-left font-normal">Sample</th>
                  <th scope="col" className="py-2 pr-3 text-left font-normal">Created (IST)</th>
                  <th scope="col" className="py-2 pr-3 text-left font-normal">Status</th>
                  <th scope="col" className="py-2 pr-3 text-left font-normal">Image quality</th>
                  <th scope="col" className="py-2 pr-7 text-right font-normal">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {snap.latest.map((r) => (
                  <tr key={r.id} className="group border-t border-[rgb(var(--lc-ivory-rgb)/0.07)] transition-colors hover:bg-[rgb(var(--lc-ivory-rgb)/0.03)]">
                    <td className="py-2.5 pl-7 pr-3">
                      <Link href={`/analysis/${r.id}`} className="font-mono text-[12.5px] text-[var(--lux-ivory)] underline-offset-4 hover:text-[var(--lux-champagne)] hover:underline">
                        {r.runCode}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="font-mono text-[12px] text-[var(--lux-ivory)]/75">{r.sampleCode}</span>
                      {r.synthetic ? <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--lux-gold)]/80">syn</span> : null}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-[11.5px] tabular-nums text-[var(--lux-platinum)]/75">{fmt(r.at)}</td>
                    <td className="py-2.5 pr-3">
                      <StatusChip status={r.status} />
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-[11px] uppercase tracking-[0.1em]">
                      {r.qualityPassed === null ? (
                        <span className="text-[var(--lux-platinum)]/40">—</span>
                      ) : r.qualityPassed ? (
                        <span className="text-[var(--lux-platinum)]/80">passed</span>
                      ) : (
                        <span className="text-fault">failed</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-7 text-right">
                      <Link
                        href={`/analysis/${r.id}`}
                        aria-label={`Open run ${r.runCode}`}
                        className="font-mono text-[11px] text-[var(--lux-platinum)]/50 transition-colors group-hover:text-[var(--lux-champagne)]"
                      >
                        open →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <div className="col-span-4 flex flex-col divide-y divide-[rgb(var(--lc-ivory-rgb)/0.1)]">
          <section className="px-7 py-5" aria-labelledby="lab-devices">
            <div className="flex items-baseline justify-between">
              <Label>
                <span id="lab-devices">Devices</span>
              </Label>
              <span className="font-mono text-[10.5px] tabular-nums tracking-[0.1em] text-[var(--lux-platinum)]/60">
                {simulated} simulated · {real} hardware
              </span>
            </div>
            {snap.devices.length === 0 ? (
              <p className="mt-3 text-[12.5px] text-[var(--lux-platinum)]/70">No devices registered.</p>
            ) : (
              <ul className="mt-3 flex flex-col">
                {snap.devices.slice(0, 4).map((d) => (
                  <li key={d.id} className="flex items-center gap-3 border-t border-[rgb(var(--lc-ivory-rgb)/0.07)] py-2 first:border-t-0">
                    <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--lux-ivory)]/85">{d.name}</span>
                    <span
                      className={cn(
                        "rounded-[3px] px-1.5 py-px font-mono text-[9.5px] uppercase tracking-[0.14em]",
                        d.simulated ? "border border-dashed border-[rgb(var(--lc-gold-rgb)/0.6)] text-[var(--lux-champagne)]" : "border border-[#5fd4e6]/40 text-[#5fd4e6]",
                      )}
                    >
                      {d.simulated ? "Simulated" : "Hardware"}
                    </span>
                    {!d.simulated ? <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--lux-platinum)]/60">{d.lastSeen ? d.health : "never connected"}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="flex-1 px-7 py-5" aria-labelledby="lab-faults">
            <div className="flex items-baseline justify-between">
              <Label>
                <span id="lab-faults">Recent image faults</span>
              </Label>
            </div>
            {snap.quality.recent.length === 0 ? (
              <p className="mt-3 text-[12.5px] text-[var(--lux-platinum)]/70">No quality failures stored.</p>
            ) : (
              <ul className="mt-3 flex flex-col">
                {snap.quality.recent.map((f) => (
                  <li key={f.runId} className="border-t border-[rgb(var(--lc-ivory-rgb)/0.07)] py-2 first:border-t-0">
                    <div className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-fault" aria-hidden />
                      <Link href={`/analysis/${f.runId}`} className="font-mono text-[12px] text-[var(--lux-ivory)]/85 hover:text-[var(--lux-champagne)]">
                        {f.runCode}
                      </Link>
                      <span className="ml-auto font-mono text-[10.5px] tabular-nums text-[var(--lux-platinum)]/55">{fmt(f.at)}</span>
                    </div>
                    <div className="mt-0.5 truncate pl-3.5 text-[11.5px] text-fault/85">{f.checks.length ? `failed: ${f.checks.join(" · ")}` : "quality checks failed"}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* ── footer ── */}
      <div className="flex items-center gap-6 border-t border-[rgb(var(--lc-ivory-rgb)/0.1)] px-7 py-4">
        <p className="max-w-[78ch] text-[12px] leading-relaxed text-[var(--lux-platinum)]/70">
          Counts of stored rows only &mdash; nothing here is estimated or a clinical result. Seeded samples, runs, models and devices are synthetic; a reading
          only becomes a measurement once a model is calibrated on real reference data.
        </p>
        <Link href="/console" className="glass-cta ml-auto shrink-0 !h-11 !text-[14px]">
          Open the console
          <span className="glass-cta-dot !size-8" aria-hidden>
            →
          </span>
        </Link>
      </div>
    </div>
  );
}

function Reading({ index, label, value, sub, tone, prefix }: { index: number; label: string; value: number; sub: string; tone?: "gold" | "fault"; prefix?: string }) {
  return (
    <RiseIn index={index} className="px-7 py-6">
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--lux-platinum)]/75">{label}</dt>
      <dd className="mt-3">
        <span
          className={cn(
            "font-display text-[64px] font-extralight leading-[0.9] tracking-[-0.03em] tabular-nums",
            tone === "gold" ? "text-[var(--lux-champagne)]" : tone === "fault" ? "text-fault" : "text-[var(--lux-ivory)]",
          )}
        >
          {prefix}
          <CountUp value={value} delay={0.1 + index * 0.08} />
        </span>
        <span className="mt-3 block text-[12px] leading-snug text-[var(--lux-platinum)]/65">{sub}</span>
      </dd>
    </RiseIn>
  );
}

function StatusChip({ status }: { status: string }) {
  const meta = STATUS[status] ?? { label: status, color: "rgba(242,235,221,0.3)", text: "text-[var(--lux-ivory)]/70" };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-[rgb(var(--lc-ivory-rgb)/0.12)] px-2 py-[2px] text-[11px]", meta.text)}>
      <span className="size-1.5 rounded-full" style={{ background: meta.color }} aria-hidden />
      {meta.label}
    </span>
  );
}

function CalPad({ state, due, small }: { state: CalState; due?: boolean; small?: boolean }) {
  const size = small ? "h-3 w-2.5" : "h-9 w-full";
  const style: Record<CalState, string> = {
    synthetic_only: "border border-dashed border-[rgb(var(--lc-gold-rgb)/0.85)] bg-[repeating-linear-gradient(135deg,rgb(var(--lc-gold-rgb)/0.28)_0_2px,transparent_2px_5px)]",
    experimental: "border border-[rgb(var(--lc-champagne-rgb)/0.7)] bg-[rgb(var(--lc-champagne-rgb)/0.28)]",
    validated: "border border-[#5fd4e6]/70 bg-[#5fd4e6]/35",
    none: "border border-[rgb(var(--lc-ivory-rgb)/0.38)] bg-[rgb(var(--lc-ivory-rgb)/0.03)]",
  };
  return (
    <span className={cn("relative block rounded-[2px]", size, style[state])} aria-hidden>
      {due && !small ? <span className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-[var(--lux-champagne)]" /> : null}
    </span>
  );
}

/* ───────────────────────── fallback states ───────────────────────── */

function LabUnavailable() {
  return (
    <div className="glass flex items-center gap-8 px-8 py-8" role="status">
      <div className="flex-1">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[var(--lux-platinum)]/75">Lab readout · offline</div>
        <p className="t-serif mt-3 text-[36px] leading-tight text-[var(--lux-ivory)]">Lab data unavailable &mdash; open the console.</p>
        <p className="mt-2 max-w-[60ch] text-[13px] leading-relaxed text-[var(--lux-platinum)]/70">
          The database could not be reached while this page was rendered, so no figures are shown in its place. The rest of the page works normally.
        </p>
      </div>
      <Link href="/console" className="glass-cta shrink-0">
        Open the console
        <span className="glass-cta-dot" aria-hidden>
          →
        </span>
      </Link>
    </div>
  );
}

export function LabReadoutSkeleton() {
  const bar = "rounded-[3px] bg-[rgb(var(--lc-ivory-rgb)/0.07)] animate-pulse motion-reduce:animate-none";
  return (
    <div className="glass overflow-hidden p-0" aria-busy="true" aria-label="Loading lab readout">
      <div className="flex items-center gap-5 border-b border-[rgb(var(--lc-ivory-rgb)/0.1)] px-7 py-4">
        <span className={cn(bar, "h-3 w-28")} />
        <span className={cn(bar, "h-3 w-48")} />
        <span className="ml-auto">
          <SyntheticTag />
        </span>
      </div>
      <div className="grid grid-cols-4 divide-x divide-[rgb(var(--lc-ivory-rgb)/0.1)] border-b border-[rgb(var(--lc-ivory-rgb)/0.1)]">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="px-7 py-6">
            <span className={cn(bar, "block h-3 w-32")} />
            <span className={cn(bar, "mt-4 block h-14 w-24")} />
            <span className={cn(bar, "mt-4 block h-3 w-40")} />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-12 divide-x divide-[rgb(var(--lc-ivory-rgb)/0.1)]">
        <div className="col-span-7 space-y-3 px-7 py-6">
          <span className={cn(bar, "block h-3 w-full")} />
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={cn(bar, "block h-4 w-full")} />
          ))}
        </div>
        <div className="col-span-5 px-7 py-6">
          <div className="grid grid-cols-10 gap-1.5">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={cn(bar, "block h-9")} />
            ))}
          </div>
          <span className={cn(bar, "mt-5 block h-20 w-full")} />
        </div>
      </div>
    </div>
  );
}
