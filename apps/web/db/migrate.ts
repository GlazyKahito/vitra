/**
 * Applies db/migrations/*.sql in filename order, tracking them in `_migrations`.
 *   tsx db/migrate.ts            apply pending migrations
 *   tsx db/migrate.ts --reset    PGlite: delete the data directory; Postgres: drop all VITRA tables; then re-apply
 */
import "./load-env";
import { promises as fs } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { closeDb, execRaw, getDb, PGLITE_DIR, type Db } from "@/lib/db";

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");

const ALL_TABLES = [
  "app_settings",
  "audit_events",
  "reports",
  "clinical_reviews",
  "analyte_results",
  "colour_features",
  "pad_segmentations",
  "analysis_runs",
  "reference_measurements",
  "model_evaluations",
  "calibration_models",
  "calibration_datasets",
  "images",
  "samples",
  "device_events",
  "devices",
  "analyte_definitions",
  "strip_batches",
  "strip_products",
  "sessions",
  "users",
  "role_permissions",
  "permissions",
  "roles",
  "_migrations",
];

export async function dropAllTables(db: Db): Promise<void> {
  for (const t of ALL_TABLES) await execRaw(db, `DROP TABLE IF EXISTS "${t}" CASCADE`);
}

export async function runMigrations(db?: Db, log: (s: string) => void = console.log): Promise<string[]> {
  const d = db ?? (await getDb());
  await execRaw(d, `CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
  const applied = new Set<string>();
  const rows = await d.execute(sql`SELECT name FROM _migrations`);
  for (const r of rows.rows as { name: string }[]) applied.add(r.name);

  const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  const done: string[] = [];
  for (const f of files) {
    if (applied.has(f)) continue;
    const text = await fs.readFile(path.join(MIGRATIONS_DIR, f), "utf8");
    log(`applying ${f}`);
    await execRaw(d, text);
    await d.execute(sql`INSERT INTO _migrations (name) VALUES (${f})`);
    done.push(f);
  }
  if (done.length === 0) log("no pending migrations");
  return done;
}

async function main(): Promise<void> {
  const reset = process.argv.includes("--reset");
  if (reset) {
    if (process.env.DATABASE_URL) {
      const db = await getDb();
      console.log("dropping all tables");
      await dropAllTables(db);
    } else {
      console.log(`removing ${PGLITE_DIR}`);
      await fs.rm(PGLITE_DIR, { recursive: true, force: true });
    }
  }
  const db = await getDb();
  await runMigrations(db);
  console.log("migrations complete");
}

const isDirect = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(process.cwd(), "db", "migrate.ts");
if (isDirect) {
  main()
    .then(() => closeDb())
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error(err);
      await closeDb();
      process.exit(1);
    });
}
