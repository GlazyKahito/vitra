import Link from "next/link";

const ROWS: { item: string; state: "hashed" | "encrypted-in-transit" | "plaintext" | "pseudonymous"; note: string }[] = [
  { item: "User passwords", state: "hashed", note: "scrypt with per-user salt; never stored or logged in clear." },
  { item: "Session tokens", state: "hashed", note: "Cookie vitra_session holds a random token; the DB stores its hash with expiry." },
  { item: "Device ingest keys", state: "hashed", note: "Shown once on rotation, then only the scrypt hash is kept." },
  { item: "CV service token", state: "encrypted-in-transit", note: "CV_SERVICE_TOKEN from the environment, sent as X-Vitra-Service-Token. Requires TLS or a loopback/private network." },
  { item: "Strip images, overlays, crops", state: "plaintext", note: "Files under STORAGE_DIR; served only through /api/files with an authenticated session. Not encrypted at rest — use disk encryption in deployment." },
  { item: "Reports (PDF/JSON), datasets (CSV)", state: "plaintext", note: "Same storage; same access rule. Every download is audited." },
  { item: "Samples", state: "pseudonymous", note: "sample_code and subject_pseudonym only. No names, MRNs or dates of birth exist in the schema; do not put them in metadata." },
  { item: "Database (PGlite / PostgreSQL)", state: "plaintext", note: "No column-level encryption. Protect the data directory / DATABASE_URL host." },
  { item: "Audit trail", state: "plaintext", note: "Actor label, action, entity, IP. Append-only by convention; nothing in the UI deletes it." },
];

const STATE_LABEL: Record<(typeof ROWS)[number]["state"], string> = {
  hashed: "hashed",
  "encrypted-in-transit": "TLS only",
  plaintext: "not encrypted",
  pseudonymous: "pseudonymous",
};

export function SecurityNotes() {
  return (
    <div className="flex flex-col gap-4">
      <table className="table-instrument">
        <thead>
          <tr>
            <th>Item</th>
            <th>Protection</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.item}>
              <td className="text-fg">{r.item}</td>
              <td className="t-mono text-[12px]">{STATE_LABEL[r.state]}</td>
              <td className="text-[12.5px]">{r.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid grid-cols-2 gap-4 text-[12.5px] text-fg-3">
        <div>
          <div className="t-eyebrow mb-1">Environment</div>
          <ul className="t-mono flex flex-col gap-0.5 text-[11.5px]">
            <li>DATABASE_URL — PostgreSQL; unset → PGlite at .data/pglite</li>
            <li>STORAGE_DIR — file root (default ./storage)</li>
            <li>CV_SERVICE_URL · CV_SERVICE_TOKEN</li>
            <li>PGLITE_DIR — override embedded DB path</li>
          </ul>
        </div>
        <div>
          <div className="t-eyebrow mb-1">Documentation</div>
          <ul className="flex flex-col gap-0.5">
            <li>
              <Link href="/methodology" className="text-signal">
                Methodology
              </Link>{" "}
              — pipeline, result states, what “validated” requires
            </li>
            <li>
              <span className="t-mono text-[11.5px]">docs/cv-service-contract.md</span> — CV service API
            </li>
            <li>
              <span className="t-mono text-[11.5px]">docs/BUILD-CONTEXT.md</span> — rules the build follows (no fabricated results, synthetic labelling)
            </li>
            <li>
              <Link href="/devices" className="text-signal">
                Devices → Integration
              </Link>{" "}
              — device ingest contract
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
