import type { Page } from "@playwright/test";
import analysis from "./fixtures/ops-destructive/analysis.json" with { type: "json" };
import graph from "./fixtures/ops-destructive/graph.json" with { type: "json" };
import findings from "./fixtures/ops-destructive/findings.json" with { type: "json" };
import finding001 from "./fixtures/ops-destructive/finding-001.json" with { type: "json" };
import recommendations from "./fixtures/ops-destructive/recommendations.json" with { type: "json" };
import simulate from "./fixtures/ops-destructive/simulate.json" with { type: "json" };

export const API_ORIGIN = process.env.NEXT_PUBLIC_AGENTHOUND_API_URL ?? "http://localhost:8000";

// Real backend responses for examples/03_ops_destructive/langgraph.yaml.
export const OPS_DESTRUCTIVE_ID = analysis.analysis_id;

const OPS_DESTRUCTIVE: Record<string, unknown> = {
  [`GET /analyses/${OPS_DESTRUCTIVE_ID}`]: analysis,
  [`GET /analyses/${OPS_DESTRUCTIVE_ID}/graph`]: graph,
  [`GET /analyses/${OPS_DESTRUCTIVE_ID}/findings`]: findings,
  [`GET /analyses/${OPS_DESTRUCTIVE_ID}/findings/finding_001`]: finding001,
  [`GET /analyses/${OPS_DESTRUCTIVE_ID}/controls/recommendations`]: recommendations,
  [`POST /analyses/${OPS_DESTRUCTIVE_ID}/simulate-controls`]: simulate,
};

// Cross-origin backend: mocked responses still need CORS headers and the preflight.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function mockOpsDestructiveAnalysis(page: Page) {
  await page.route(`${API_ORIGIN}/**`, (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const body = OPS_DESTRUCTIVE[`${request.method()} ${new URL(request.url()).pathname}`];
    if (body === undefined) {
      return route.fulfill({
        status: 404,
        headers: CORS,
        contentType: "application/json",
        body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Not mocked" } }),
      });
    }
    return route.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });
  });
}
