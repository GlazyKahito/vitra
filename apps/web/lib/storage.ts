import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { defaultStorageDir } from "@/lib/runtime-mode";

/**
 * Root for all stored files (images, reports, datasets). STORAGE_DIR env (relative paths resolve from the
 * app cwd) wins; ephemeral demo mode (Vercel without DATABASE_URL) uses /tmp/vitra-storage; default ./storage.
 */
export const STORAGE_DIR = defaultStorageDir();

export class StoragePathError extends Error {
  constructor(p: string) {
    super(`Refusing storage path outside STORAGE_DIR: ${p}`);
    this.name = "StoragePathError";
  }
}

/** Joins a relative path onto STORAGE_DIR, rejecting traversal and absolute paths. */
export function safeJoin(relPath: string): string {
  const cleaned = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  if (cleaned.length === 0 || cleaned.split("/").some((seg) => seg === ".." || seg === "." || seg === "")) {
    throw new StoragePathError(relPath);
  }
  const abs = path.resolve(STORAGE_DIR, cleaned);
  if (abs !== STORAGE_DIR && !abs.startsWith(STORAGE_DIR + path.sep)) throw new StoragePathError(relPath);
  return abs;
}

export function sha256(data: Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

export async function writeFile(relPath: string, data: Uint8Array | string): Promise<{ absPath: string; byteSize: number; sha256: string }> {
  const abs = safeJoin(relPath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
  await fs.writeFile(abs, buf);
  return { absPath: abs, byteSize: buf.byteLength, sha256: sha256(buf) };
}

/**
 * Seeded image rows point at images/seed-fixtures/synthetic_strip_0N.png. Those SYNTHETIC renders also ship
 * with the app in db/fixtures/strips, so they can still be served when the seed ran on another machine
 * (e.g. seeding a hosted PostgreSQL from a laptop while the app runs on Vercel).
 */
export function bundledFixturePath(relPath: string): string | null {
  const m = /^images\/seed-fixtures\/(synthetic_strip_0[1-6]\.png)$/.exec(relPath.replace(/\\/g, "/"));
  return m ? path.join(process.cwd(), "db", "fixtures", "strips", m[1]) : null;
}

export async function readFile(relPath: string): Promise<Buffer> {
  try {
    return await fs.readFile(safeJoin(relPath));
  } catch (err) {
    const fallback = bundledFixturePath(relPath);
    if (fallback) return fs.readFile(fallback);
    throw err;
  }
}

export async function readText(relPath: string): Promise<string> {
  return fs.readFile(safeJoin(relPath), "utf8");
}

export async function fileExists(relPath: string): Promise<boolean> {
  try {
    await fs.stat(safeJoin(relPath));
    return true;
  } catch {
    return false;
  }
}

export async function ensureStorageDirs(): Promise<void> {
  for (const d of ["images", "overlays", "strips", "reports", "datasets"]) {
    await fs.mkdir(path.join(STORAGE_DIR, d), { recursive: true });
  }
}

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".csv": "text/csv; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

export function contentTypeFor(p: string): string {
  return CONTENT_TYPES[path.extname(p).toLowerCase()] ?? "application/octet-stream";
}

export function extensionForMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/bmp":
      return "bmp";
    case "image/tiff":
      return "tiff";
    default:
      return "bin";
  }
}
