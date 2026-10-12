import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import path from "node:path";
import { schema } from "@/db/schema";

export type Db = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var __vitraDb: Promise<Db> | undefined;
}

export const PGLITE_DIR = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");

/**
 * Returns the shared Drizzle instance.
 * - DATABASE_URL set → node-postgres pool against a real PostgreSQL.
 * - otherwise → embedded PGlite (PostgreSQL compiled to WASM), persisted under .data/pglite.
 */
export function getDb(): Promise<Db> {
  if (!globalThis.__vitraDb) globalThis.__vitraDb = createDb();
  return globalThis.__vitraDb;
}

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 8, ssl: url.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined });
    return drizzlePg(pool, { schema });
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite(PGLITE_DIR);
  await client.waitReady;
  return drizzlePglite(client, { schema });
}

/** Raw SQL executor used by the migrator (works on both drivers). */
export async function execRaw(db: Db, sqlText: string): Promise<void> {
  const { sql } = await import("drizzle-orm");
  await db.execute(sql.raw(sqlText));
}
