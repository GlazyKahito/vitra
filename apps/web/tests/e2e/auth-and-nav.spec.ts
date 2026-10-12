/**
 * Login + console + every navigation route.
 * Requires: seeded web app on :3000 AND the CV service on :8001 (the console and devices pages
 * call the service for health; without it they still render but show "unavailable").
 */
import { expect, test } from "@playwright/test";
import { HONESTY_FOOTER, NAV_ROUTES, expectNoAppError, login } from "./_helpers";

test.describe("authentication", () => {
  test("rejects a wrong password", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("admin@vitra.local");
    await page.getByLabel("Password").fill("definitely-wrong");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/invalid|incorrect|wrong|failed/i).first()).toBeVisible();
  });

  test("seeded admin lands on the console with stats and SYNTHETIC tags", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/console/);
    // Stat band: computed from stored rows only. Seed data is entirely synthetic.
    await expect(page.getByText(/runs/i).first()).toBeVisible();
    await expect(page.getByText("SYNTHETIC", { exact: false }).first()).toBeVisible();
    await expect(page.getByText(HONESTY_FOOTER)).toBeVisible();
    await expectNoAppError(page);
  });

  test("protected routes redirect to login when signed out", async ({ page }) => {
    await page.goto("/console");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("navigation", () => {
  test("every nav route returns 200 and renders without an application error", async ({ page }) => {
    await login(page);
    for (const route of NAV_ROUTES) {
      const res = await page.goto(route);
      expect(res, `no response for ${route}`).not.toBeNull();
      expect(res!.status(), `status for ${route}`).toBe(200);
      await expectNoAppError(page);
      // Every app-shell page carries the honesty footer; public pages carry it too.
      if (route !== "/login") await expect(page.getByText(HONESTY_FOOTER).first()).toBeVisible();
    }
  });

  test("primary nav lists the workstation sections", async ({ page }) => {
    await login(page);
    const nav = page.getByRole("navigation", { name: "Primary" });
    for (const name of ["Console", "New analysis", "History", "Samples", "Review queue", "Reports", "Calibration", "Model lab", "Devices", "Methodology", "Settings"]) {
      await expect(nav.getByRole("link", { name: new RegExp(`^${name}$`, "i") })).toBeVisible();
    }
  });

  test("sign out returns to the public site", async ({ page }) => {
    await login(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.goto("/console");
    await expect(page).toHaveURL(/\/login/);
  });
});
