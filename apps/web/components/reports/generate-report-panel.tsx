"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { generateReportAction } from "@/app/actions/reports";

export interface RunOption {
  id: string;
  runCode: string;
  sampleCode: string;
  status: string;
  mode: string;
  synthetic: boolean;
  createdAt: string;
  reviewed: boolean;
}

export interface GenerateReportPanelProps {
  runs: RunOption[];
  canGenerate: boolean;
  requireReview: boolean;
}

export function GenerateReportPanel({ runs, canGenerate, requireReview }: GenerateReportPanelProps) {
  const router = useRouter();
  const [runId, setRunId] = useState(runs[0]?.id ?? "");
  const [format, setFormat] = useState<"pdf" | "json">("pdf");
  const [result, setResult] = useState<{ ok: true; reportId: string; downloadUrl: string } | { ok: false; error: string } | null>(null);
  const [pending, start] = useTransition();
  const run = runs.find((r) => r.id === runId) ?? null;
  const reviewBlock = requireReview && run !== null && !run.reviewed;

  function submit() {
    if (!runId || !canGenerate) return;
    start(async () => {
      const res = await generateReportAction(runId, format);
      setResult(res.ok ? { ok: true, reportId: res.reportId, downloadUrl: res.downloadUrl } : { ok: false, error: res.error });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Field label="Run" required help={run ? `${run.status.replace(/_/g, " ")} · ${run.mode} mode${run.synthetic ? " · SYNTHETIC" : ""}${run.reviewed ? " · reviewed" : " · not reviewed"}` : "No recent runs."}>
        <Select value={runId} onChange={(e) => setRunId(e.target.value)} disabled={!canGenerate || runs.length === 0}>
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.runCode} · {r.sampleCode} · {r.status}
              {r.synthetic ? " · SYNTHETIC" : ""}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Format" required>
        <Select value={format} onChange={(e) => setFormat(e.target.value === "json" ? "json" : "pdf")} disabled={!canGenerate}>
          <option value="pdf">PDF — printable, with image overlay and state chips</option>
          <option value="json">JSON — machine-readable, full result states and reasons</option>
        </Select>
      </Field>
      {reviewBlock ? <p className="text-[12px] text-notice">Settings require clinical review before a report; this run has no review yet. The server will refuse.</p> : null}
      {result && !result.ok ? (
        <p className="text-[12.5px] text-fault" role="alert">
          {result.error}
        </p>
      ) : null}
      {result && result.ok ? (
        <p className="text-[12.5px] text-fg-2" role="status">
          Report generated.{" "}
          <a href={result.downloadUrl || `/api/reports/${encodeURIComponent(result.reportId)}`} className="text-signal underline-offset-2 hover:underline" download>
            Download {format.toUpperCase()}
          </a>
        </p>
      ) : null}
      <div className="flex items-center justify-end gap-3">
        {!canGenerate ? <span className="text-[12px] text-fg-4">Requires reports.generate.</span> : null}
        <Button onClick={submit} loading={pending} disabled={!canGenerate || !runId} leading={<FileText className="size-4" />}>
          Generate
        </Button>
      </div>
    </div>
  );
}
