import { test, expect, type Page } from "@playwright/test";
import { mockOpsDestructiveAnalysis, OPS_DESTRUCTIVE_ID } from "./mocks";

const warnings = (page: Page) => page.getByTestId("coverage-warnings");
const header = (page: Page) => warnings(page).locator("[aria-expanded]");

async function openResults(page: Page) {
  await page.goto(`/tests/${OPS_DESTRUCTIVE_ID}`);
  await warnings(page).waitFor();
  await page.evaluate(() => document.fonts.ready);
}

test.beforeEach(async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "agenthound-lang", value: "es", url: baseURL! }]);
  await mockOpsDestructiveAnalysis(page);
});

test.describe("Coverage warnings", () => {
  test("flags a framework file's rules out of reach, collapsed above the tabs", async ({ page }) => {
    await openResults(page);

    await expect(header(page)).toHaveAttribute("aria-expanded", "false");
    await expect(header(page)).toContainText("Cobertura parcial de reglas");
    await expect(header(page)).toContainText("12 reglas con alcance limitado en este formato");
    const warningsBottom = await warnings(page).evaluate((el) => el.getBoundingClientRect().bottom);
    const tabsTop = await page.getByRole("tablist").evaluate((el) => el.getBoundingClientRect().top);
    expect(warningsBottom).toBeLessThan(tabsTop);
    await expect(warnings(page)).toHaveScreenshot("coverage-warnings-collapsed.png");
  });

  test("lists the unreachable rules and the declarations that unlock the rest", async ({ page }) => {
    await openResults(page);
    await header(page).click();

    await expect(warnings(page)).toContainText("FH-006, FH-015, FH-031, FH-030");
    await expect(warnings(page)).toContainText("FH-013: depende de recipient_type");
    await expect(warnings(page)).toHaveScreenshot("coverage-warnings-expanded.png");
  });

  test("explains each rule with the backend's message in English", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "agenthound-lang", value: "en", url: baseURL! }]);
    await openResults(page);
    await header(page).click();

    await expect(warnings(page)).toContainText("FH-015: No adapter emits the interpretIntent verb.");
    await expect(warnings(page)).toContainText("FH-025: Declare boundary: external (or trust_level: untrusted)");
    await expect(warnings(page).locator("code", { hasText: "trust_level: trusted_core" })).toBeVisible();
    await expect(warnings(page)).toHaveScreenshot("coverage-warnings-expanded-en.png");
  });

  test("reads in dark mode", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("colorScheme", "dark"));
    await openResults(page);
    await header(page).click();

    await expect(warnings(page)).toHaveScreenshot("coverage-warnings-expanded-dark.png");
  });
});
