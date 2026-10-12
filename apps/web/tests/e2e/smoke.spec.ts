/**
 * Smoke test: every primary route renders without an error page.
 *
 * Needs a migrated + seeded web app (npm run db:migrate && npm run db:seed). The CV service is optional:
 * pages that call it show "unavailable" states instead of failing.
 *
 *   npx playwright test tests/e2e/smoke.spec.ts                       (starts / reuses `npm run dev`)
 *   E2E_BASE_URL=http://localhost:3000 npx playwright test smoke     (against an already running server)
 */
import { expect, test, type Page, type Response } from "@playwright/test";
import { ADMIN } from "./_helpers";

const PUBLIC_ROUTES = ["/", "/methodology", "/login"] as const;
const APP_ROUTES = [
  "/console",
  "/analysis/new",
  "/analysis/R-000001", // seeded SYNTHETIC run (db/seed.ts)
  "/history",
  "/samples",
  "/review",
  "/reports",
  "/calibration",
  "/model-lab",
  "/devices",
  "/settings",
] as const;

const ERROR_TEXT = /Application error|Internal Server Error|Unhandled Runtime Error|This page could not be found|404: This page/i;

async function expectRendered(page: Page, res: Response | null, route: string): Promise<void> {
  expect(res, `no response for ${route}`).not.toBeNull();
  expect(res!.status(), `HTTP status for ${route}`).toBeLessThan(400);
  await expect(page.locator("body")).not.toHaveText(ERROR_TEXT, { timeout: 15_000 });
}

test.describe("smoke: public routes", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`renders ${route}`, async ({ page }) => {
      const res = await page.goto(route, { waitUntil: "domcontentloaded" });
      await expectRendered(page, res, route);
    });
  }
});

test.describe("smoke: signed-in routes (admin)", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  test("admin can sign in and open every app route", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ADMIN.email);
    await page.getByLabel("Password").fill(ADMIN.password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(/\/console/, { timeout: 60_000 });

    for (const route of APP_ROUTES) {
      await test.step(route, async () => {
        const res = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 90_000 });
        await expectRendered(page, res, route);
        expect(new URL(page.url()).pathname, `${route} redirected away`).toBe(route);
        await expect(page.getByText("Research prototype. Not a medical device. Not clinically validated.").first()).toBeVisible();
      });
    }
  });
});
