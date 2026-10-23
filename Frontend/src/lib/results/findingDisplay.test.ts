import { describe, expect, it } from "vitest";

import { findingLabels, routeSummary } from "./findingDisplay";

describe("findingLabels", () => {
  it("numbers findings that share a rule and leaves unique rules bare", () => {
    const labels = findingLabels([
      { id: "f1", ruleId: "FH-001" },
      { id: "f2", ruleId: "FH-002" },
      { id: "f3", ruleId: "FH-001" },
    ]);
    expect([...labels.entries()]).toEqual([
      ["f1", "FH-001 #1"],
      ["f2", "FH-002"],
      ["f3", "FH-001 #2"],
    ]);
  });
});

describe("routeSummary", () => {
  it("joins node labels, flattening line breaks and keeping unknown ids", () => {
    const nodes = new Map([
      ["a", { label: "User\ninput" }],
      ["b", { label: "Planner" }],
    ]);
    expect(routeSummary(["a", "b", "zz"], nodes)).toBe("User input → Planner → zz");
  });
});
