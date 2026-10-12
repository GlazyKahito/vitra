/**
 * Runtime-mode detection shared by the DB, storage and app shell.
 *
 * "Ephemeral demo" = running on Vercel (or another read-only serverless host that sets VITRA_EPHEMERAL_DEMO=1)
 * without a DATABASE_URL. In that mode the embedded PGlite database and the file store live under /tmp,
 * which is writable but per-instance and wiped on every cold start, so the app migrates and seeds itself
 * on first use and the UI says that data resets.
 *
 * Kept free of "server-only" and Next imports so tsx scripts (db/migrate.ts, db/seed.ts) can load it.
 */
import os from "node:os";
import path from "node:path";

export function isEphemeralDemo(): boolean {
  if (process.env.DATABASE_URL) return false;
  return Boolean(process.env.VERCEL) || process.env.VITRA_EPHEMERAL_DEMO === "1";
}

/** Base directory for ephemeral data: /tmp on Linux serverless hosts, the OS temp dir elsewhere. */
function ephemeralBase(): string {
  return process.platform === "win32" ? os.tmpdir() : "/tmp";
}

export function defaultPgliteDir(): string {
  if (process.env.PGLITE_DIR) return path.resolve(process.env.PGLITE_DIR);
  if (isEphemeralDemo()) return path.join(ephemeralBase(), "vitra-pglite");
  return path.join(process.cwd(), ".data", "pglite");
}

/**
 * File store root. On Vercel the deployment filesystem is read-only, so even with a DATABASE_URL the
 * default moves to /tmp (writable but NOT durable: uploads and reports need external storage for real use).
 */
export function defaultStorageDir(): string {
  if (process.env.STORAGE_DIR) return path.resolve(process.cwd(), process.env.STORAGE_DIR);
  if (isEphemeralDemo() || process.env.VERCEL) return path.join(ephemeralBase(), "vitra-storage");
  return path.resolve(process.cwd(), "storage");
}
