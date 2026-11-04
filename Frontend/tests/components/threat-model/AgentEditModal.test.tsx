import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import AgentEditModal from "@/components/threat-model/AgentEditModal";
import { getCapabilities } from "@/lib/api/agentHound";
import { resetCapabilityRules } from "@/hooks/useCapabilityRules";
import type { CapabilityDescriptor } from "@/lib/api/types";
import { mount, press } from "../test-utils";
import { edges, nodes } from "./fixtures";

vi.mock("@/lib/api/agentHound", () => ({ getCapabilities: vi.fn() }));

const capability = (verb: string, evaluated_by: string[]): CapabilityDescriptor => ({
  verb,
  description: "",
  typical_source: null,
  typical_target: null,
  evaluated_by,
});

let view: ReturnType<typeof mount>;

async function open() {
  view.render(<AgentEditModal agentId="planner" nodes={nodes} edges={edges} onSave={() => {}} onClose={() => {}} />);
  await act(async () => {});
}

beforeEach(() => {
  resetCapabilityRules();
  vi.mocked(getCapabilities).mockResolvedValue({
    capabilities: [capability("read", ["FH-001", "FH-004"]), capability("summarize", [])],
  });
  view = mount();
});

afterEach(() => view.unmount());

const unchecked = () => Array.from(document.body.querySelectorAll("[data-testid=unchecked-verbs]"), (el) => el.textContent).join();
const chip = (verb: string) => Array.from(document.body.querySelectorAll("button")).find((b) => b.textContent === verb)!;

describe("AgentEditModal — verbs no rule looks at", () => {
  it("sets apart the verbs no rule looks at", async () => {
    await open();

    expect(unchecked()).toContain("Ninguna regla mira estos verbos");
    expect(unchecked()).toContain("summarize");
    expect(unchecked()).not.toContain("read");
  });

  it("names the rules that look at a verb on hover", async () => {
    await open();

    expect(chip("read").closest("[title]")?.getAttribute("title")).toBe("Lo comprueban FH-001, FH-004");
    expect(chip("summarize").closest("[title]")).toBeNull();
  });

  it("warns when adding a verb no rule looks at", async () => {
    await open();

    press(chip("summarize"));
    expect(document.body.textContent).toContain("Ninguna regla mira el verbo \"summarize\"");

    press(chip("read"));
    expect(document.body.textContent).not.toContain("Ninguna regla mira el verbo");
  });

  it("keeps a single list per row when the catalog can't be loaded", async () => {
    vi.mocked(getCapabilities).mockRejectedValue(new Error("offline"));
    await open();

    expect(unchecked()).toBe("");
    expect(chip("summarize")).toBeDefined();
  });
});
