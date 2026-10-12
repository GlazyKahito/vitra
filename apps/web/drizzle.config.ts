import { defineConfig } from "drizzle-kit";

// Used for `drizzle-kit studio` / future `drizzle-kit generate` against a real Postgres.
// The shipped migrations in db/migrations are hand-written SQL applied by db/migrate.ts.
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/drizzle-out",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://vitra:vitra@localhost:5432/vitra" },
});
