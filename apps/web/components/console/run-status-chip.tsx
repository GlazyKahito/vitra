import { Chip, type ChipTone } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

/** Run lifecycle status → chip. Fault tone only for image/system faults. */
export const RUN_STATUS_META: Record<string, { label: string; tone: ChipTone; description: string }> = {
  queued: { label: "Queued", tone: "muted", description: "Run created, waiting for the pipeline." },
  processing: { label: "Processing", tone: "signal", description: "CV pipeline running." },
  invalid_image: { label: "Invalid image", tone: "fault", description: "Whole-image quality checks failed; no pads were analysed." },
  calibration_required: { label: "Calibration required", tone: "neutral", description: "No compatible calibration model produced a value for any analyte." },
  pending_review: { label: "Pending review", tone: "notice", description: "Results persisted; waiting for a clinical review decision." },
  reviewed: { label: "Reviewed", tone: "signal", description: "A reviewer accepted the run." },
  rejected: { label: "Rejected", tone: "neutral", description: "A reviewer rejected the run or asked for a repeat." },
  failed: { label: "Failed", tone: "fault", description: "The pipeline or CV service errored." },
};

export function RunStatusChip({ status, className }: { status: string; className?: string }) {
  const meta = RUN_STATUS_META[status] ?? { label: status, tone: "neutral" as ChipTone, description: "" };
  return (
    <Chip tone={meta.tone} title={meta.description} data-status={status} className={className} dot={status === "processing"} pulse={status === "processing"}>
      {meta.label}
    </Chip>
  );
}

/** Mono "SYNTHETIC" tag — every synthetic row/run/value carries it. */
export function SyntheticTag({ className, title = "Synthetic data — not a real sample" }: { className?: string; title?: string }) {
  return (
    <span className={cn("inline-flex h-[18px] items-center rounded-[2px] border border-dashed border-line-strong px-1.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-fg-3", className)} title={title}>
      Synthetic
    </span>
  );
}

export function ModeTag({ mode }: { mode: string }) {
  return (
    <span className={cn("t-mono text-[11px] uppercase tracking-[0.1em]", mode === "demo" ? "text-fg-3" : "text-fg-2")} title={mode === "demo" ? "Demo mode: synthetic-data models may produce demonstration values." : "Research mode: only models trained on real reference data can produce values."}>
      {mode}
    </span>
  );
}
