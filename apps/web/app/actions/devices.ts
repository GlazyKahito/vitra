"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDevice, rotateDeviceKey, simulateDeviceTick } from "@/lib/data/devices";
import { recordAudit } from "@/lib/data/audit";
import { toActionError, type ActionResult } from "@/app/actions/_shared";

const idSchema = z.string().min(1).max(80);

/** simulateDeviceTickAction(deviceId) — only for simulated devices; writes a clearly simulated event. */
export async function simulateDeviceTickAction(deviceId: string): Promise<ActionResult<{ eventId: string; kind: string; message: string }>> {
  try {
    const user = await requireUser("devices.manage");
    const id = idSchema.safeParse(deviceId);
    if (!id.success) return { ok: false, error: "Invalid device id." };
    const dev = await getDevice(id.data);
    if (!dev) return { ok: false, error: "Device not found." };
    if (!dev.device.simulated) return { ok: false, error: "Only simulated devices can be ticked; real devices report through /api/ingest." };
    const ev = await simulateDeviceTick(id.data);
    await recordAudit({ actor: user, action: "device.simulate_tick", entityType: "device", entityId: id.data, detail: { eventId: ev.id, kind: ev.kind } });
    revalidatePath("/devices");
    revalidatePath(`/devices/${id.data}`);
    return { ok: true, eventId: ev.id, kind: ev.kind, message: ev.message };
  } catch (err) {
    return toActionError(err);
  }
}

/** rotateDeviceKeyAction(deviceId) → plaintext key shown exactly once. */
export async function rotateDeviceKeyAction(deviceId: string): Promise<ActionResult<{ deviceId: string; deviceName: string; plaintextKey: string }>> {
  try {
    const user = await requireUser("devices.manage");
    const id = idSchema.safeParse(deviceId);
    if (!id.success) return { ok: false, error: "Invalid device id." };
    const { device, plaintextKey } = await rotateDeviceKey(id.data, user);
    revalidatePath("/devices");
    revalidatePath(`/devices/${id.data}`);
    return { ok: true, deviceId: device.id, deviceName: device.name, plaintextKey };
  } catch (err) {
    return toActionError(err);
  }
}
