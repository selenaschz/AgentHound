/**
 * Raw response shapes returned by the AgentHound backend (FastAPI, Phase 1).
 *
 * These mirror the backend serializers exactly, including the snake_case field
 * names (spec sections 12.1–12.4). They are intentionally kept separate from the
 * camelCase UI types in `@/types/ThreatModel`; the mapping happens in
 * `@/lib/api/adapters`.
 */

/** Summary block returned by `POST /analyses` (spec section 12.1). */
export interface BackendSummary {
  nodes: number;
  edges: number;
  findings: number;
  critical: number;
  high: number;
  medium: number;
  max_score: number;
}

/** One stored analysis as returned by `GET /analyses` (the list view). Carries
 * just enough for a list row without a per-analysis fetch: the id, its name, the
 * detected source framework, the upload timestamp (ISO 8601, UTC) and the same
 * summary block as the create/analyze responses. */
export interface AnalysisListItem {
  analysis_id: string;
  name: string;
  source_framework: string;
  uploaded_at: string;
  summary: BackendSummary;
}

/** Response of `GET /analyses`: every stored analysis, most recent upload first. */
export interface AnalysesListResponse {
  analyses: AnalysisListItem[];
}

/** Response of `DELETE /analyses/{id}`. */
export interface DeleteAnalysisResponse {
  analysis_id: string;
  status: string;
}

/** Response of `POST /analyses`. This is now the PARSE stage: the YAML is parsed
 * into a stored graph but no rules have run, so `status` is `"parsed"` and the
 * summary's finding counts are all zero. Findings are produced by the separate
 * analyze stage (`POST /analyses/{id}/analyze`). */
export interface CreateAnalysisResponse {
  analysis_id: string;
  status: string;
  /** Authoritative analysis name (the submitted name, or the YAML's metadata.name). */
  name: string;
  summary: BackendSummary;
}

/** A node in the normalized graph (spec section 12.2). `type` is a backend
 * NodeType, which includes `data_asset` (mapped to `data` on the UI side). */
export interface BackendGraphNode {
  id: string;
  label: string;
  type: string;
  risk_score: number;
  /** Highest severity among the findings whose path contains this node
   * (`info` when none). Node-scoped findings have no edges, so this is where
   * they become visible. */
  risk_level: string;
  /** Ids of every finding whose path contains this node. */
  finding_ids: string[];
  properties: Record<string, unknown>;
  badges: string[];
}

/** An edge in the normalized graph (spec section 12.2). `risk_level` is a
 * backend Severity, which includes `info` (mapped to `none` on the UI side).
 * `blocked`/`mitigated` are false on the plain `/graph`; the control simulator
 * (spec section 11) sets them so the mitigated graph shows which hops are cut
 * (`blocked`, total effect) or merely weakened (`mitigated`, partial effect). */
export interface BackendGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  capability: string;
  risk_level: string;
  blocked: boolean;
  mitigated: boolean;
  /** True when a detector-effect control monitors this edge; the hop survives
   * but findings crossing it receive a small score reduction. */
  detected: boolean;
  finding_ids: string[];
}

export interface BackendGraph {
  nodes: BackendGraphNode[];
  edges: BackendGraphEdge[];
}

/** A finding (spec section 12.3). */
export interface BackendFinding {
  id: string;
  rule_id: string;
  title: string;
  severity: string;
  score: number;
  category: string;
  path: string[];
  edges: string[];
  derivation: string;
  evidence: Record<string, unknown>;
  recommended_controls: string[];
  owasp_agentic: string[];
  owasp_llm: string[];
  mitre_atlas: string[];
  /** Derived channel: "attack" for exploitable paths, "hygiene" for compliance gaps. */
  finding_class: "attack" | "hygiene";
}

export interface FindingsResponse {
  findings: BackendFinding[];
}

// --- Phase 2: control recommendation + simulation (spec sections 12.5-12.6) --

/** One ranked control recommendation (`GET .../controls/recommendations`).
 * `estimated_risk_reduction` is the absolute score drop measured by a
 * single-control what-if simulation; recommendations come pre-sorted by it. */
export interface ControlRecommendation {
  control_id: string;
  name: string;
  target_node_id: string;
  breaks_findings: string[];
  estimated_risk_reduction: number;
  cost_estimate: string;
  demo_priority: string;
}

export interface RecommendationsResponse {
  recommendations: ControlRecommendation[];
}

/** One control to install on one node (body of `POST .../simulate-controls`). */
export interface ControlApplication {
  control_id: string;
  target_node_id: string;
  /** Optional override: `"bypassed"` signals the control is installed but
   * actively circumvented (Phase E). Omit or set `"present"` for normal use. */
  status?: string;
}

export interface SimulateControlsRequest {
  controls_to_apply: ControlApplication[];
}

/** A control resolved and applied during a simulation. */
export interface AppliedControl {
  control_id: string;
  name: string;
  category: string;
  effect: string;
  target_node_id: string;
  affected_edge_ids: string[];
  /** `"present"` (default) or `"bypassed"` (Phase E, control installed but circumvented). */
  status?: string;
}

/** Aggregate finding counts before or after a simulation. */
export interface SimSummary {
  finding_count: number;
  critical_count: number;
  max_score: number;
}

export interface RiskReduction {
  absolute: number;
  percentage: number;
}

/** A before-finding whose (rule_id, path) no longer appears after the
 * simulation. `broken_by`/`target_node_id` are null when a mitigation (not a
 * hard block) removed it, since only blocked edges are attributed. */
export interface BrokenPath {
  finding_id: string;
  rule_id: string;
  broken_by: string | null;
  target_node_id: string | null;
}

export interface SimulateControlsResponse {
  analysis_id: string;
  applied_controls: AppliedControl[];
  before: SimSummary;
  after: SimSummary;
  risk_reduction: RiskReduction;
  broken_paths: BrokenPath[];
  /** The mitigated graph: original nodes plus `type: control` nodes, with
   * `blocked`/`mitigated` set on affected edges. */
  graph: BackendGraph;
}

// --- analyze stage: run the rule engine over the (edited) graph --------------

/** A node in a graph submitted to the analyze stage. `type` is a backend
 * NodeType (e.g. `data_asset`), so the UI `data` type must be mapped back. */
export interface AnalyzeNodeInput {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
}

/** An edge in a graph submitted to the analyze stage. */
export interface AnalyzeEdgeInput {
  id: string;
  source: string;
  target: string;
  capability: string;
  properties: Record<string, unknown>;
}

/** Body of `POST /analyses/{id}/analyze` when the user edited the capabilities:
 * the full edited graph (not a diff); the backend reconciles it against the
 * stored analysis by id. Omit the body entirely to analyze the parsed graph
 * as-is (the first run when nothing was edited). */
export interface AnalyzeRequest {
  nodes: AnalyzeNodeInput[];
  edges: AnalyzeEdgeInput[];
}

/** Response of `POST /analyses/{id}/analyze`: the summary/graph/findings bundle
 * needed to build the results view in one round-trip. */
export interface AnalyzeResponse {
  analysis_id: string;
  status: string;
  name: string;
  summary: BackendSummary;
  graph: BackendGraph;
  findings: BackendFinding[];
}

/** The error envelope every non-2xx response is expected to carry (spec
 * section 13). */
export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
