/**
 * Full analysis flow: /analysis/new → synthetic demo strip → untimed override → submit →
 * /analysis/<id> with ten result rows and state chips; then history CSV export, review note,
 * and PDF report generation for the new run.
 *
 * REQUIRES THE CV SERVICE RUNNING ON :8001 (`cd services/cv && python run.py`):
 * the synthetic strip is rendered by POST /v1/synthetic/strip and the run is analysed by
 * POST /v1/analyze. Without it the "Use synthetic demo strip" button fails.
 */
import { expect, test } from "@playwright/test";
import { expectNoAppError, login } from "./_helpers";

const RESULT_STATE_LABELS = [
  "Measured",
  "Experimental estimate",
  "Synthetic demo value",
  "Outside calibrated range",
  "Indeterminate",
  "Invalid image",
  "Inference unavailable",
  "Calibration required",
];

test.describe.configure({ mode: "serial" });

let runUrl: string | null = null;

test("new analysis with a synthetic demo strip and untimed override lands on the result page", async ({ page }) => {
  await login(page);
  await page.goto("/analysis/new");

  // A / Sample + strip. Register a fresh pseudonymous sample so the test never depends on seed ids.
  await page.getByRole("button", { name: "Register new sample" }).click();
  const code = page.getByLabel("Sample code");
  await expect(code).toHaveValue(/.{3,}/);
  await page.getByLabel("Subject pseudonym").fill("E2E-SUBJ");
  await page.getByRole("button", { name: "Continue to timer" }).click();

  // B / Reaction timer: acknowledge an untimed capture rather than waiting 120 s.
  await page.getByRole("checkbox", { name: /Untimed capture/ }).check();
  await page.getByRole("button", { name: "Continue to image" }).click();

  // C / Image: synthetic strip from the CV service.
  await page.getByRole("button", { name: "Use synthetic demo strip" }).click();
  await expect(page.getByText(/synthetic/i).first()).toBeVisible();

  const start = page.getByRole("button", { name: "Start analysis" });
  await expect(start).toBeEnabled({ timeout: 30_000 });
  await start.click();

  await page.waitForURL(/\/analysis\/[^/]+$/, { timeout: 90_000 });
  runUrl = page.url();
  await expectNoAppError(page);

  // Ten analyte rows, each carrying a state chip from the honesty policy.
  const rows = page.locator("table.table-instrument tbody tr");
  await expect(rows).toHaveCount(10);
  for (const analyte of ["Glucose", "Protein", "pH", "Ketones", "Blood", "Bilirubin", "Urobilinogen", "Nitrite", "Leucocytes", "Specific gravity"]) {
    await expect(rows.getByText(analyte, { exact: true }).first()).toBeVisible();
  }
  const chipPattern = new RegExp(RESULT_STATE_LABELS.join("|"));
  await expect(rows.getByText(chipPattern).first()).toBeVisible();
  expect(await rows.getByText(chipPattern).count()).toBeGreaterThanOrEqual(10);

  // The run came from a synthetic strip, so it must be labelled as such, and untimed.
  await expect(page.getByText("SYNTHETIC").first()).toBeVisible();
  await expect(page.getByText(/untimed/i).first()).toBeVisible();
});

test("history export downloads a CSV", async ({ page }) => {
  await login(page);
  await page.goto("/history");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: "Export CSV" }).click()]);
  expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  const path = await download.path();
  expect(path).not.toBeNull();
  await expectNoAppError(page);
});

test("review queue accepts a decision with a note", async ({ page }) => {
  await login(page);
  await page.goto("/review");
  // Open the most recent pending item (the run created above is pending_review).
  const firstRow = page.getByRole("button").filter({ hasText: /RUN-|VTR-|run/i }).first();
  await firstRow.click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await drawer.getByRole("radio").first().check();
  await drawer.getByPlaceholder("Observations, reasons, follow-up…").fill("E2E review note — synthetic run, pipeline check only.");
  await drawer.getByRole("button", { name: "Submit decision" }).click();
  await expect(drawer).toBeHidden({ timeout: 15_000 });
  await expectNoAppError(page);
});

test("reports page generates a PDF whose download is application/pdf", async ({ page, request }) => {
  await login(page);
  await page.goto("/reports");
  // Field labels on this panel are not wired with htmlFor, so locate the select by its option text.
  const format = page.locator("select").filter({ has: page.locator("option[value='pdf']") });
  await format.selectOption("pdf");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  const link = page.getByRole("link", { name: "Download PDF" });
  await expect(link).toBeVisible({ timeout: 30_000 });

  const [download] = await Promise.all([page.waitForEvent("download"), link.click()]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);

  // Verify the content type served by the API route with the same session cookies.
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  const res = await request.get(href!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("application/pdf");
  const body = await res.body();
  expect(body.subarray(0, 4).toString()).toBe("%PDF");
  await expectNoAppError(page);
});

test("result page is reachable again by its URL", async ({ page }) => {
  test.skip(!runUrl, "run was not created in this session");
  await login(page);
  const res = await page.goto(runUrl!);
  expect(res?.status()).toBe(200);
  await expect(page.locator("table.table-instrument tbody tr")).toHaveCount(10);
});
