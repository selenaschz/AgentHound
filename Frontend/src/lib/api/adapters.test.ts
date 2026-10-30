import { describe, expect, it } from "vitest";

import { toGraphNodes } from "./adapters";
import type { BackendGraphNode } from "./types";

function node(type: string, properties: Record<string, unknown>): BackendGraphNode {
  return {
    id: `${type}_1`,
    label: type,
    type,
    risk_score: 0,
    risk_level: "info",
    finding_ids: [],
    properties,
    badges: [],
  };
}

const sub = (type: string, properties: Record<string, unknown>) => toGraphNodes([node(type, properties)])[0]?.sub;

describe("toGraphNodes subtitle", () => {
  it("lists a tool's capability kinds", () => {
    expect(sub("tool", { capability_kinds: ["read", "search"], operation_kind: "read" })).toBe("capability: read, search");
  });

  it("drops invokeTool when the tool has another capability kind", () => {
    expect(sub("tool", { capability_kinds: ["deleteResource", "invokeTool"], operation_kind: "delete" })).toBe(
      "capability: deleteResource",
    );
    expect(sub("tool", { capability_kinds: ["invokeTool"], operation_kind: "invoke" })).toBe("capability: invokeTool");
  });

  it("falls back to the operation kind when a tool declares no capability kinds", () => {
    expect(sub("tool", { operation_kind: "invoke" })).toBe("operation: invoke");
    expect(sub("tool", { capability_kinds: [], operation_kind: "invoke" })).toBe("operation: invoke");
  });

  it("ignores capability kinds that are not non-empty strings", () => {
    expect(sub("tool", { capability_kinds: [{ verb: "send" }, "send"], operation_kind: "send" })).toBe("capability: send");
    expect(sub("tool", { capability_kinds: ["", ""], operation_kind: "invoke" })).toBe("operation: invoke");
  });

  it("omits the subtitle when a tool has neither property", () => {
    expect(sub("tool", {})).toBeUndefined();
  });

  it("keeps the subtitle of the other node types", () => {
    expect(sub("input", { trust_level: "untrusted" })).toBe("trust: untrusted");
    expect(sub("data_asset", { sensitivity: "high" })).toBe("sensitivity: high");
  });
});
