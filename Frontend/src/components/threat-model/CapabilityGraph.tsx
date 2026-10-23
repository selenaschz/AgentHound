import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Box, Boxed, Inline, Stack, Text1, IconSearchRegular, skinVars, useTheme } from "@telefonica/mistica";
import NodeDetailDrawer from "@/components/threat-model/NodeDetailDrawer";
import CyberGraph, { type CyberGraphHandle } from "@/components/threat-model/graph/CyberGraph";
import { primaryRoute, primaryRouteId } from "@/components/threat-model/graph/toReactFlow";
import { NODE_STYLE } from "@/components/threat-model/graph/cyberGraphTheme";
import { severityAccentColor } from "@/lib/threatModelColors";
import type { Attack, ControlInfo, Finding, GraphEdge, GraphNode } from "@/types/ThreatModel";

interface CapabilityGraphProps {
  solved: boolean;
  nodes: GraphNode[];
  edges: GraphEdge[];
  findings: Finding[];
  attacks: Attack[];
  /** Analysis name, surfaced inside the canvas when it goes fullscreen. */
  name?: string;
  /** Number of controls applied in the simulated (solved) graph; drives the
   * "N controls applied" banner. Ignored when `solved` is false. */
  appliedControlCount?: number;
  /** Applied controls (with `effect`) per node/edge id, from the simulation.
   * When present (solved view) they replace the effect-less recommendations
   * derived from findings, so the tooltip shows what was actually applied and
   * whether each control blocks or reinforces the hop. */
  nodeControlInfo?: Record<string, ControlInfo[]>;
  edgeControlInfo?: Record<string, ControlInfo[]>;
  /** Switches the parent's Findings/Solution tab. Passed through to the canvas
   * toolbar so the view can be swapped without leaving fullscreen, where the
   * tabs above the graph aren't reachable. */
  onToggleView?: () => void;
  /** Whether the Proposed Solution tab has data to show; when it doesn't,
   * toggling into it must leave fullscreen so the "unavailable" notice is visible. */
  solutionAvailable?: boolean;
}

function CapabilityGraph({ solved, nodes, edges, findings, attacks, name, appliedControlCount, nodeControlInfo, edgeControlInfo, onToggleView, solutionAvailable }: CapabilityGraphProps) {
  const t = useTranslations("results");
  const tNode = useTranslations("node");
  const { isDarkMode } = useTheme();
  const [focusedNode, setFocusedNode] = useState<GraphNode | null>(null);
  const graphRef = useRef<CyberGraphHandle>(null);

  // Recommended controls per node id, from the findings whose path runs through
  // it. Used as a fallback in the findings view; the solved view passes the
  // simulation's applied controls (with real effect) via `nodeControlInfo`.
  const nodeControls = useMemo(() => {
    if (nodeControlInfo) return nodeControlInfo;
    const map: Record<string, ControlInfo[]> = Object.create(null);
    for (const f of findings) {
      const cs = f.controls ?? [];
      if (cs.length === 0) continue;
      for (const id of f.path) {
        const list = (map[id] ??= []);
        for (const c of cs) if (!list.some((x) => x.name === c)) list.push({ name: c, effect: "unknown" });
      }
    }
    return map;
  }, [findings, nodeControlInfo]);

  // Primary critical route, built dynamically from the highest-severity attack:
  // its FH-id label plus the ordered nodes it traverses (mapped to real labels).
  const primaryPath = useMemo(() => {
    const route = primaryRoute(attacks);
    if (!route) return null;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const steps = route.nodeIds
      .map((id) => byId.get(id))
      .filter((n): n is GraphNode => Boolean(n));
    return steps.length > 0 ? { label: route.label, steps } : null;
  }, [attacks, nodes]);

  // Recommended controls per edge id, from findings traversing that node pair.
  // As with `nodeControls`, the solved view overrides this with the simulation's
  // applied controls (with real effect) via `edgeControlInfo`.
  const edgeControls = useMemo(() => {
    if (edgeControlInfo) return edgeControlInfo;
    const pairToId = new Map<string, string>();
    for (const e of edges) pairToId.set(`${e.f}->${e.t}`, e.id);
    const map: Record<string, ControlInfo[]> = Object.create(null);
    for (const f of findings) {
      const cs = f.controls ?? [];
      if (cs.length === 0) continue;
      for (let i = 0; i < f.path.length - 1; i++) {
        const id = pairToId.get(`${f.path[i]}->${f.path[i + 1]}`);
        if (!id) continue;
        const list = (map[id] ??= []);
        for (const c of cs) if (!list.some((x) => x.name === c)) list.push({ name: c, effect: "unknown" });
      }
    }
    return map;
  }, [findings, edges, edgeControlInfo]);

  const labels = useMemo(() => ({
    playAttack: t("playAttack"),
    stop: t("stopAttack"),
    fit: t("fitView"),
    fullscreen: t("fullscreen"),
    exitFullscreen: t("exitFullscreen"),
    viewFindings: t("tabFindings"),
    viewSolution: t("tabProposedSolution"),
    download: t("downloadPng"),
    legendSafe: t("legend.safe"),
    legendBlocked: t("legend.blocked"),
    legendMitigated: t("legend.mitigated"),
    legendPathSeverity: t("legend.pathSeverity"),
    legendPrimaryRoute: t("legend.primaryRoute", { id: primaryRouteId(attacks) }),
    legendCritical: t("legend.critical"),
    legendHigh: t("legend.high"),
    legendMedium: t("legend.medium"),
    legendLow: t("legend.low"),
    legendInfo: t("legend.info"),
    legendNodeTypes: t("legend.nodeTypes"),
    nodeTypeLabel: {
      input: t("legend.node.input"),
      agent: t("legend.node.agent"),
      memory: t("legend.node.memory"),
      tool: t("legend.node.tool"),
      data: t("legend.node.data"),
      output: t("legend.node.output"),
    },
    recommendedControls: tNode("recommendedControls"),
    controlEffect: {
      total: tNode("controlEffect.total"),
      partial: tNode("controlEffect.partial"),
    },
    highlightedRoute: t("highlightedRoute"),
    clearHighlight: t("clearHighlight"),
  }), [t, tNode, attacks]);

  return (
    <Stack space={12}>
      <Inline space={4} alignItems="center">
        <IconSearchRegular size={13} color={skinVars.colors.textSecondary} />
        <Text1 regular color={skinVars.colors.textSecondary}>{t("graphHint")}</Text1>
      </Inline>

      <CyberGraph
        ref={graphRef}
        solved={solved}
        nodes={nodes}
        edges={edges}
        attacks={attacks}
        name={name}
        nodeControls={nodeControls}
        edgeControls={edgeControls}
        onNodeClick={setFocusedNode}
        onToggleView={onToggleView}
        solutionAvailable={solutionAvailable}
        labels={labels}
      />

      {!solved && primaryPath && (
        <Boxed>
          <Box paddingX={16} paddingY={12}>
            <Stack space={8}>
              <Inline space={8} alignItems="center" wrap verticalSpace={4}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: skinVars.colors.error, flex: "0 0 auto" }} />
                <Text1 medium color={skinVars.colors.error}>{t("primaryPath")}</Text1>
                <span
                  style={{
                    padding: "1px 7px",
                    borderRadius: 999,
                    border: `1px solid ${skinVars.colors.error}`,
                    color: skinVars.colors.error,
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  }}
                >
                  {primaryPath.label}
                </span>
              </Inline>
              <Inline space={4} alignItems="center" wrap verticalSpace={4}>
                {primaryPath.steps.map((n, i) => (
                  <Inline key={`${n.id}-${i}`} space={4} alignItems="center">
                    {i > 0 && <Text1 regular color={skinVars.colors.textSecondary}>→</Text1>}
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: NODE_STYLE[n.type].accent, flex: "0 0 auto" }} />
                    <Text1 regular>{n.label.replace(/\n/g, " ")}</Text1>
                  </Inline>
                ))}
              </Inline>
            </Stack>
          </Box>
        </Boxed>
      )}

      {solved && (
        <Text1 medium color={skinVars.colors.success}>
          {t("solvedBanner", { count: appliedControlCount ?? 0 })}
        </Text1>
      )}

      {!solved && findings.length > 0 && (
        <Boxed>
          <Box paddingX={16} paddingY={12}>
            <Stack space={8}>
              <Text1 medium color={skinVars.colors.error}>{t("prioritizedFindings", { count: findings.length })}</Text1>
              <Stack space={4}>
                {findings.map((f) => (
                  <Inline key={f.id} space={4} wrap>
                    <Text1 medium color={severityAccentColor(f.severity, isDarkMode)}>{f.ruleId}</Text1>
                    <Text1 regular color={skinVars.colors.textSecondary}>{t("findingSummary", { title: f.title, score: f.score })}</Text1>
                  </Inline>
                ))}
              </Stack>
            </Stack>
          </Box>
        </Boxed>
      )}

      {focusedNode && (
        <NodeDetailDrawer
          node={focusedNode}
          findings={findings}
          onClose={() => {
            setFocusedNode(null);
            graphRef.current?.restoreFullscreen();
          }}
        />
      )}
    </Stack>
  );
}

export default CapabilityGraph;
