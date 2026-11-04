import { afterEach, beforeEach, describe, expect, it } from "vitest";
import InferenceStep from "@/components/threat-model/InferenceStep";
import type { CoverageWarning } from "@/lib/api/types";
import { mount } from "../test-utils";
import { edges, nodes } from "./fixtures";

let view: ReturnType<typeof mount>;

beforeEach(() => {
  view = mount();
});

afterEach(() => view.unmount());

const box = () => view.container.querySelector('[data-testid="coverage-warnings"]');
const noop = () => {};

describe("InferenceStep — coverage warnings", () => {
  it("flags the rules out of reach before the analysis runs", () => {
    const warnings: CoverageWarning[] = [
      { kind: "needs_declaration", rules: ["FH-012"], properties: ["capability_kinds"], message: "" },
    ];
    view.render(<InferenceStep nodes={nodes} edges={edges} warnings={warnings} onNodesChange={noop} onEdgesChange={noop} />);

    expect(box()?.textContent).toContain("1 regla con alcance limitado en este formato");
  });

  it("renders nothing for a file without warnings", () => {
    view.render(<InferenceStep nodes={nodes} edges={edges} warnings={[]} onNodesChange={noop} onEdgesChange={noop} />);

    expect(box()).toBeNull();
  });
});
