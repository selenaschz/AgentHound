import { describe, expect, it } from "vitest";

import { findingRoute } from "./toReactFlow";
import type { GraphEdge } from "@/types/ThreatModel";

const edges: GraphEdge[] = [
  { id: "e1", f: "a", t: "b" },
  { id: "e2", f: "a", t: "b" },
  { id: "e3", f: "b", t: "c" },
  { id: "e4", f: "c", t: "d" },
];

describe("findingRoute", () => {
  it("uses the finding's own edge ids, telling parallel hops apart", () => {
    expect(findingRoute({ path: ["a", "b", "c"], edges: ["e1", "e3"] }, edges)).toEqual({
      nodeIds: ["a", "b", "c"],
      edgeIds: ["e1", "e3"],
    });
    expect(findingRoute({ path: ["a", "b", "c"], edges: ["e2", "e3"] }, edges).edgeIds).toEqual(["e2", "e3"]);
  });

  it("drops edge ids that are not in the rendered graph", () => {
    expect(findingRoute({ path: ["b", "c"], edges: ["gone", "e3"] }, edges).edgeIds).toEqual(["e3"]);
  });

  it("falls back to path pairs in either direction when edges are missing", () => {
    expect(findingRoute({ path: ["c", "b"] }, edges).edgeIds).toEqual(["e3"]);
    expect(findingRoute({ path: ["a", "b"], edges: [] }, edges).edgeIds).toEqual(["e1", "e2"]);
  });

  it("includes edge endpoints missing from a display-ordered path", () => {
    expect(findingRoute({ path: ["b"], edges: ["e3", "e4"] }, edges).nodeIds).toEqual(["b", "c", "d"]);
  });
});
