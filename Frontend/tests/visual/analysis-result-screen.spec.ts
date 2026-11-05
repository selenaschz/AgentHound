import { test, expect, type Page } from "@playwright/test";
import {
  DATA_CODEEXEC_ID,
  mockDataCodeExecAnalysis,
  mockEndpointError,
  mockOpsDestructiveAnalysis,
  OPS_DESTRUCTIVE_ID,
} from "./mocks";
import { showWholeScreen } from "./screen";

const canvas = (page: Page) => page.locator("[data-ch-canvas]");
const viewportTransform = (page: Page) =>
  canvas(page).locator(".react-flow__viewport").evaluate((el) => getComputedStyle(el).transform);

async function settledViewport(page: Page) {
  let previous = "";
  await expect.poll(async () => previous === (previous = await viewportTransform(page)), { intervals: [250] }).toBe(true);
}

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
}

async function openResult(page: Page, id: string, query = "") {
  await page.goto(`/tests/${id}${query}`);
  await canvas(page).locator(".react-flow__node").first().waitFor();
  await settle(page);
}

async function showGraphedScreen(page: Page) {
  await settledViewport(page);
  await showWholeScreen(page);
  await settledViewport(page);
  await page.mouse.move(0, 0);
}

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "agenthound-lang", value: "es", url: baseURL! }]);
});

test.describe("Analysis result screen", () => {
  test("shows the findings of a stored analysis with its graph, metrics and accordion", async ({ page }) => {
    await mockOpsDestructiveAnalysis(page);
    await openResult(page, OPS_DESTRUCTIVE_ID);

    await expect(page.getByRole("heading", { name: "IT Ops Assistant (risky)" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Hallazgos (17)" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "Volver al resumen" })).toBeVisible();
    await showGraphedScreen(page);
    await expect(page).toHaveScreenshot("analysis-findings.png");
  });

  test("reads in English", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "agenthound-lang", value: "en", url: baseURL! }]);
    await mockOpsDestructiveAnalysis(page);
    await openResult(page, OPS_DESTRUCTIVE_ID);

    await expect(page.getByRole("tab", { name: "Findings (17)" })).toBeVisible();
    await showGraphedScreen(page);
    await expect(page).toHaveScreenshot("analysis-findings-en.png");
  });

  test("shows the findings of another framework file's analysis", async ({ page }) => {
    await mockDataCodeExecAnalysis(page);
    await openResult(page, DATA_CODEEXEC_ID);

    await expect(page.getByRole("heading", { name: "Data Analysis Assistant (risky)" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Hallazgos (13)" })).toBeVisible();
    await showGraphedScreen(page);
    await expect(page).toHaveScreenshot("analysis-findings-data-codeexec.png");
  });

  test("shows the proposed solution with the mitigated graph and the before and after", async ({ page }) => {
    await mockOpsDestructiveAnalysis(page);
    await openResult(page, OPS_DESTRUCTIVE_ID);

    await page.getByRole("tab", { name: "Solución propuesta" }).click();

    await expect(page.getByRole("tab", { name: "Solución propuesta" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByTestId("coverage-warnings")).toHaveCount(0);
    await showGraphedScreen(page);
    await expect(page).toHaveScreenshot("analysis-solution.png");
  });

  test("reads the proposed solution in English", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "agenthound-lang", value: "en", url: baseURL! }]);
    await mockOpsDestructiveAnalysis(page);
    await openResult(page, OPS_DESTRUCTIVE_ID);

    await page.getByRole("tab", { name: "Proposed solution" }).click();

    await showGraphedScreen(page);
    await expect(page).toHaveScreenshot("analysis-solution-en.png");
  });

  test("keeps the findings usable but flags the solution when the simulation fails", async ({ page }) => {
    await mockOpsDestructiveAnalysis(page);
    await mockEndpointError(page, "POST", `/analyses/${OPS_DESTRUCTIVE_ID}/simulate-controls`);
    await openResult(page, OPS_DESTRUCTIVE_ID);

    await page.getByRole("tab", { name: "Solución propuesta" }).click();
    await page.mouse.move(0, 0);

    await expect(page.getByText("No se ha podido cargar el contenido. Inténtalo de nuevo.")).toBeVisible();
    await expect(canvas(page)).toHaveCount(0);
    await expect(page).toHaveScreenshot("analysis-solution-unavailable.png");
  });

  test("offers a retry when the analysis can't be loaded", async ({ page }) => {
    await mockOpsDestructiveAnalysis(page);
    await mockEndpointError(page, "GET", `/analyses/${OPS_DESTRUCTIVE_ID}/findings`);
    await page.goto(`/tests/${OPS_DESTRUCTIVE_ID}`);
    await page.getByText("No se pudieron cargar tus pruebas.").waitFor();
    await settle(page);

    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
    await expect(page).toHaveScreenshot("analysis-error.png");
  });

  test("returns to the results dashboard when opened from it", async ({ page }) => {
    await mockOpsDestructiveAnalysis(page);
    await openResult(page, OPS_DESTRUCTIVE_ID, "?from=results");

    await expect(page.getByRole("button", { name: "Volver a resultados" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Volver al resumen" })).toHaveCount(0);
  });
});
