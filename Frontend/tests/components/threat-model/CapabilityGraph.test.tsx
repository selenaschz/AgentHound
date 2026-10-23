import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CapabilityGraph from "@/components/threat-model/CapabilityGraph";
import type { CyberGraphProps } from "@/components/threat-model/graph/CyberGraph";
import { findingLabels } from "@/lib/results/findingDisplay";
import { mount, press } from "../test-utils";
import { edges, findings, nodes } from "./fixtures";

const canvas = vi.hoisted(() => ({ props: null as CyberGraphProps | null }));
vi.mock("@/components/threat-model/graph/CyberGraph", () => ({
  default: (props: CyberGraphProps) => {
    canvas.props = props;
    return null;
  },
}));

const labels = findingLabels(findings);
let view: ReturnType<typeof mount>;
let onSelectFinding: ReturnType<typeof vi.fn<(id: string) => void>>;
let onClearSelection: ReturnType<typeof vi.fn<() => void>>;

beforeEach(() => {
  view = mount();
  onSelectFinding = vi.fn<(id: string) => void>();
  onClearSelection = vi.fn<() => void>();
  canvas.props = null;
});

afterEach(() => view.unmount());

function render({ selectedFindingId = null as string | null, solved = false } = {}) {
  view.render(
    <CapabilityGraph
      solved={solved}
      nodes={nodes}
      edges={edges}
      findings={findings}
      attacks={[]}
      findingLabelById={labels}
      selectedFindingId={selectedFindingId}
      onSelectFinding={onSelectFinding}
      onClearSelection={onClearSelection}
    />,
  );
}

const rows = () => Array.from(view.container.querySelectorAll("button"));
const rowFor = (label: string) => rows().find((b) => b.textContent?.startsWith(label));

describe("CapabilityGraph — prioritized findings", () => {
  it("lists repeated rules with an ordinal so duplicates are distinguishable", () => {
    render();

    expect(rows().map((b) => b.textContent?.split("Datos")[0]?.split("Escritura")[0])).toEqual([
      "FH-001 #1",
      "FH-001 #2",
      "FH-004",
    ]);
  });

  it("selects a finding when its row is pressed", () => {
    render();

    press(rowFor("FH-001 #2")!);

    expect(onSelectFinding).toHaveBeenCalledWith("f2");
  });

  it("does not offer a route for findings without a path", () => {
    render();

    expect(view.container.textContent).toContain("HY-002");
    expect(rowFor("HY-002")).toBeUndefined();
  });

  it("marks only the selected row as current", () => {
    render({ selectedFindingId: "f1" });

    expect(rowFor("FH-001 #1")!.getAttribute("aria-current")).toBe("true");
    expect(rowFor("FH-001 #2")!.hasAttribute("aria-current")).toBe(false);
  });
});

describe("CapabilityGraph — graph highlight", () => {
  it("passes no highlight while nothing is selected", () => {
    render();

    expect(canvas.props?.highlight).toBeNull();
  });

  it("highlights the selected finding's exact hops, telling duplicates apart", () => {
    render({ selectedFindingId: "f1" });
    const first = canvas.props?.highlight;
    render({ selectedFindingId: "f2" });
    const second = canvas.props?.highlight;

    expect(first).toEqual({
      nodeIds: ["input", "planner", "crm"],
      edgeIds: ["e1", "e3"],
      label: "FH-001 #1",
      summary: "Email entrante → Planner → CRM",
    });
    expect(second?.edgeIds).toEqual(["e2", "e3"]);
    expect(second?.label).toBe("FH-001 #2");
  });

  it("wires the canvas' clear action to the parent", () => {
    render({ selectedFindingId: "f1" });

    canvas.props?.onClearHighlight?.();

    expect(onClearSelection).toHaveBeenCalledOnce();
  });

  it("drops the highlight in the solved view", () => {
    render({ selectedFindingId: "f1", solved: true });

    expect(canvas.props?.highlight).toBeNull();
  });
});
