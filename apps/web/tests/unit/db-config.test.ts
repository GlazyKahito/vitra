import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolvePgSsl } from "@/lib/db";
import { defaultPgliteDir, defaultStorageDir, isEphemeralDemo } from "@/lib/runtime-mode";

const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;

describe("resolvePgSsl (DATABASE_URL TLS)", () => {
  it("leaves plain local URLs alone", () => {
    expect(resolvePgSsl("postgres://u:p@localhost:5432/vitra", env({}))).toBeUndefined();
  });
  it("verifies certificates for sslmode=require (Neon / Vercel Postgres)", () => {
    expect(resolvePgSsl("postgres://u:p@ep-x.neon.tech/db?sslmode=require", env({}))).toEqual({ rejectUnauthorized: true });
  });
  it("honours sslmode=disable and ssl=true in the URL", () => {
    expect(resolvePgSsl("postgres://u:p@h/db?sslmode=disable", env({}))).toBe(false);
    expect(resolvePgSsl("postgres://u:p@h/db?ssl=true", env({}))).toEqual({ rejectUnauthorized: true });
  });
  it("PGSSLMODE overrides the URL; DATABASE_SSL overrides both", () => {
    expect(resolvePgSsl("postgres://u:p@h/db?sslmode=disable", env({ PGSSLMODE: "require" }))).toEqual({ rejectUnauthorized: true });
    expect(resolvePgSsl("postgres://u:p@h/db?sslmode=require", env({ DATABASE_SSL: "false" }))).toBe(false);
    expect(resolvePgSsl("postgres://u:p@h/db", env({ DATABASE_SSL: "true" }))).toEqual({ rejectUnauthorized: true });
  });
  it("can relax verification explicitly", () => {
    expect(resolvePgSsl("postgres://u:p@h/db?sslmode=require", env({ DATABASE_SSL_REJECT_UNAUTHORIZED: "false" }))).toEqual({ rejectUnauthorized: false });
  });
});

describe("runtime mode (temporary Vercel demo fallback)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is off locally and whenever DATABASE_URL is set", () => {
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VITRA_EPHEMERAL_DEMO", "");
    vi.stubEnv("DATABASE_URL", "");
    expect(isEphemeralDemo()).toBe(false);
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("DATABASE_URL", "postgres://u:p@h/db");
    expect(isEphemeralDemo()).toBe(false);
  });

  it("is on for Vercel without DATABASE_URL and moves data under the temp dir", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("PGLITE_DIR", "");
    vi.stubEnv("STORAGE_DIR", "");
    expect(isEphemeralDemo()).toBe(true);
    expect(path.basename(defaultPgliteDir())).toBe("vitra-pglite");
    expect(path.basename(defaultStorageDir())).toBe("vitra-storage");
    expect(defaultPgliteDir().startsWith(process.cwd())).toBe(false);
  });

  it("explicit PGLITE_DIR / STORAGE_DIR always win", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("PGLITE_DIR", "/custom/pg");
    vi.stubEnv("STORAGE_DIR", "/custom/storage");
    expect(defaultPgliteDir()).toBe(path.resolve("/custom/pg"));
    expect(defaultStorageDir()).toBe(path.resolve("/custom/storage"));
  });
});

describe("storage defaults and bundled fixtures", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses a writable temp dir on Vercel even when DATABASE_URL is set", () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("DATABASE_URL", "postgres://u:p@h/db?sslmode=require");
    vi.stubEnv("STORAGE_DIR", "");
    expect(isEphemeralDemo()).toBe(false);
    expect(path.basename(defaultStorageDir())).toBe("vitra-storage");
  });

  it("maps only the six seeded fixture paths to the bundled copies", async () => {
    const { bundledFixturePath } = await import("@/lib/storage");
    expect(bundledFixturePath("images/seed-fixtures/synthetic_strip_03.png")).toBe(path.join(process.cwd(), "db", "fixtures", "strips", "synthetic_strip_03.png"));
    expect(bundledFixturePath("images/seed-fixtures/../../secret.png")).toBeNull();
    expect(bundledFixturePath("images/other.png")).toBeNull();
    expect(bundledFixturePath("images/seed-fixtures/synthetic_strip_07.png")).toBeNull();
  });
});
