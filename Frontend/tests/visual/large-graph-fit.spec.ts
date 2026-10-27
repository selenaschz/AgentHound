import { test, expect, type Page } from "@playwright/test";
import graph from "./fixtures/ops-destructive/graph.json" with { type: "json" };
import { API_ORIGIN, mockOpsDestructiveAnalysis, OPS_DESTRUCTIVE_ID } from "./mocks";

const BRANCHES = 28;

// Grows the real graph to 64 nodes with tool → data branches off one agent: two
// tall dagre ranks that need well under the default 0.25 zoom to fit.
function largeGraph() {
  const nodes: object[] = [...graph.nodes];
  const edges: object[] = [...graph.edges];
  for (let i = 0; i < BRANCHES; i++) {
    const tool = `tool_extra_${i}`;
    const data = `asset_extra_${i}`;
    nodes.push(
      { id: tool, label: `extra tool ${i}`, type: "tool", risk_score: 1, properties: {}, badges: [] },
      { id: data, label: `extra data ${i}`, type: "data_asset", risk_score: 1, properties: {}, badges: [] },
    );
    edges.push(
      { ...graph.edges[0], id: `edge_extra_tool_${i}`, source: "agent_ops_executor", target: tool, finding_ids: [] },
      { ...graph.edges[1], id: `edge_extra_data_${i}`, source: tool, target: data, finding_ids: [] },
    );
  }
  return { nodes, edges };
}

const canvas = (page: Page) => page.locator("[data-ch-canvas]");

async function expectWholeGraphVisible(page: Page) {
  await expect(canvas(page).locator(".react-flow__node")).toHaveCount(graph.nodes.length + BRANCHES * 2);
  await expect(async () => {
    const frame = (await canvas(page).boundingBox())!;
    const boxes = await canvas(page).locator(".react-flow__node").evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect),
    );
    for (const b of boxes) {
      expect(b.top).toBeGreaterThanOrEqual(frame.y);
      expect(b.left).toBeGreaterThanOrEqual(frame.x);
      expect(b.bottom).toBeLessThanOrEqual(frame.y + frame.height);
      expect(b.right).toBeLessThanOrEqual(frame.x + frame.width);
    }
  }).toPass({ timeout: 5_000 });
}

const zoom = (page: Page) =>
  canvas(page).locator(".react-flow__viewport").evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a);

async function settledZoom(page: Page) {
  let previous = NaN;
  await expect.poll(async () => previous === (previous = await zoom(page)), { intervals: [250] }).toBe(true);
  return previous;
}

test.beforeEach(async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "agenthound-lang", value: "es", url: baseURL! }]);
  await mockOpsDestructiveAnalysis(page);
  const body = JSON.stringify(largeGraph());
  await page.route(`${API_ORIGIN}/analyses/${OPS_DESTRUCTIVE_ID}/graph`, (route) =>
    route.request().method() === "OPTIONS"
      ? route.fallback()
      : route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": "*" }, contentType: "application/json", body }),
  );
  await page.goto(`/tests/${OPS_DESTRUCTIVE_ID}`);
  await page.getByTestId("prioritized-finding").first().waitFor();
});

test.describe("Large graph fit", () => {
  test("fits the whole graph on load", async ({ page }) => {
    await expectWholeGraphVisible(page);
  });

  test("fits the whole graph again with Ajustar after zooming in", async ({ page }) => {
    await expectWholeGraphVisible(page);
    await canvas(page).hover();
    await page.mouse.wheel(0, -1200);

    await canvas(page).getByRole("button", { name: "Ajustar" }).click();

    await expectWholeGraphVisible(page);
  });

  test("does not snap past the fit when zooming out from it", async ({ page }) => {
    await expectWholeGraphVisible(page);
    const fit = await settledZoom(page);
    await canvas(page).hover();

    await page.mouse.wheel(0, 400);

    // Waits for the wheel to land, so a snap back up cannot be missed.
    await expect.poll(() => zoom(page)).not.toBe(fit);
    expect(await settledZoom(page)).toBeLessThan(fit);
    await expectWholeGraphVisible(page);
  });
});
