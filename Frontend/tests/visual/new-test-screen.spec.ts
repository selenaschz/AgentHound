import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import {
  mockAnalyze,
  mockCapabilities,
  mockCreateAnalysis,
  mockEndpointError,
  mockOpsDestructiveAnalysis,
  OPS_DESTRUCTIVE_ID,
} from "./mocks";
import { showWholeScreen } from "./screen";

const OPS_DESTRUCTIVE_YAML = path.join(__dirname, "../../../examples/03_ops_destructive/langgraph.yaml");

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

async function hydrated(page: Page) {
  await expect(page.locator('input[name="threat-model-name"]')).toHaveCount(1);
  await settle(page);
}

async function openNewTest(page: Page) {
  await page.goto("/tests/new");
  await page.getByRole("heading", { name: "Nueva prueba" }).waitFor();
  await hydrated(page);
}

async function fillConfiguration(page: Page) {
  await page.getByRole("textbox", { name: "Nombre del análisis" }).fill("IT Ops Assistant (risky)");
  await page.getByRole("button", { name: /^Framework/ }).click();
  await page.getByRole("option", { name: "LangGraph" }).click();
  await page.getByLabel("workflow.yaml", { exact: true }).setInputFiles(OPS_DESTRUCTIVE_YAML);
  await page.getByText("langgraph.yaml").waitFor();
}

async function analyzeArchitecture(page: Page) {
  await fillConfiguration(page);
  await page.getByRole("button", { name: "Analizar" }).click();
  await page.getByRole("heading", { name: "Arquitectura procesada" }).waitFor();
}

async function reachInference(page: Page) {
  await analyzeArchitecture(page);
  await page.getByRole("button", { name: "Siguiente" }).click();
  await page.getByRole("heading", { name: "Agentes y capacidades" }).waitFor();
}

test.beforeEach(async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "agenthound-lang", value: "es", url: baseURL! }]);
  await mockOpsDestructiveAnalysis(page);
  await mockCreateAnalysis(page);
  await mockAnalyze(page);
  await mockCapabilities(page);
});

test.describe("New test screen", () => {
  test("starts on the configuration step with the CrewAI agents and tasks files", async ({ page }) => {
    await openNewTest(page);

    await expect(page.getByText("agents.yaml")).toBeVisible();
    await expect(page.getByText("tasks.yaml")).toBeVisible();
    await expect(page.getByRole("button", { name: "Analizar" })).toBeDisabled();
    await expect(page).toHaveScreenshot("new-test-configuration.png");
  });

  test("reads in English", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "agenthound-lang", value: "en", url: baseURL! }]);
    await page.goto("/tests/new");
    await page.getByRole("heading", { name: "New test" }).waitFor();
    await hydrated(page);

    await expect(page).toHaveScreenshot("new-test-configuration-en.png");
  });

  test("flags the name once the field is left empty", async ({ page }) => {
    await openNewTest(page);

    await page.getByRole("textbox", { name: "Nombre del análisis" }).focus();
    await page.getByRole("textbox", { name: "Nombre del análisis" }).blur();

    await expect(page.getByRole("textbox", { name: "Nombre del análisis" })).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveScreenshot("new-test-configuration-validation.png");
  });

  test("asks for a single workflow file for LangGraph and enables the analysis once filled", async ({ page }) => {
    await openNewTest(page);

    await fillConfiguration(page);
    await page.mouse.move(0, 0);

    await expect(page.getByRole("heading", { name: "IT Ops Assistant (risky)" })).toBeVisible();
    await expect(page.getByText("tasks.yaml")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Analizar" })).toBeEnabled();
    await expect(page).toHaveScreenshot("new-test-configuration-filled.png");
  });

  test("parses the architecture before moving on", async ({ page }) => {
    await openNewTest(page);

    await analyzeArchitecture(page);
    await page.mouse.move(0, 0);

    await expect(page.getByText("100%")).toBeVisible();
    await expect(page.getByRole("button", { name: "Siguiente" })).toBeEnabled();
    await expect(page).toHaveScreenshot("new-test-processing-done.png");
  });

  test("shows the parse failure with a retry", async ({ page }) => {
    await mockEndpointError(page, "POST", "/analyses");
    await openNewTest(page);

    await fillConfiguration(page);
    await page.getByRole("button", { name: "Analizar" }).click();
    await page.getByRole("heading", { name: "El procesado ha fallado", level: 1 }).waitFor();
    await page.mouse.move(0, 0);

    await expect(page.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    await expect(page).toHaveScreenshot("new-test-processing-error.png");
  });

  test("lists every agent with the capabilities extracted from the YAML", async ({ page }) => {
    await openNewTest(page);

    await reachInference(page);
    await page.mouse.move(0, 0);

    await expect(page.getByTestId("coverage-warnings")).toBeVisible();
    await expect(page.getByRole("button", { name: "Editar agente" })).toHaveCount(2);
    await showWholeScreen(page);
    await expect(page).toHaveScreenshot("new-test-inference.png");
  });

  test("reads the agents step in English", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "agenthound-lang", value: "en", url: baseURL! }]);
    await page.goto("/tests/new");
    await page.getByRole("heading", { name: "New test" }).waitFor();
    await hydrated(page);

    await page.getByRole("textbox", { name: "Analysis name" }).fill("IT Ops Assistant (risky)");
    await page.getByRole("button", { name: /^Framework/ }).click();
    await page.getByRole("option", { name: "LangGraph" }).click();
    await page.getByLabel("workflow.yaml", { exact: true }).setInputFiles(OPS_DESTRUCTIVE_YAML);
    await page.getByRole("button", { name: "Analyze" }).click();
    await page.getByRole("heading", { name: "Architecture parsed" }).waitFor();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByRole("heading", { name: "Agents and capabilities" }).waitFor();
    await page.mouse.move(0, 0);

    await showWholeScreen(page);
    await expect(page).toHaveScreenshot("new-test-inference-en.png");
  });

  test("edits an agent's capabilities in a drawer", async ({ page }) => {
    await openNewTest(page);
    await reachInference(page);

    await page.getByRole("button", { name: "Editar agente" }).first().click();
    const drawer = page.getByRole("dialog");
    await drawer.getByTestId("unchecked-verbs").first().waitFor();
    await page.mouse.move(0, 0);

    await expect(drawer.getByRole("button", { name: "Guardar" })).toBeVisible();
    await expect(page).toHaveScreenshot("new-test-agent-edit.png");
  });

  test("shows the results of the analysis as the last step", async ({ page }) => {
    await openNewTest(page);
    await reachInference(page);

    await page.getByRole("button", { name: "Ver resultados" }).click();
    await canvas(page).locator(".react-flow__node").first().waitFor();

    await expect(page.getByRole("tab", { name: "Hallazgos (17)" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ver resultados" })).toHaveCount(0);
    await settledViewport(page);
    await showWholeScreen(page);
    await settledViewport(page);
    await page.mouse.move(0, 0);
    await expect(page).toHaveScreenshot("new-test-results.png");
  });

  test("stays on the agents step when the analysis fails", async ({ page }) => {
    await mockEndpointError(page, "POST", `/analyses/${OPS_DESTRUCTIVE_ID}/analyze`);
    await openNewTest(page);
    await reachInference(page);

    await page.getByRole("button", { name: "Ver resultados" }).click();
    await page.getByText("Internal server error").waitFor();
    await page.mouse.move(0, 0);

    await expect(page.getByRole("heading", { name: "Agentes y capacidades" })).toBeVisible();
    await showWholeScreen(page);
    await expect(page).toHaveScreenshot("new-test-analyze-error.png");
  });
});
