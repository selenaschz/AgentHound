import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ComponentProps } from "react";
import ResultsStep from "@/components/threat-model/ResultsStep";
import type CapabilityGraph from "@/components/threat-model/CapabilityGraph";
import { mount, press } from "../test-utils";
import { result } from "./fixtures";

type GraphProps = ComponentProps<typeof CapabilityGraph>;

const graph = vi.hoisted(() => ({ props: null as GraphProps | null }));
vi.mock("next/dynamic", () => ({
  default: () => (props: GraphProps) => {
    graph.props = props;
    return null;
  },
}));

let view: ReturnType<typeof mount>;

beforeEach(() => {
  view = mount();
  graph.props = null;
  view.render(<ResultsStep result={result} />);
});

afterEach(() => view.unmount());

function openAttackGroup() {
  const header = Array.from(view.container.querySelectorAll("[aria-expanded]")).find((el) =>
    el.textContent?.includes("ataque"),
  );
  press(header!);
}

const cards = () => Array.from(view.container.querySelectorAll<HTMLButtonElement>("button[aria-description]"));
const cardFor = (label: string) => cards().find((b) => b.textContent?.includes(label));

describe("ResultsStep — finding cards", () => {
  it("labels duplicate rules with an ordinal and shows each route", () => {
    openAttackGroup();

    const first = cardFor("FH-001 #1")!;
    expect(first.textContent).toContain("Email entrante → Planner → CRM");
    expect(cardFor("FH-001 #2")).toBeDefined();
  });

  it("selects a card's finding in the graph and toggles it off on a second press", () => {
    openAttackGroup();
    const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView");

    press(cardFor("FH-001 #2")!);
    expect(graph.props?.selectedFindingId).toBe("f2");
    expect(cardFor("FH-001 #2")!.getAttribute("aria-current")).toBe("true");
    expect(scroll).toHaveBeenCalled();

    press(cardFor("FH-001 #2")!);
    expect(graph.props?.selectedFindingId).toBeNull();
    expect(cardFor("FH-001 #2")!.hasAttribute("aria-current")).toBe(false);
  });

  it("moves the selection when another card is pressed", () => {
    openAttackGroup();

    press(cardFor("FH-001 #1")!);
    press(cardFor("FH-004")!);

    expect(graph.props?.selectedFindingId).toBe("f3");
  });

  it("shares one selection with the graph's own list and its clear action", () => {
    openAttackGroup();

    act(() => graph.props?.onSelectFinding("f1"));
    expect(cardFor("FH-001 #1")!.getAttribute("aria-current")).toBe("true");

    act(() => graph.props?.onClearSelection());
    expect(graph.props?.selectedFindingId).toBeNull();
  });

  it("passes the same labels the cards show", () => {
    expect(graph.props?.findingLabelById.get("f2")).toBe("FH-001 #2");
  });
});
