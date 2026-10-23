import { test, expect, type Page } from "@playwright/test";
import { mockOpsDestructiveAnalysis, OPS_DESTRUCTIVE_ID } from "./mocks";

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
}

async function openResults(page: Page) {
  await page.goto(`/tests/${OPS_DESTRUCTIVE_ID}`);
  await page.getByTestId("prioritized-finding").first().waitFor();
  await settle(page);
}

const prioritized = (page: Page) => page.getByTestId("prioritized-findings");
const canvas = (page: Page) => page.locator("[data-ch-canvas]");
const routePanel = (page: Page) => canvas(page).getByRole("status");
const row = (page: Page, label: string) =>
  page.getByTestId("prioritized-finding").filter({ hasText: new RegExp(`^${label}(?!\\d)`) });
const card = (page: Page, label: string) =>
  page.getByTestId("finding-card").filter({ hasText: new RegExp(`${label}(?!\\d)`) });

// Restacking the edges after a highlight shifts anti-aliasing slightly, hence the tolerance.
async function expectNormalView(page: Page) {
  await expect(routePanel(page)).toHaveCount(0);
  await expect(canvas(page).locator(".ch-hl, .ch-edge-hl, .ch-dim")).toHaveCount(0);
  await expect(canvas(page)).toHaveScreenshot("graph-default.png", { maxDiffPixelRatio: 0.005 });
}

async function openAttackGroup(page: Page) {
  await page.getByRole("button", { name: /Rutas de ataque/ }).click();
}

test.beforeEach(async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "agenthound-lang", value: "es", url: baseURL! }]);
  await mockOpsDestructiveAnalysis(page);
});

test.describe("Finding route highlight", () => {
  test("shows the full graph with numbered duplicates in the prioritized list", async ({ page }) => {
    await openResults(page);

    await expect(routePanel(page)).toHaveCount(0);
    await expect(row(page, "FH-011 #1")).toHaveCount(1);
    await expect(row(page, "FH-011 #2")).toHaveCount(1);
    await expect(canvas(page)).toHaveScreenshot("graph-default.png");
    await expect(prioritized(page)).toHaveScreenshot("prioritized-list-default.png");
  });

  test("singles out a finding's route from the prioritized list", async ({ page }) => {
    await openResults(page);

    await row(page, "FH-011 #1").click();

    await expect(routePanel(page)).toContainText("FH-011 #1");
    await expect(row(page, "FH-011 #1")).toHaveAttribute("aria-current", "true");
    await expect(canvas(page)).toHaveScreenshot("graph-fh-011-1.png");
    await expect(prioritized(page)).toHaveScreenshot("prioritized-list-fh-011-1-selected.png");
  });

  test("tells duplicates apart: the second FH-011 lights a different branch", async ({ page }) => {
    await openResults(page);
    await row(page, "FH-011 #1").click();
    await expect(routePanel(page)).toContainText("FH-011 #1");
    const first = await canvas(page).screenshot();

    await row(page, "FH-011 #2").click();

    await expect(routePanel(page)).toContainText("FH-011 #2");
    await expect(row(page, "FH-011 #1")).not.toHaveAttribute("aria-current", "true");
    await expect(canvas(page)).toHaveScreenshot("graph-fh-011-2.png");
    expect(await canvas(page).screenshot()).not.toEqual(first);
  });

  test("highlights a single-node finding from an accordion card and brings the graph into view", async ({ page }) => {
    await openResults(page);
    await openAttackGroup(page);
    await card(page, "FH-005 #1").scrollIntoViewIfNeeded();
    await expect(canvas(page)).not.toBeInViewport();

    await card(page, "FH-005 #1").click();

    await expect(canvas(page)).toBeInViewport();
    await expect(routePanel(page)).toContainText("FH-005 #1");
    await expect(card(page, "FH-005 #1")).toHaveAttribute("aria-current", "true");
    await expect(canvas(page).locator(".react-flow__node.ch-hl")).toHaveCount(1);
    await expect(canvas(page).locator(".react-flow__edge.ch-edge-hl")).toHaveCount(0);
    await expect(canvas(page).locator(".react-flow__edge:not(.ch-dim)")).toHaveCount(0);
    await expect(canvas(page)).toHaveScreenshot("graph-fh-005-1.png");
  });

  test("shows the selected accordion card", async ({ page }) => {
    await openResults(page);
    await openAttackGroup(page);

    await card(page, "FH-011 #2").click();

    await expect(card(page, "FH-011 #2")).toHaveScreenshot("card-fh-011-2-selected.png");
  });

  test("restores the full graph with “Ver todo”", async ({ page }) => {
    await openResults(page);
    await row(page, "FH-002").click();
    await expect(routePanel(page)).toBeVisible();

    await routePanel(page).getByRole("button", { name: /Ver todo/ }).click();

    await expect(row(page, "FH-002")).not.toHaveAttribute("aria-current", "true");
    await expectNormalView(page);
  });

  test("restores the full graph with Escape and with a second press", async ({ page }) => {
    await openResults(page);

    await row(page, "FH-002").click();
    await expect(routePanel(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expectNormalView(page);

    await row(page, "FH-002").click();
    await expect(routePanel(page)).toBeVisible();
    await row(page, "FH-002").click();
    await expectNormalView(page);
  });

  test("keeps the highlight legible in dark mode", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("colorScheme", "dark"));
    await openResults(page);

    await row(page, "FH-011 #2").click();

    await expect(routePanel(page)).toContainText("FH-011 #2");
    await expect(canvas(page)).toHaveScreenshot("graph-fh-011-2-dark.png");
  });
});
