import { describe, expect, it } from "vitest";

import { findingRoute, playbackFrame } from "./toReactFlow";
import type { GraphEdge } from "@/types/ThreatModel";

const edges: GraphEdge[] = [
  { id: "e1", f: "a", t: "b" },
  { id: "e2", f: "a", t: "b" },
  { id: "e3", f: "b", t: "c" },
  { id: "e4", f: "c", t: "d" },
];

describe("findingRoute", () => {
  it("uses the finding's own edge ids, including every parallel edge of a hop", () => {
    expect(findingRoute({ path: ["a", "b", "c"], edges: ["e1", "e2", "e3"] }, edges)).toEqual({
      nodeIds: ["a", "b", "c"],
      edgeIds: ["e1", "e2", "e3"],
    });
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

describe("playbackFrame", () => {
  const rfEdges = edges.map((e) => ({ id: e.id, source: e.f, target: e.t }));
  const frame = (route: { nodeIds: string[]; edgeIds: string[] }, step: number) => {
    const f = playbackFrame(route, step, rfEdges);
    return { currentNode: f.currentNode, liveNodes: [...f.liveNodes], currentEdges: [...f.currentEdges], liveEdges: [...f.liveEdges] };
  };

  it("starts on the first node with no edge lit", () => {
    expect(frame({ nodeIds: ["a", "b", "c"], edgeIds: ["e1", "e3"] }, 0)).toEqual({
      currentNode: "a",
      liveNodes: ["a"],
      currentEdges: [],
      liveEdges: [],
    });
  });

  it("lights the hop into the current node and keeps earlier hops live", () => {
    expect(frame({ nodeIds: ["a", "b", "c"], edgeIds: ["e1", "e3"] }, 2)).toEqual({
      currentNode: "c",
      liveNodes: ["a", "b", "c"],
      currentEdges: ["e3"],
      liveEdges: ["e1", "e3"],
    });
  });

  it("only lights the parallel edge that belongs to the route", () => {
    expect(frame({ nodeIds: ["a", "b"], edgeIds: ["e2"] }, 1).liveEdges).toEqual(["e2"]);
  });

  it("follows a route whose edges are listed out of path order", () => {
    expect(frame({ nodeIds: ["b", "c", "d"], edgeIds: ["e4", "e3"] }, 1)).toMatchObject({
      currentEdges: ["e3"],
      liveEdges: ["e3"],
    });
  });
});
