"use client";

import { useState, useTransition } from "react";
import { FileJson, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateReportAction } from "@/app/actions/reports";

export interface RunActionsProps {
  runId: string;
  canGenerate: boolean;
  canReview: boolean;
  existing: { id: string; format: string }[];
}

/** Generate PDF / JSON report → link to /api/reports/<id>; Open in review. */
export function RunActions({ runId, canGenerate, canReview, existing }: RunActionsProps) {
  const [pending, startTransition] = useTransition();
  const [busyFormat, setBusyFormat] = useState<"pdf" | "json" | null>(null);
  const [reports, setReports] = useState(existing);
  const [error, setError] = useState<string | null>(null);

  function generate(format: "pdf" | "json") {
    setError(null);
    setBusyFormat(format);
    startTransition(async () => {
      try {
        const res = await generateReportAction(runId, format);
        if (res.ok) {
          setReports((r) => [{ id: res.reportId, format }, ...r]);
          window.open(`/api/reports/${res.reportId}`, "_blank", "noopener");
        } else setError(res.error);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Report generation failed.");
      } finally {
        setBusyFormat(null);
      }
    });
  }

  const latestPdf = reports.find((r) => r.format === "pdf");
  const latestJson = reports.find((r) => r.format === "json");

  return (
    <div className="flex items-center gap-2">
      {error ? (
        <span className="text-[12px] text-fault" role="alert">
          {error}
        </span>
      ) : null}
      {canGenerate ? (
        <>
          <Button size="sm" variant="secondary" leading={<FileText className="size-3.5" />} onClick={() => generate("pdf")} loading={pending && busyFormat === "pdf"} disabled={pending}>
            Generate PDF
          </Button>
          <Button size="sm" variant="secondary" leading={<FileJson className="size-3.5" />} onClick={() => generate("json")} loading={pending && busyFormat === "json"} disabled={pending}>
            Generate JSON
          </Button>
        </>
      ) : null}
      {latestPdf ? (
        <a href={`/api/reports/${latestPdf.id}`} target="_blank" rel="noopener" className="t-mono text-[11px] uppercase tracking-[0.1em] text-fg-3 hover:text-signal">
          latest pdf
        </a>
      ) : null}
      {latestJson ? (
        <a href={`/api/reports/${latestJson.id}`} target="_blank" rel="noopener" className="t-mono text-[11px] uppercase tracking-[0.1em] text-fg-3 hover:text-signal">
          latest json
        </a>
      ) : null}
      {canReview ? (
        <Button size="sm" href={`/review?run=${runId}`}>
          Open in review
        </Button>
      ) : null}
    </div>
  );
}
