import type { Severity } from "@/lib/severity";
import type { Finding, GraphNode } from "@/types/ThreatModel";

export const FILTER_SEVERITIES = ["critical", "high", "medium", "low"] as const satisfies readonly Severity[];

type NodeLabels = Map<string, Pick<GraphNode, "label">>;

export interface FindingFilter {
  query: string;
  severities: ReadonlySet<Severity>;
}

export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function searchText(finding: Finding, label: string, nodesById: NodeLabels): string {
  return normalizeSearch(
    [
      label,
      finding.id,
      finding.ruleId,
      finding.title,
      finding.desc,
      finding.category,
      finding.severity,
      ...finding.path.map((id) => nodesById.get(id)?.label ?? id),
      ...(finding.owaspAgentic ?? []),
      ...(finding.owaspLlm ?? []),
      ...(finding.mitre ?? []),
    ].join(" "),
  );
}

export function isFiltering({ query, severities }: FindingFilter): boolean {
  return query.trim() !== "" || severities.size > 0;
}

export function filterFindings(
  findings: Finding[],
  filter: FindingFilter,
  labelById: Map<string, string>,
  nodesById: NodeLabels,
): Finding[] {
  if (!isFiltering(filter)) return findings;
  const terms = normalizeSearch(filter.query).split(/\s+/).filter(Boolean);
  return findings.filter((f) => {
    if (filter.severities.size > 0 && !filter.severities.has(f.severity)) return false;
    if (terms.length === 0) return true;
    const text = searchText(f, labelById.get(f.id) ?? f.ruleId, nodesById);
    return terms.every((term) => text.includes(term));
  });
}
