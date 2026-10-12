import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";
import { mkdirSync } from "node:fs";
import { schema } from "@/db/schema";
import { defaultPgliteDir, isEphemeralDemo } from "@/lib/runtime-mode";

export type Db = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;

declare global {
  var __vitraDb: Promise<Db> | undefined;
}

/**
 * PGlite data directory.
 * - PGLITE_DIR env wins.
 * - Ephemeral demo (Vercel without DATABASE_URL): /tmp/vitra-pglite.
 * - Otherwise: <cwd>/.data/pglite.
 */
export const PGLITE_DIR = defaultPgliteDir();

/**
 * Returns the shared Drizzle instance.
 * - DATABASE_URL set → node-postgres pool against a real PostgreSQL 15+ server. This is the primary,
 *   production path (e.g. Neon / Vercel Postgres); run `npm run db:migrate && npm run db:seed` against it once.
 * - otherwise → embedded PGlite (PostgreSQL compiled to WASM), persisted under PGLITE_DIR, for local dev.
 *   On Vercel without DATABASE_URL this is a TEMPORARY DEMO FALLBACK only: the first call in a cold
 *   instance applies migrations and the seed into /tmp, and all data is lost when the instance recycles.
 */
export function getDb(): Promise<Db> {
  if (!globalThis.__vitraDb) {
    const p = createDb();
    globalThis.__vitraDb = p;
    // Do not cache a failed initialisation: the next request retries instead of failing forever.
    p.catch(() => {
      if (globalThis.__vitraDb === p) globalThis.__vitraDb = undefined;
    });
  }
  return globalThis.__vitraDb;
}

type PgSsl = false | { rejectUnauthorized: boolean };

const SSL_URL_PARAMS = ["sslmode", "ssl", "sslcert", "sslkey", "sslrootcert", "uselibpqcompat"];

/**
 * Resolves TLS for node-postgres from, in order: DATABASE_SSL ("true"/"false"), PGSSLMODE, and the URL's
 * `sslmode` / `ssl` query parameter. Returns undefined when nothing asks for TLS (plain local Postgres).
 * Hosted providers (Neon, Vercel Postgres) use `?sslmode=require`; certificates are verified by default.
 * DATABASE_SSL_REJECT_UNAUTHORIZED=false relaxes verification for providers with a private CA.
 */
export function resolvePgSsl(url: string, env: NodeJS.ProcessEnv = process.env): PgSsl | undefined {
  let urlMode: string | null = null;
  try {
    const u = new URL(url);
    urlMode = u.searchParams.get("sslmode") ?? (u.searchParams.get("ssl") === "true" ? "require" : u.searchParams.get("ssl") === "false" ? "disable" : null);
  } catch {
    /* non-URL connection string: leave TLS to pg's own parsing */
  }
  const flag = env.DATABASE_SSL?.trim().toLowerCase();
  const mode = flag === "true" || flag === "1" ? "require" : flag === "false" || flag === "0" ? "disable" : (env.PGSSLMODE?.trim().toLowerCase() || urlMode);
  if (!mode || mode === "prefer" || mode === "allow") return undefined;
  if (mode === "disable") return false;
  return { rejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED?.trim().toLowerCase() !== "false" };
}

/** pg lets URL ssl params override the `ssl` option, so drop them once TLS has been resolved explicitly. */
function stripSslParams(url: string): string {
  try {
    const u = new URL(url);
    for (const k of SSL_URL_PARAMS) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return url;
  }
}

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) {
    // Primary / production path: a real PostgreSQL 15+ server via node-postgres.
    const { Pool } = await import("pg");
    const ssl = resolvePgSsl(url);
    const pool = new Pool({ connectionString: ssl === undefined ? url : stripSslParams(url), max: Number(process.env.DATABASE_POOL_MAX ?? 8), ssl });
    return drizzlePg(pool, { schema });
  }
  // Fallback: embedded PGlite. Local development by default; on Vercel without DATABASE_URL it is only a
  // temporary, per-instance demo database under /tmp (see lib/runtime-mode.ts).
  // PGlite's Node filesystem adapter only calls a non-recursive mkdirSync(dataDir) when the directory is
  // missing, which fails with ENOENT when the parent (e.g. .data/) does not exist yet. Create the full
  // path first. Harmless if it already exists.
  mkdirSync(PGLITE_DIR, { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite(PGLITE_DIR);
  await client.waitReady;
  const db = drizzlePglite(client, { schema });
  if (isEphemeralDemo()) await bootstrapEphemeral(db);
  return db;
}

/**
 * Ephemeral demo bootstrap: apply pending migrations, then seed if this data directory has never been
 * seeded. Runs at most once per instance because getDb() memoises the promise that awaits it.
 */
async function bootstrapEphemeral(db: Db): Promise<void> {
  const started = Date.now();
  const log = (s: string) => console.log(`[vitra:demo-bootstrap] ${s}`);
  const { runMigrations } = await import("@/db/migrate");
  await runMigrations(db, log);
  const { sql } = await import("drizzle-orm");
  const res = await db.execute(sql`SELECT 1 FROM app_settings WHERE key = 'seed.version' LIMIT 1`);
  if ((res.rows as unknown[]).length === 0) {
    const { seed } = await import("@/db/seed");
    await seed(db, log);
  } else {
    log("already seeded");
  }
  log(`ready in ${Date.now() - started} ms`);
}

/** Closes the shared pool / PGlite instance (CLI scripts call this before exiting). */
export async function closeDb(): Promise<void> {
  const p = globalThis.__vitraDb;
  globalThis.__vitraDb = undefined;
  if (!p) return;
  try {
    const client = (await p as { $client?: { end?: () => Promise<void>; close?: () => Promise<void> } }).$client;
    if (client?.end) await client.end();
    else if (client?.close) await client.close();
  } catch {
    /* initialisation failed or already closed */
  }
}

/**
 * Raw SQL executor used by the migrator (works on both drivers). Migration files hold many statements:
 * PGlite's query() uses the extended protocol (one statement per prepared statement), so multi-statement
 * text goes through PGlite.exec(). node-postgres runs parameterless text via the simple protocol, which
 * accepts multiple statements.
 */
export async function execRaw(db: Db, sqlText: string): Promise<void> {
  const client = (db as { $client?: unknown }).$client as { exec?: (q: string) => Promise<unknown> } | undefined;
  if (client && typeof client.exec === "function") {
    await client.exec(sqlText);
    return;
  }
  const { sql } = await import("drizzle-orm");
  await db.execute(sql.raw(sqlText));
}
