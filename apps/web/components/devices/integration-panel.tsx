/**
 * Documents the device ingest contract as implemented in app/api/ingest/route.ts
 * (docs/device-api.md did not exist when this was written; keep both in sync).
 */
export function IntegrationPanel({ deviceName, baseUrl = "https://vitra.example.org" }: { deviceName: string; baseUrl?: string }) {
  const curl = `curl -sS -X POST ${baseUrl}/api/ingest \\
  -H "X-Device-Id: ${deviceName}" \\
  -H "X-Device-Key: $VITRA_DEVICE_KEY" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H "X-Capture-Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)" \\
  -F "file=@/var/vitra/captures/strip-0042.png;type=image/png" \\
  -F "sample_code=S-2026-0042" \\
  -F "mode=research" \\
  -F "reaction_seconds=120"`;

  return (
    <div className="flex flex-col gap-4 text-[13px] text-fg-2">
      <p className="leading-relaxed">
        The device never talks to the CV service. It posts one image per capture to the web app, which authenticates it, stores the image, runs the pipeline and records a run. Nothing in this contract depends on the device being a Raspberry Pi; the simulated adapter uses the same path.
      </p>

      <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-x-4 gap-y-2">
        <span className="t-eyebrow pt-0.5">Endpoint</span>
        <span className="t-mono">POST /api/ingest · multipart/form-data · ≤ 15 MB</span>
        <span className="t-eyebrow pt-0.5">Headers</span>
        <dl className="t-mono flex flex-col gap-1 text-[12px]">
          <div>
            <dt className="inline text-fg">X-Device-Id</dt> <dd className="inline text-fg-3">— device name as registered (2–64 chars, [A-Za-z0-9._-]); required</dd>
          </div>
          <div>
            <dt className="inline text-fg">X-Device-Key</dt> <dd className="inline text-fg-3">— plaintext ingest key; only a hash is stored server-side; required</dd>
          </div>
          <div>
            <dt className="inline text-fg">Idempotency-Key</dt> <dd className="inline text-fg-3">— unique per capture (UUID); ≤ 200 chars; optional but strongly recommended</dd>
          </div>
          <div>
            <dt className="inline text-fg">X-Capture-Timestamp</dt> <dd className="inline text-fg-3">— ISO-8601 UTC time the shutter fired; optional</dd>
          </div>
        </dl>
        <span className="t-eyebrow pt-0.5">Form fields</span>
        <dl className="t-mono flex flex-col gap-1 text-[12px]">
          <div>
            <dt className="inline text-fg">file</dt> <dd className="inline text-fg-3">— JPEG / PNG / WebP image of the strip; required</dd>
          </div>
          <div>
            <dt className="inline text-fg">sample_code</dt> <dd className="inline text-fg-3">— pseudonymous code; created if unknown, else a fresh S-… code is issued</dd>
          </div>
          <div>
            <dt className="inline text-fg">strip_product_id · strip_batch_id</dt> <dd className="inline text-fg-3">— default product from settings when omitted</dd>
          </div>
          <div>
            <dt className="inline text-fg">mode</dt> <dd className="inline text-fg-3">— research (default) | demo (only when demo mode is enabled)</dd>
          </div>
          <div>
            <dt className="inline text-fg">reaction_seconds · reaction_started_at</dt> <dd className="inline text-fg-3">— reagent timing, integer seconds / ISO-8601</dd>
          </div>
        </dl>
        <span className="t-eyebrow pt-0.5">Responses</span>
        <dl className="t-mono flex flex-col gap-1 text-[12px]">
          <div>
            <dt className="inline text-fg">202</dt> <dd className="inline text-fg-3">{`{ run_id, run_code, status }`} — accepted and analysed</dd>
          </div>
          <div>
            <dt className="inline text-fg">200</dt> <dd className="inline text-fg-3">{`{ …, duplicate: true }`} — same Idempotency-Key already processed; the original run is returned</dd>
          </div>
          <div>
            <dt className="inline text-fg">401</dt> <dd className="inline text-fg-3">unknown device or bad key (audited)</dd>
          </div>
          <div>
            <dt className="inline text-fg">409</dt> <dd className="inline text-fg-3">duplicate key still in flight — retry with the same key</dd>
          </div>
          <div>
            <dt className="inline text-fg">413 · 415 · 422</dt> <dd className="inline text-fg-3">too large · unsupported media / invalid image · invalid field</dd>
          </div>
        </dl>
        <span className="t-eyebrow pt-0.5">Retries</span>
        <span className="leading-relaxed">
          On timeout, 5xx or network loss, retry with the <em>same</em> Idempotency-Key and exponential back-off (2 s, 4 s, 8 s … capped at 60 s). Never regenerate the key for a retry; the server de-duplicates by device + key so a capture is analysed once.
        </span>
        <span className="t-eyebrow pt-0.5">Transport</span>
        <span className="leading-relaxed">TLS is required in deployment (the key travels in a header). Pin the hostname in the device config; reject plaintext http. Clock the device with NTP so X-Capture-Timestamp is meaningful.</span>
      </div>

      <div>
        <div className="t-eyebrow mb-2">Example</div>
        <pre className="panel-inset overflow-x-auto p-3 t-mono text-[11.5px] leading-relaxed text-fg-2">{curl}</pre>
      </div>
    </div>
  );
}
