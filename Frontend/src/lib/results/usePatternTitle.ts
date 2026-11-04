import { useTranslations } from "next-intl";
import { routeSummary } from "@/lib/results/findingDisplay";
import type { Finding, GraphNode } from "@/types/ThreatModel";

export type NodesById = Map<string, Pick<GraphNode, "label" | "type">>;

export function usePatternTitle(nodesById: NodesById) {
  const t = useTranslations("results");
  return (finding: Finding) => {
    const anchorId = finding.groupAnchor;
    if (!anchorId) return finding.title;
    const key = nodesById.get(anchorId)?.type === "input" ? "findingGroupFrom" : "findingGroupAt";
    return t(key, { title: finding.title, node: routeSummary([anchorId], nodesById) });
  };
}
