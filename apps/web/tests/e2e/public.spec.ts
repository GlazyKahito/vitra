/**
 * Public pages: landing + methodology.
 * Requires: web app on :3000 (seeded). The CV service on :8001 is not needed for this file,
 * but the full suite assumes it is running — see tests/README.md.
 */
import { expect, test } from "@playwright/test";
import { expectNoAppError } from "./_helpers";

test.describe("landing", () => {
  test("renders the hero headline and both CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Turn reagent colours into measurable data.");
    await expect(page.getByRole("link", { name: "Open Analysis Console" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore the Methodology" }).first()).toBeVisible();
    await expect(page.getByText("KJS-HC-03")).toBeVisible();
    await expectNoAppError(page);
  });

  test("console CTA routes unauthenticated visitors to login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Open Analysis Console" }).first().click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("methodology", () => {
  test("renders all eleven numbered steps", async ({ page }) => {
    await page.goto("/methodology");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("From a controlled photograph to a number with a state.");
    await expect(page.getByRole("heading", { name: "Eleven steps, in order." })).toBeVisible();
    const steps = page.locator("ol > li");
    await expect(steps).toHaveCount(11);
    for (const title of [
      "Sample and strip preparation",
      "Timed reaction",
      "Controlled image acquisition",
      "Image-quality validation",
      "Strip localization",
      "Ten-pad segmentation",
      "RGB/CIELAB feature extraction",
      "Calibration",
      "Model inference",
      "Report generation",
      "Human review",
    ]) {
      await expect(steps.getByRole("heading", { level: 3, name: title, exact: true })).toBeVisible();
    }
    await expectNoAppError(page);
  });
});
