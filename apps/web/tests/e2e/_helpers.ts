/**
 * Shared Playwright helpers for the VITRA e2e suite.
 *
 * PREREQUISITES (run locally — these were NOT executed in the build sandbox):
 *   1. CV service running on :8001        → cd services/cv && python run.py
 *   2. Web app seeded                      → cd apps/web && npm run db:migrate && npm run db:seed
 *   3. Web app running on :3000 (or set E2E_BASE_URL); playwright.config.ts starts `npm run dev`
 *      automatically when E2E_BASE_URL is unset.
 *
 * Seeded accounts come from db/seed.ts (passwords from .env.local SEED_* vars, defaults below).
 */
import { expect, type Page } from "@playwright/test";

export const ADMIN = {
  email: "admin@vitra.local",
  password: process.env.SEED_ADMIN_PASSWORD ?? "vitra-admin",
};

export const CLINICIAN = {
  email: "clinician@vitra.local",
  password: process.env.SEED_CLINICIAN_PASSWORD ?? "vitra-clinician",
};

/** Every route the app shell / public shell links to. */
export const NAV_ROUTES = [
  "/",
  "/methodology",
  "/login",
  "/console",
  "/analysis/new",
  "/history",
  "/samples",
  "/review",
  "/reports",
  "/calibration",
  "/model-lab",
  "/devices",
  "/settings",
] as const;

export async function login(page: Page, account = ADMIN): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: /sign in|log in|enter/i }).click();
  await page.waitForURL(/\/console/);
}

/** Asserts the Next.js client-side error boundary did not render. */
export async function expectNoAppError(page: Page): Promise<void> {
  await expect(page.getByText(/Application error/i)).toHaveCount(0);
  await expect(page.getByText(/Internal Server Error/i)).toHaveCount(0);
}

/** Footer honesty line that must appear on every app page. */
export const HONESTY_FOOTER = /Research prototype\. Not a medical device\. Not clinically validated\./;
