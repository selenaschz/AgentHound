import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Box, Boxed, Drawer, Inline, Stack, Tag, Text1, skinVars, useTheme } from "@telefonica/mistica";
import SeverityBadge from "@/components/threat-model/SeverityBadge";
import { propPositive } from "@/lib/api/adapters";
import { severityAccentColor } from "@/lib/threatModelColors";
import { formatSnakeCase } from "@/lib/format";
import { routeSummary } from "@/lib/results/findingDisplay";
import type { Finding, GraphNode, NodeProp } from "@/types/ThreatModel";

interface NodeDetailDrawerProps {
  node: GraphNode;
  findings: Finding[];
  findingLabelById: Map<string, string>;
  nodesById: Map<string, Pick<GraphNode, "label">>;
  onClose: () => void;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function NodeDetailDrawer({ node, findings, findingLabelById, nodesById, onClose }: NodeDetailDrawerProps) {
  const t = useTranslations("node");
  const tSeverity = useTranslations("overview.severity");
  const { isDarkMode } = useTheme();

  const properties: NodeProp[] = useMemo(
    () =>
      Object.entries(node.properties ?? {}).map(([key, value]) => ({
        key,
        val: formatValue(value),
        positive: propPositive(key, value),
      })),
    [node.properties],
  );

  // Findings whose risk path passes through this node.
  const nodeFindings = useMemo(
    () => findings.filter((f) => f.path.includes(node.id)),
    [findings, node.id],
  );

  // Recommended controls, deduplicated, aggregated across those findings.
  const controls = useMemo(
    () => Array.from(new Set(nodeFindings.flatMap((f) => f.controls ?? []))),
    [nodeFindings],
  );

  return (
    <Drawer title={node.label.replace(/\n/g, " ")} onClose={onClose} onDismiss={onClose} width={480}>
      <Stack space={24}>
        <Inline space={8} alignItems="center" wrap verticalSpace={8}>
          <Tag type="inactive">{node.type}</Tag>
          {node.status && (
            <SeverityBadge severity={node.status === "present" ? "none" : "critical"}>
              {node.status === "present" ? t("present") : t("absent")}
            </SeverityBadge>
          )}
          {typeof node.riskScore === "number" && node.riskScore > 0 && (
            <Text1 medium color={severityAccentColor(node.riskScore >= 9 ? "critical" : node.riskScore >= 7 ? "high" : "medium", isDarkMode)}>
              {t("riskScore")}: {node.riskScore}
            </Text1>
          )}
        </Inline>

        {node.badges && node.badges.length > 0 && (
          <Inline space={4} wrap verticalSpace={4}>
            {node.badges.map((badge) => (
              <Tag
                key={badge}
                type={
                  badge === "blocks" ? "success"
                  : badge === "mitigates" ? "warning"
                  : badge === "detects" ? "promo"
                  : "error"
                }
                small
              >
                {badge}
              </Tag>
            ))}
          </Inline>
        )}

        {properties.length > 0 && (
          <Stack space={8}>
            <Text1 medium color={skinVars.colors.textSecondary}>{t("properties")}</Text1>
            <Boxed>
              <Box paddingX={16} paddingY={8}>
                <Stack space={0}>
                  {properties.map((p) => (
                    <Box key={p.key} paddingY={8}>
                      <Inline space={12} alignItems="flex-start">
                        <Box width={150}>
                          <Text1 regular color={skinVars.colors.textSecondary}>{p.key}</Text1>
                        </Box>
                        <Text1
                          regular
                          color={
                            p.positive === true
                              ? skinVars.colors.success
                              : p.positive === false
                                ? skinVars.colors.error
                                : skinVars.colors.textPrimary
                          }
                        >
                          {p.val}
                        </Text1>
                      </Inline>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Boxed>
          </Stack>
        )}

        {nodeFindings.length > 0 && (
          <Stack space={8}>
            <Text1 medium color={skinVars.colors.textSecondary}>{t("attackPaths")}</Text1>
            <Stack space={8}>
              {nodeFindings.map((f) => (
                <Boxed key={f.id} dataAttributes={{ testid: "node-finding" }}>
                  <Box padding={12}>
                    <Stack space={4}>
                      <Inline space={8} alignItems="center" wrap verticalSpace={4}>
                        <Tag type="error" small>{findingLabelById.get(f.id) ?? f.ruleId}</Tag>
                        <Text1 regular color={skinVars.colors.textSecondary}>{f.id}</Text1>
                        <Tag type="inactive" small>{formatSnakeCase(f.category)}</Tag>
                        <SeverityBadge severity={f.severity} small>{tSeverity(f.severity)}</SeverityBadge>
                        <Text1 medium color={severityAccentColor(f.severity, isDarkMode)}>{f.score}</Text1>
                      </Inline>
                      <Text1 regular color={skinVars.colors.textSecondary}>{f.title}</Text1>
                      <Text1 regular>{routeSummary(f.path, nodesById)}</Text1>
                      <Inline space={4} wrap verticalSpace={4}>
                        {f.owaspAgentic?.map((tag) => <Tag key={tag} small type="inactive">{`OWASP ${tag}`}</Tag>)}
                        {f.owaspLlm?.map((tag) => <Tag key={tag} small type="inactive">{tag}</Tag>)}
                        {f.mitre?.map((tag) => <Tag key={tag} small type="inactive">{tag}</Tag>)}
                      </Inline>
                      {f.evidence && Object.keys(f.evidence).length > 0 && (
                        <Stack space={2}>
                          <Text1 medium color={skinVars.colors.textSecondary}>{t("evidence")}</Text1>
                          {Object.entries(f.evidence).map(([key, value]) => (
                            <Inline key={key} space={8}>
                              <Text1 regular color={skinVars.colors.textSecondary}>{formatSnakeCase(key)}:</Text1>
                              <Text1 regular>{Array.isArray(value) ? value.join(", ") : String(value)}</Text1>
                            </Inline>
                          ))}
                        </Stack>
                      )}
                    </Stack>
                  </Box>
                </Boxed>
              ))}
            </Stack>
          </Stack>
        )}

        {controls.length > 0 && (
          <Stack space={8}>
            <Text1 medium color={skinVars.colors.textSecondary}>{t("recommendedControls")}</Text1>
            <Inline space={4} wrap verticalSpace={4}>
              {controls.map((c) => (
                <Tag key={c} type="success" small>{c}</Tag>
              ))}
            </Inline>
          </Stack>
        )}
      </Stack>
    </Drawer>
  );
}

export default NodeDetailDrawer;
