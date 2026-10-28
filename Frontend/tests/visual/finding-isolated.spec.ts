import { test, expect, type Page } from "@playwright/test";
import { API_ORIGIN, mockOpsDestructiveAnalysis, OPS_DESTRUCTIVE_ID } from "./mocks";

async function openResults(page: Page) {
  await page.goto(`/tests/${OPS_DESTRUCTIVE_ID}`);
  await page.getByTestId("prioritized-finding").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
}

const canvas = (page: Page) => page.locator("[data-ch-canvas]");
const routePanel = (page: Page) => canvas(page).getByRole("status");
const row = (page: Page, label: string) =>
  page.getByTestId("prioritized-finding").filter({ hasText: new RegExp(`^${label}(?!\\d)`) });
const nodeIds = async (page: Page) =>
  (await canvas(page).locator(".react-flow__node").evaluateAll((els) => els.map((el) => el.dataset.id ?? ""))).sort();

const FH_011_1_ROUTE = [
  "agent_ops_executor",
  "agent_ticket_intake",
  "asset_customer_records_delete_resource",
  "input_inbound_maintenance_ticket_email",
  "tool_customer_records_delete",
];

test.beforeEach(async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "agenthound-lang", value: "es", url: baseURL! }]);
  await mockOpsDestructiveAnalysis(page);
});

test.describe("Isolated finding", () => {
  test("offers isolation only once a finding is selected", async ({ page }) => {
    await openResults(page);
    await expect(canvas(page).getByRole("button", { name: "Aislar ruta" })).toHaveCount(0);

    await row(page, "FH-011 #1").click();

    await expect(canvas(page).getByRole("button", { name: "Aislar ruta" })).toBeVisible();
  });

  test("draws only the finding's own nodes and edges from its endpoint", async ({ page }) => {
    await openResults(page);
    await row(page, "FH-011 #1").click();
    const request = page.waitForRequest(`${API_ORIGIN}/analyses/${OPS_DESTRUCTIVE_ID}/findings/finding_001`);

    await canvas(page).getByRole("button", { name: "Aislar ruta" }).click();
    await request;

    await expect(routePanel(page)).toContainText("Hallazgo aislado");
    await expect(routePanel(page)).toContainText("FH-011 #1");
    await expect.poll(() => nodeIds(page)).toEqual(FH_011_1_ROUTE);
    await expect(canvas(page).locator(".react-flow__edge")).toHaveCount(4);
    await expect(canvas(page).locator(".ch-dim, .ch-hl")).toHaveCount(0);
    await expect(canvas(page)).toHaveScreenshot("graph-fh-011-1-isolated.png");
  });

  test("plays the isolated route", async ({ page }) => {
    await openResults(page);
    await row(page, "FH-011 #1").click();
    await canvas(page).getByRole("button", { name: "Aislar ruta" }).click();
    await expect(routePanel(page)).toContainText("Hallazgo aislado");

    await canvas(page).getByRole("button", { name: "Reproducir FH-011 #1" }).click();

    await expect(routePanel(page)).toContainText("Reproduciendo ruta");
    await expect(canvas(page).locator(".react-flow__node.ch-current")).toHaveCount(1);
  });

  test("goes back to the whole graph in context and with “Ver todo”", async ({ page }) => {
    await openResults(page);
    await row(page, "FH-011 #1").click();
    await canvas(page).getByRole("button", { name: "Aislar ruta" }).click();
    await expect.poll(() => nodeIds(page)).toEqual(FH_011_1_ROUTE);

    await canvas(page).getByRole("button", { name: "Ver en contexto" }).click();

    await expect(canvas(page).locator(".react-flow__node")).toHaveCount(9);
    await expect(routePanel(page)).toContainText("Ruta resaltada");

    await canvas(page).getByRole("button", { name: "Aislar ruta" }).click();
    await expect.poll(() => nodeIds(page)).toEqual(FH_011_1_ROUTE);
    await routePanel(page).getByRole("button", { name: /Ver todo/ }).click();

    await expect(routePanel(page)).toHaveCount(0);
    await expect(canvas(page).locator(".react-flow__node")).toHaveCount(9);
  });

  test("isolates without leaving fullscreen", async ({ page }) => {
    await openResults(page);
    await row(page, "FH-011 #1").click();
    await canvas(page).getByRole("button", { name: "Pantalla completa" }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.hasAttribute("data-ch-canvas"))).toBe(true);

    await canvas(page).getByRole("button", { name: "Aislar ruta" }).click();

    await expect.poll(() => nodeIds(page)).toEqual(FH_011_1_ROUTE);
    await expect(routePanel(page)).toContainText("Hallazgo aislado");
    await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
    await expect(page).toHaveScreenshot("graph-fh-011-1-isolated-fullscreen.png");

    await canvas(page).getByRole("button", { name: "Ver en contexto" }).click();

    await expect(canvas(page).locator(".react-flow__node")).toHaveCount(9);
    await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true);
  });

  test("keeps the isolated route legible in dark mode", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("colorScheme", "dark"));
    await openResults(page);
    await row(page, "FH-011 #1").click();

    await canvas(page).getByRole("button", { name: "Aislar ruta" }).click();

    await expect.poll(() => nodeIds(page)).toEqual(FH_011_1_ROUTE);
    await expect(canvas(page)).toHaveScreenshot("graph-fh-011-1-isolated-dark.png");
  });

  test("keeps the whole graph and offers a retry when the subgraph cannot load", async ({ page }) => {
    await openResults(page);
    await row(page, "FH-011 #2").click();

    await canvas(page).getByRole("button", { name: "Aislar ruta" }).click();

    await expect(page.getByText("No se pudo cargar la ruta de este hallazgo.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
    await expect(canvas(page).locator(".react-flow__node")).toHaveCount(9);
  });
});
