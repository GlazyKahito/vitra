import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { requireUser, can } from "@/lib/auth";
import { logoutAction } from "@/lib/auth/actions";
import { getDevice } from "@/lib/data/devices";
import { PrototypeBanner } from "@/components/common/prototype-banner";
import { DeviceDetailCard } from "@/components/devices/device-detail-card";
import { EventTimeline } from "@/components/devices/event-timeline";
import { DeviceActions } from "@/components/devices/device-actions";
import { IntegrationPanel } from "@/components/devices/integration-panel";

export const dynamic = "force-dynamic";

export default async function DeviceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser("runs.read");
  const { id } = await params;
  const d = await getDevice(id);
  if (!d) notFound();
  const canManage = can(user, "devices.manage");
  const isAdmin = user.roleKey === "admin";
  const errors = d.events.filter((e) => e.level === "error");

  return (
    <AppShell
      user={{ displayName: user.displayName, roleKey: user.roleKey }}
      eyebrow={`08 / Devices / ${d.device.name}`}
      title={d.device.name}
      actions={
        <Button href="/devices" variant="secondary" size="sm">
          All devices
        </Button>
      }
      onLogout={logoutAction}
    >
      <div className="flex flex-col gap-6">
        {d.device.simulated ? (
          <PrototypeBanner variant="inline" detail="This is the simulated device adapter. Every heartbeat, capture and error below is generated on demand and tagged simulated." />
        ) : (
          <PrototypeBanner variant="inline" detail={d.device.lastSeenAt ? "Hardware device. Only events it has actually posted are shown." : "Hardware device registered but it has never connected. No telemetry exists for it."} />
        )}

        <div className="grid grid-cols-[420px_minmax(0,1fr)] items-start gap-6">
          <div className="flex flex-col gap-4">
            <Panel eyebrow="Device" title="Status">
              <DeviceDetailCard d={d} />
            </Panel>
            <Panel eyebrow="Actions" title="Manage">
              <DeviceActions deviceId={d.device.id} simulated={d.device.simulated} canManage={canManage} isAdmin={isAdmin} />
            </Panel>
            <Panel eyebrow="Errors" title={`${errors.length} error event${errors.length === 1 ? "" : "s"}`} description={`${d.errorCount24h} in the last 24 h`} flush>
              <EventTimeline events={errors.slice(0, 25)} emptyText="No error events recorded." />
            </Panel>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <Panel eyebrow="Timeline" title={`${d.events.length} event${d.events.length === 1 ? "" : "s"}`} description="Newest first. Payload summaries are truncated; the full payload is in the audit/export." flush>
              <EventTimeline events={d.events} />
            </Panel>
            <Panel eyebrow="Integration" title="Device API contract" description="How a capture device posts images to VITRA. Implemented in app/api/ingest.">
              <IntegrationPanel deviceName={d.device.name} />
            </Panel>
          </div>
        </div>

        <p className="text-[12px] text-fg-4">
          Device runs appear in{" "}
          <Link href={`/history?q=${encodeURIComponent(d.device.name)}`} className="text-signal">
            History
          </Link>{" "}
          with image source “device”.
        </p>
        <PrototypeBanner />
      </div>
    </AppShell>
  );
}
