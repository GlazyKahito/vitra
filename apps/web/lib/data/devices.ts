import "server-only";
import { and, asc, count, desc, eq, gte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { deviceEvents, devices } from "@/db/schema";
import { newId, newToken } from "@/lib/ids";
import { hashSecret } from "@/lib/auth/password";
import { recordAudit } from "@/lib/data/audit";
import type { Device, DeviceEvent, DeviceWithHealth, SafeUser } from "@/lib/data/contract";

const CAPTURE_KINDS = new Set(["capture_completed"]);

function healthOf(device: Device, errorCount24h: number): DeviceWithHealth["health"] {
  if (device.simulated || device.status === "simulated") return "simulated";
  const seen = device.lastSeenAt ? Date.now() - device.lastSeenAt.getTime() : Infinity;
  if (seen > 10 * 60 * 1000) return "offline";
  if (device.status === "degraded" || errorCount24h >= 3) return "degraded";
  return "online";
}

async function withHealth(device: Device, recentLimit: number): Promise<DeviceWithHealth> {
  const db = await getDb();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentEvents = await db.select().from(deviceEvents).where(eq(deviceEvents.deviceId, device.id)).orderBy(desc(deviceEvents.createdAt)).limit(recentLimit);
  const [{ n }] = await db
    .select({ n: count() })
    .from(deviceEvents)
    .where(and(eq(deviceEvents.deviceId, device.id), eq(deviceEvents.level, "error"), gte(deviceEvents.createdAt, since)));
  const captures = await db
    .select()
    .from(deviceEvents)
    .where(and(eq(deviceEvents.deviceId, device.id), eq(deviceEvents.kind, "capture_completed")))
    .orderBy(desc(deviceEvents.createdAt))
    .limit(1);
  return { device, recentEvents, errorCount24h: Number(n), lastCapture: captures[0] ?? null, health: healthOf(device, Number(n)) };
}

export async function listDevices(): Promise<DeviceWithHealth[]> {
  const db = await getDb();
  const rows = await db.select().from(devices).orderBy(asc(devices.createdAt));
  return Promise.all(rows.map((d) => withHealth(d, 8)));
}

export async function getDevice(id: string): Promise<(DeviceWithHealth & { events: DeviceEvent[] }) | null> {
  const db = await getDb();
  const rows = await db.select().from(devices).where(eq(devices.id, id)).limit(1);
  const d = rows[0];
  if (!d) return null;
  const base = await withHealth(d, 8);
  const events = await db.select().from(deviceEvents).where(eq(deviceEvents.deviceId, id)).orderBy(desc(deviceEvents.createdAt)).limit(200);
  return { ...base, events };
}

export async function getDeviceByName(name: string): Promise<Device | null> {
  const db = await getDb();
  const rows = await db.select().from(devices).where(eq(devices.name, name)).limit(1);
  return rows[0] ?? null;
}

export async function recordDeviceEvent(
  deviceId: string,
  ev: { kind: string; level?: "info" | "warn" | "error"; message: string; payload?: Record<string, unknown>; simulated?: boolean },
): Promise<DeviceEvent> {
  const db = await getDb();
  const row: typeof deviceEvents.$inferInsert = {
    id: newId("dev"),
    deviceId,
    kind: ev.kind,
    level: ev.level ?? "info",
    message: ev.message,
    payload: ev.payload ?? null,
    simulated: ev.simulated ?? false,
  };
  const inserted = await db.insert(deviceEvents).values(row).returning();
  // Keep lastSeenAt current; real devices get online/degraded, simulated devices stay "simulated".
  const [dev] = await db.select({ simulated: devices.simulated }).from(devices).where(eq(devices.id, deviceId)).limit(1);
  const patch: Partial<typeof devices.$inferInsert> = { lastSeenAt: new Date() };
  if (dev?.simulated) patch.status = "simulated";
  else if (!ev.simulated) patch.status = ev.level === "error" ? "degraded" : "online";
  await db.update(devices).set(patch).where(eq(devices.id, deviceId));
  return inserted[0];
}

/**
 * Simulated adapter. Picks the next event kind from a fixed rotation keyed on how many
 * events the device already has, so ticks are deterministic and clearly labelled simulated.
 */
export async function simulateDeviceTick(deviceId: string): Promise<DeviceEvent> {
  const db = await getDb();
  const rows = await db.select().from(devices).where(eq(devices.id, deviceId)).limit(1);
  const d = rows[0];
  if (!d) throw new Error("Device not found");
  const [{ n }] = await db.select({ n: count() }).from(deviceEvents).where(eq(deviceEvents.deviceId, deviceId));
  const seq = Number(n);
  const rotation = ["heartbeat", "heartbeat", "capture_started", "capture_completed", "heartbeat", "illumination_change", "heartbeat", "error"] as const;
  const kind = rotation[seq % rotation.length];
  const tempC = 36 + (seq % 7) * 0.4;
  const payloads: Record<(typeof rotation)[number], { level: "info" | "warn" | "error"; message: string; payload: Record<string, unknown> }> = {
    heartbeat: { level: "info", message: "[SIMULATED] heartbeat", payload: { cpu_temp_c: tempC, uptime_s: 600 + seq * 30, free_mb: 412 } },
    capture_started: { level: "info", message: "[SIMULATED] capture started — reaction timer 120 s", payload: { reaction_seconds: 120, exposure_ms: 8, white_ref: true } },
    capture_completed: { level: "info", message: "[SIMULATED] capture completed — frame queued for upload", payload: { frame: `sim-${seq}.png`, width: 1600, height: 600 } },
    illumination_change: { level: "warn", message: "[SIMULATED] illumination drift detected; LED profile re-applied", payload: { lux_before: 410, lux_after: 440 } },
    error: { level: "error", message: "[SIMULATED] camera timeout (synthetic fault for UI testing)", payload: { code: "E_CAM_TIMEOUT" } },
  };
  const p = payloads[kind];
  const ev = await recordDeviceEvent(deviceId, { kind, level: p.level, message: p.message, payload: { ...p.payload, simulated: true, seq }, simulated: true });
  await db.update(devices).set({ status: "simulated", lastSeenAt: new Date() }).where(eq(devices.id, deviceId));
  return ev;
}

/** Issues a new API key for a device. The plaintext is returned exactly once; only the scrypt hash is stored. */
export async function rotateDeviceKey(deviceId: string, actor: SafeUser): Promise<{ device: Device; plaintextKey: string }> {
  const db = await getDb();
  const rows = await db.select().from(devices).where(eq(devices.id, deviceId)).limit(1);
  const d = rows[0];
  if (!d) throw new Error("Device not found");
  const plaintextKey = `vdk_${newToken(24)}`;
  const apiKeyHash = await hashSecret(plaintextKey);
  const updated = await db.update(devices).set({ apiKeyHash }).where(eq(devices.id, deviceId)).returning();
  await recordAudit({ actor, action: "device.key_rotate", entityType: "device", entityId: deviceId, detail: { name: d.name } });
  return { device: updated[0], plaintextKey };
}

export const isCaptureEvent = (e: DeviceEvent): boolean => CAPTURE_KINDS.has(e.kind);
