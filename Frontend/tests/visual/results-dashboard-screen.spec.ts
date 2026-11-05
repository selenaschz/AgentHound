import { test, expect, type Page } from "@playwright/test";
import {
  mockAnalysesList,
  mockAnalysesListError,
  mockOpsDestructiveAnalysis,
  OPS_DESTRUCTIVE_ID,
} from "./mocks";
import { showWholeScreen } from "./screen";

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
}

async function openDashboard(page: Page, ready: string) {
  await page.goto("/results");
  await page.getByText(ready, { exact: true }).first().waitFor();
  await settle(page);
}

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([{ name: "agenthound-lang", value: "es", url: baseURL! }]);
});

test.describe("Results dashboard screen", () => {
  test("aggregates the risk of every analyzed test", async ({ page }) => {
    await mockAnalysesList(page);
    await openDashboard(page, "Pruebas de mayor riesgo");

    await expect(page.getByText("50%", { exact: true })).toBeVisible();
    await expect(page.getByText("6.3", { exact: true })).toBeVisible();
    await expect(page.getByText("langgraph · puntuación máx. 10")).toBeVisible();
    await expect(page.getByText("2 pruebas · 30 hallazgos")).toBeVisible();
    await showWholeScreen(page);
    await expect(page).toHaveScreenshot("results-dashboard.png");
  });

  test("reads in English", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "agenthound-lang", value: "en", url: baseURL! }]);
    await mockAnalysesList(page);
    await openDashboard(page, "Highest-risk tests");

    await showWholeScreen(page);
    await expect(page).toHaveScreenshot("results-dashboard-en.png");
  });

  test("invites to run a first test when there are no results", async ({ page }) => {
    await mockAnalysesList(page, []);
    await openDashboard(page, "Aún no hay resultados");

    await expect(page.getByRole("button", { name: "Nueva prueba" })).toBeVisible();
    await expect(page).toHaveScreenshot("results-dashboard-empty.png");
  });

  test("offers a retry when the results can't be loaded", async ({ page }) => {
    await mockAnalysesListError(page);
    await openDashboard(page, "No se pudieron cargar tus resultados.");

    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
    await expect(page).toHaveScreenshot("results-dashboard-error.png");
  });

  test("opens a test from the ranking with a way back to the dashboard", async ({ page }) => {
    await mockOpsDestructiveAnalysis(page);
    await mockAnalysesList(page);
    await openDashboard(page, "Pruebas de mayor riesgo");

    await page.getByText("IT Ops Assistant (risky)").click();

    await expect(page).toHaveURL(`/tests/${OPS_DESTRUCTIVE_ID}?from=results`);
    await page.getByRole("button", { name: "Volver a resultados" }).click();
    await expect(page).toHaveURL("/results");
  });
});
