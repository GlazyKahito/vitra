import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import { auditEvents } from "@/db/schema";
import { newId } from "@/lib/ids";
import type { AuditEvent, SafeUser } from "@/lib/data/contract";

async function requestIp(): Promise<string | null> {
  try {
    const h = await headers();
    const fwd = h.get("x-forwarded-for");
    return (fwd ? fwd.split(",")[0].trim() : h.get("x-real-ip")) || null;
  } catch {
    return null; // not in a request scope (seed, scripts)
  }
}

export async function recordAudit(ev: {
  actor: SafeUser | null;
  action: string;
  entityType: string;
  entityId: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const db = await getDb();
  await db.insert(auditEvents).values({
    id: newId("aud"),
    actorId: ev.actor?.id ?? null,
    actorLabel: ev.actor ? `${ev.actor.displayName} <${ev.actor.email}>` : "system",
    action: ev.action,
    entityType: ev.entityType,
    entityId: ev.entityId,
    detail: ev.detail ?? null,
    ip: await requestIp(),
  });
}

export async function listAudit(filter: { entityType?: string; entityId?: string; limit?: number } = {}): Promise<AuditEvent[]> {
  const db = await getDb();
  const conds = [];
  if (filter.entityType) conds.push(eq(auditEvents.entityType, filter.entityType));
  if (filter.entityId) conds.push(eq(auditEvents.entityId, filter.entityId));
  const limit = Math.min(Math.max(filter.limit ?? 100, 1), 1000);
  return db
    .select()
    .from(auditEvents)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit);
}
