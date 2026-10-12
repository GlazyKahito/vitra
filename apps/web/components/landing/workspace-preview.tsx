import { Reveal } from "@/components/motion/reveal";
import { Chip } from "@/components/ui/chip";
import { StateChip } from "@/components/ui/state-chip";
import { Stat } from "@/components/ui/stat";
import { RESULT_STATES } from "@/lib/inference/policy";
import { Chapter, ChapterCopy, ChapterHeadline } from "./chapter";

const RUNS = [
  { id: "RUN-0F3A91", sample: "SYN-0042", product: "Generic 10-SG", state: "synthetic", quality: "pass", at: "12 Oct · 10:14" },
  { id: "RUN-0F3A8C", sample: "SYN-0041", product: "Generic 10-SG", state: "calibration_required", quality: "pass", at: "12 Oct · 09:58" },
  { id: "RUN-0F3A77", sample: "SYN-0040", product: "Generic 10-SG", state: "indeterminate", quality: "warn", at: "11 Oct · 17:41" },
  { id: "RUN-0F3A60", sample: "SYN-0039", product: "Generic 10-SG", state: "invalid_image", quality: "fail", at: "11 Oct · 17:02" },
] as const;

const APPLICATIONS = [
  ["Research & calibration", "Collect reference pairs, train baselines, compare feature sets."],
  ["Operator workflow", "Insert, wait 120 s, capture, hand off to review."],
  ["Clinical review", "Per-analyte states, overrides with reasons, sign-off."],
  ["Device engineering", "Ingest API, simulated adapter, LED drift tracking."],
  ["Reporting", "PDF/JSON exports with model, version and reviewer."],
] as const;

/** Chapter 06 — a framed console mock built from the real UI kit. */
export function WorkspacePreview() {
  return (
    <Chapter index="06" label="Workspace" id="workspace">
      <div className="py-24">
        <div className="grid grid-cols-[1fr_1.4fr] gap-16">
          <div>
            <Reveal>
              <ChapterHeadline>A workstation, not a widget.</ChapterHeadline>
            </Reveal>
            <Reveal delay={0.1}>
              <ChapterCopy className="mt-8">
                The console is organised around runs: each one keeps its image, overlay, features, model version and review trail together. Nothing is
                shown without the state that explains it.
              </ChapterCopy>
            </Reveal>
            <Reveal delay={0.2}>
              <ul className="mt-10 divide-y divide-line border-y border-line">
                {APPLICATIONS.map(([t, d], i) => (
                  <li key={t} className="grid grid-cols-[32px_180px_1fr] items-baseline gap-4 py-3.5">
                    <span className="font-mono text-[11px] tabular-nums text-fg-4">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-[14px] text-fg">{t}</span>
                    <span className="text-[13px] text-fg-3">{d}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>

          <Reveal delay={0.15}>
            <div className="panel overflow-hidden">
              {/* mock top bar */}
              <div className="flex h-11 items-center justify-between border-b border-line px-5">
                <div className="flex items-center gap-3">
                  <span className="t-eyebrow">Console</span>
                  <span className="text-[13px] text-fg">Overview</span>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-4">Research prototype · not a medical device</span>
              </div>
              {/* stat row */}
              <div className="grid grid-cols-4 gap-6 border-b border-line px-5 py-5">
                <Stat eyebrow="Runs · 7 d" value="24" sub="all synthetic" />
                <Stat eyebrow="Pending review" value="3" tone="notice" sub="oldest 2 h" />
                <Stat eyebrow="Image faults" value="1" tone="fault" sub="glare" />
                <Stat eyebrow="Validated models" value="0" sub="of 10 analytes" />
              </div>
              {/* run table */}
              <table className="table-instrument">
                <thead>
                  <tr>
                    <th>Run</th>
                    <th>Sample</th>
                    <th>Strip product</th>
                    <th>Image</th>
                    <th>State</th>
                    <th className="text-right">Captured</th>
                  </tr>
                </thead>
                <tbody>
                  {RUNS.map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono text-[12px] text-fg">{r.id}</td>
                      <td className="font-mono text-[12px]">
                        {r.sample} <Chip tone="muted" className="ml-1.5">Synthetic</Chip>
                      </td>
                      <td>{r.product}</td>
                      <td>
                        <Chip tone={r.quality === "fail" ? "fault" : r.quality === "warn" ? "notice" : "neutral"} dot>
                          {r.quality}
                        </Chip>
                      </td>
                      <td>
                        <StateChip state={r.state} />
                      </td>
                      <td className="text-right font-mono text-[12px] text-fg-3">{r.at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* legend */}
              <div className="border-t border-line px-5 py-4">
                <div className="t-eyebrow mb-3">Result states</div>
                <div className="flex flex-wrap gap-2">
                  {RESULT_STATES.map((s) => (
                    <StateChip key={s} state={s} />
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </Chapter>
  );
}
