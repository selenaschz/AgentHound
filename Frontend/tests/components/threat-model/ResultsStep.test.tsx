import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ComponentProps } from "react";
import ResultsStep from "@/components/threat-model/ResultsStep";
import type CapabilityGraph from "@/components/threat-model/CapabilityGraph";
import { mount, press } from "../test-utils";
import { edges, nodes, result } from "./fixtures";

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

const toggles = () => Array.from(view.container.querySelectorAll<HTMLElement>("[aria-expanded]"));
const attackHeader = () => toggles().find((el) => el.textContent?.includes("ataque"))!;
const occurrencesToggle = () => toggles().find((el) => el.textContent?.includes("ocurrencias"))!;
const pattern = () => view.container.querySelector("[data-testid=finding-pattern]");

function openAttackGroup() {
  press(attackHeader());
  press(occurrencesToggle());
}

const cards = () => Array.from(view.container.querySelectorAll<HTMLButtonElement>("[data-testid=finding-card]"));
const cardFor = (label: string) => cards().find((b) => b.textContent?.includes(label));

describe("ResultsStep — finding patterns", () => {
  beforeEach(() => press(attackHeader()));

  it("counts causes, not occurrences, in the group header", () => {
    expect(attackHeader().textContent).toContain("2 causas");
  });

  it("folds the occurrences of one cause into a single card", () => {
    expect(pattern()!.textContent).toContain("2 hallazgos");
    expect(pattern()!.textContent).toContain("Datos sensibles alcanzables desde entrada no confiable desde Email entrante");
    expect(cardFor("FH-001 #1")).toBeUndefined();
    expect(cardFor("FH-004")).toBeDefined();
  });

  it("lists every occurrence with its own label once expanded, and folds them back", () => {
    press(occurrencesToggle());
    expect(occurrencesToggle().getAttribute("aria-expanded")).toBe("true");
    expect(cardFor("FH-001 #1")).toBeDefined();
    expect(cardFor("FH-001 #2")).toBeDefined();

    press(occurrencesToggle());
    expect(cardFor("FH-001 #1")).toBeUndefined();
  });

  it("marks a folded cause that holds the graph's selection", () => {
    act(() => graph.props?.onSelectFinding("f2"));

    expect(occurrencesToggle().getAttribute("aria-description")).toBe("Contiene el hallazgo seleccionado");
    press(occurrencesToggle());
    expect(occurrencesToggle().hasAttribute("aria-description")).toBe(false);
    expect(cardFor("FH-001 #2")!.getAttribute("aria-current")).toBe("true");
  });
});

describe("ResultsStep — finding cards", () => {
  it("labels duplicate rules with an ordinal and shows each route", () => {
    openAttackGroup();

    const first = cardFor("FH-001 #1")!;
    expect(first.textContent).toContain("Email entrante → Planner → CRM");
    expect(cardFor("FH-001 #2")).toBeDefined();
  });

  it("shows each finding's id next to its label", () => {
    openAttackGroup();

    const texts = Array.from(cardFor("FH-001 #2")!.querySelectorAll("*"), (el) => el.textContent);
    expect(texts).toContain("f2");
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

describe("ResultsStep — resolved findings", () => {
  beforeEach(() => {
    view.render(
      <ResultsStep
        result={{
          ...result,
          solution: {
            remediation: [],
            beforeAfter: {
              before: { findingCount: 4, criticalCount: 2, maxScore: 9.1, riskScoreTotal: 27.4 },
              after: { findingCount: 0, criticalCount: 0, maxScore: 0, riskReductionPct: 100, riskReductionByGroupPct: 80 },
            },
            nodes,
            edges,
            attacks: [],
            brokenFindingIds: ["f1", "f2"],
            appliedControlCount: 0,
            nodeControlInfo: {},
            edgeControlInfo: {},
            chokepointRec: null,
          },
        }}
      />,
    );
    press(Array.from(view.container.querySelectorAll("[role=tab]")).find((el) => el.textContent?.includes("Solución"))!);
    press(Array.from(view.container.querySelectorAll("[aria-expanded]")).find((el) => el.textContent?.includes("Resuelto"))!);
  });

  it("tells resolved findings of the same rule apart by label, id and route", () => {
    const texts = Array.from(view.container.querySelectorAll("*"), (el) => el.textContent);

    expect(texts).toEqual(expect.arrayContaining([
      "f1",
      "Email entrante → Planner → CRM",
      "f2",
      "Email entrante → Planner → Logs",
    ]));
    expect(texts).toContain("FH-001 #2");
  });

  it("shows the risk reduction with each cause counted once", () => {
    const row = Array.from(view.container.querySelectorAll("*")).find((el) => el.textContent === "Reducción por causa-80%");

    expect(row).toBeDefined();
  });

  it("lists only the findings the simulation broke", () => {
    const resolved = Array.from(view.container.querySelectorAll("[data-testid=resolved-finding]"), (el) => el.textContent);

    expect(resolved).toHaveLength(2);
    expect(resolved.join()).not.toMatch(/f3|f4/);
  });

  it("hands the solved graph only the findings still open", () => {
    expect(graph.props?.findings.map((f) => f.id)).toEqual(["f3", "f4"]);
  });
});
