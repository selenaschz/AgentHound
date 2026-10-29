import { afterEach, beforeEach, describe, expect, it } from "vitest";
import NodeDetailDrawer from "@/components/threat-model/NodeDetailDrawer";
import { findingLabels } from "@/lib/results/findingDisplay";
import { mount } from "../test-utils";
import { findings, nodes } from "./fixtures";

const nodesById = new Map(nodes.map((n) => [n.id, n]));
let view: ReturnType<typeof mount>;

beforeEach(() => {
  view = mount();
  view.render(
    <NodeDetailDrawer
      node={nodesById.get("planner")!}
      findings={findings}
      findingLabelById={findingLabels(findings)}
      nodesById={nodesById}
      onClose={() => {}}
    />,
  );
});

afterEach(() => view.unmount());

const texts = () => Array.from(document.body.querySelectorAll("*"), (el) => el.textContent);

describe("NodeDetailDrawer — findings through the node", () => {
  it("tells findings of the same rule apart by label, id and route", () => {
    expect(texts()).toEqual(expect.arrayContaining([
      "FH-001 #1",
      "f1",
      "Email entrante → Planner → CRM",
      "FH-001 #2",
      "f2",
      "Email entrante → Planner → Logs",
    ]));
  });

  it("lists only findings whose path crosses the node", () => {
    expect(texts()).not.toContain("f4");
  });
});
