// No React Flow imports here: ResultsStep uses this without loading the graph bundle.

import type { Finding, GraphNode } from "@/types/ThreatModel";

export function findingLabels(findings: Pick<Finding, "id" | "ruleId">[]): Map<string, string> {
  const totals = new Map<string, number>();
  findings.forEach((f) => totals.set(f.ruleId, (totals.get(f.ruleId) ?? 0) + 1));
  const seen = new Map<string, number>();
  const labels = new Map<string, string>();
  findings.forEach((f) => {
    const n = (seen.get(f.ruleId) ?? 0) + 1;
    seen.set(f.ruleId, n);
    labels.set(f.id, (totals.get(f.ruleId) ?? 0) > 1 ? `${f.ruleId} #${n}` : f.ruleId);
  });
  return labels;
}

export function routeSummary(path: string[], nodesById: Map<string, Pick<GraphNode, "label">>): string {
  return path.map((id) => (nodesById.get(id)?.label ?? id).replace(/\n/g, " ")).join(" → ");
}
