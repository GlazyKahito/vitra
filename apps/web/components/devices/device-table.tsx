import Link from "next/link";
import type { DeviceWithHealth } from "@/lib/data/contract";
import { Chip, type ChipTone } from "@/components/ui/chip";
import { SyntheticTag } from "@/components/common/synthetic-tag";
import { formatDateTime, formatRelative } from "@/lib/utils";

export const HEALTH_META: Record<DeviceWithHealth["health"], { label: string; tone: ChipTone; pulse: boolean }> = {
  simulated: { label: "Simulated", tone: "muted", pulse: false },
  online: { label: "Online", tone: "signal", pulse: true },
  degraded: { label: "Degraded", tone: "notice", pulse: false },
  offline: { label: "Offline", tone: "neutral", pulse: false },
};

export function DeviceKindTag({ device }: { device: DeviceWithHealth["device"] }) {
  if (device.simulated) return <SyntheticTag variant="simulated" />;
  if (device.kind === "raspberry_pi") return <Chip tone="neutral">Raspberry Pi — not connected</Chip>;
  return <Chip tone="neutral">{device.kind}</Chip>;
}

export function HealthChip({ health }: { health: DeviceWithHealth["health"] }) {
  const h = HEALTH_META[health];
  return (
    <Chip tone={h.tone} dot pulse={h.pulse}>
      {h.label}
    </Chip>
  );
}

/** Capture state from the most recent capture_* event. */
export function captureState(d: DeviceWithHealth): string {
  const ev = d.lastCapture;
  if (!ev) return "no captures";
  if (ev.kind === "capture_started") return "capturing";
  if (ev.kind === "capture_completed") return `captured ${formatRelative(ev.createdAt)}`;
  return ev.kind;
}

export function DeviceTable({ devices, selectedId }: { devices: DeviceWithHealth[]; selectedId?: string }) {
  if (devices.length === 0) return <p className="px-5 py-8 text-[12.5px] text-fg-4">No devices registered. The seed creates one simulated device; a Raspberry Pi appears once it is registered with an ingest key.</p>;
  return (
    <div className="overflow-x-auto">
    <table className="table-instrument ws-compact">
      <thead>
        <tr>
          <th>Device</th>
          <th>Kind</th>
          <th>Health</th>
          <th>Last seen</th>
          <th>Capture</th>
          <th>Errors 24h</th>
          <th>Software</th>
        </tr>
      </thead>
      <tbody>
        {devices.map((d) => (
          <tr key={d.device.id} className={d.device.id === selectedId ? "bg-[rgba(95,212,230,0.05)]" : undefined}>
            <td>
              <Link href={`/devices/${encodeURIComponent(d.device.id)}`} className="whitespace-nowrap text-fg hover:text-signal">
                {d.device.name}
              </Link>
              <div className="t-mono whitespace-nowrap text-[10.5px] text-fg-4">{d.device.id}</div>
            </td>
            <td>
              <DeviceKindTag device={d.device} />
            </td>
            <td>
              <HealthChip health={d.health} />
            </td>
            <td className="t-mono text-[12px]" title={formatDateTime(d.device.lastSeenAt, { seconds: true })}>
              {d.device.lastSeenAt ? formatRelative(d.device.lastSeenAt) : "never"}
            </td>
            <td className="text-[12.5px]">{captureState(d)}</td>
            <td className="t-mono">{d.errorCount24h === 0 ? <span className="text-fg-4">0</span> : <span className="text-fault">{d.errorCount24h}</span>}</td>
            <td className="t-mono text-[12px]">{d.device.softwareVersion ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}
