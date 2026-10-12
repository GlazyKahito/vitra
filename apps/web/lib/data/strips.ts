import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { stripBatches, stripProducts } from "@/db/schema";
import { recordAudit } from "@/lib/data/audit";
import type { SafeUser, StripBatch, StripProduct } from "@/lib/data/contract";

export type StripProductWithBatches = StripProduct & { batches: StripBatch[] };

export async function listStripProducts(): Promise<StripProductWithBatches[]> {
  const db = await getDb();
  const products = await db.select().from(stripProducts).orderBy(asc(stripProducts.createdAt));
  const batches = await db.select().from(stripBatches).orderBy(asc(stripBatches.lotNumber));
  return products.map((p) => ({ ...p, batches: batches.filter((b) => b.stripProductId === p.id) }));
}

export async function getStripProduct(id: string): Promise<StripProductWithBatches | null> {
  const db = await getDb();
  const rows = await db.select().from(stripProducts).where(eq(stripProducts.id, id)).limit(1);
  const p = rows[0];
  if (!p) return null;
  const batches = await db.select().from(stripBatches).where(eq(stripBatches.stripProductId, id)).orderBy(asc(stripBatches.lotNumber));
  return { ...p, batches };
}

export async function updateStripProduct(
  id: string,
  patch: Partial<Pick<StripProduct, "padMap" | "reactionSeconds" | "geometry" | "notes">>,
  actor: SafeUser,
): Promise<void> {
  const db = await getDb();
  const set: Partial<typeof stripProducts.$inferInsert> = {};
  if (patch.padMap !== undefined) set.padMap = patch.padMap;
  if (patch.reactionSeconds !== undefined) set.reactionSeconds = patch.reactionSeconds;
  if (patch.geometry !== undefined) set.geometry = patch.geometry;
  if (patch.notes !== undefined) set.notes = patch.notes;
  if (Object.keys(set).length === 0) return;
  await db.update(stripProducts).set(set).where(eq(stripProducts.id, id));
  await recordAudit({ actor, action: "strip_product.update", entityType: "strip_product", entityId: id, detail: { patch: set } });
}

export async function getBatch(id: string): Promise<StripBatch | null> {
  const db = await getDb();
  const rows = await db.select().from(stripBatches).where(eq(stripBatches.id, id)).limit(1);
  return rows[0] ?? null;
}
