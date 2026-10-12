import { Chip } from "@/components/ui/chip";
import { CV_SERVICE_URL, CvServiceError, health, type HealthResponse } from "@/lib/cv/client";

export type CvHealthResult = { ok: true; data: HealthResponse; latencyMs: number } | { ok: false; code: string; message: string; latencyMs: number };

/** Server-side probe of the CV service /health. Never throws. */
export async function probeCvHealth(): Promise<CvHealthResult> {
  const t0 = Date.now();
  try {
    const data = await health();
    return { ok: true, data, latencyMs: Date.now() - t0 };
  } catch (e) {
    const latencyMs = Date.now() - t0;
    if (e instanceof CvServiceError) return { ok: false, code: e.code, message: e.message, latencyMs };
    return { ok: false, code: "unknown", message: (e as Error).message, latencyMs };
  }
}

export function CvHealthCard({ result, configuredUrl }: { result: CvHealthResult; configuredUrl: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {result.ok ? (
          <Chip tone="signal" dot>
            reachable
          </Chip>
        ) : result.code === "unreachable" || result.code === "timeout" ? (
          <Chip tone="neutral" dot>
            unreachable
          </Chip>
        ) : (
          <Chip tone="fault" dot>
            error · {result.code}
          </Chip>
        )}
        <span className="t-mono text-[11px] text-fg-4">{result.latencyMs} ms</span>
      </div>
      <dl className="grid grid-cols-[160px_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[12.5px]">
        <dt className="t-eyebrow pt-0.5">Configured URL</dt>
        <dd className="t-mono text-fg-2">{configuredUrl}</dd>
        <dt className="t-eyebrow pt-0.5">Effective URL</dt>
        <dd className="t-mono text-fg-2">
          {CV_SERVICE_URL}
          {CV_SERVICE_URL !== configuredUrl.replace(/\/+$/, "") ? <span className="ml-2 text-notice">env CV_SERVICE_URL overrides the stored setting</span> : null}
        </dd>
        {result.ok ? (
          <>
            <dt className="t-eyebrow pt-0.5">Service</dt>
            <dd className="t-mono text-fg-2">
              {result.data.service} {result.data.version}
            </dd>
            <dt className="t-eyebrow pt-0.5">Pipeline</dt>
            <dd className="t-mono text-fg-2">{result.data.pipeline_version}</dd>
            <dt className="t-eyebrow pt-0.5">OpenCV</dt>
            <dd className="t-mono text-fg-2">{result.data.opencv_version}</dd>
            <dt className="t-eyebrow pt-0.5">Models loaded</dt>
            <dd className="t-mono text-fg-2">{result.data.models_loaded}</dd>
          </>
        ) : (
          <>
            <dt className="t-eyebrow pt-0.5">Detail</dt>
            <dd className="text-fg-3">{result.message}</dd>
          </>
        )}
      </dl>
      <p className="text-[12px] text-fg-4">Checked server-side at page render. When the service is down, analysis runs are recorded as failed with every analyte in state “Inference unavailable”.</p>
    </div>
  );
}
