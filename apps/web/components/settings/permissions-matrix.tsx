import { Check } from "lucide-react";
import { PERMISSIONS, PERMISSION_DESCRIPTIONS, ROLE_KEYS, ROLE_LABELS, ROLE_PERMISSIONS } from "@/lib/auth/permissions";

export function PermissionsMatrix({ currentRole }: { currentRole: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="table-instrument">
        <thead>
          <tr>
            <th>Permission</th>
            {ROLE_KEYS.map((r) => (
              <th key={r} className={r === currentRole ? "text-signal" : undefined} title={ROLE_LABELS[r].description}>
                {ROLE_LABELS[r].label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERMISSIONS.map((p) => (
            <tr key={p}>
              <td>
                <span className="t-mono text-[12px] text-fg">{p}</span>
                <div className="text-[11.5px] text-fg-4">{PERMISSION_DESCRIPTIONS[p]}</div>
              </td>
              {ROLE_KEYS.map((r) => {
                const has = ROLE_PERMISSIONS[r].includes(p);
                return (
                  <td key={r} className={r === currentRole ? "bg-[rgba(95,212,230,0.04)] text-center" : "text-center"} aria-label={has ? "granted" : "not granted"}>
                    {has ? <Check className="mx-auto size-3.5 text-fg" aria-hidden /> : <span className="text-fg-4">·</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
