"""Dify adapter (spec section 5).

A Dify DSL describes an app plus a ``workflow.graph`` of typed nodes and edges.
Node ``data.type`` selects the IR node type (``start`` -> input, ``llm``/``agent``
-> agent, ``tool``/``http-request`` -> tool, ``knowledge-retrieval`` -> data
asset, ``answer``/``end`` -> output); graph edges become capability edges keyed by
the pair of endpoint kinds. Each tool's downstream effect (an external send, a web
fetch, a sensitive read) is synthesised so it is visible to the rule engine even
when the DSL routes the tool into an internal answer node.

Ported from the earlier prototype adapter into the current
capability-verb IR.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from ...ir.models import (
    AnalysisIR,
    IRValidationError,
    Metadata,
    NodeType,
    SourceFramework,
)
from ._common import (
    IRBuilder,
    IdFactory,
    apply_declared_properties,
    infer_asset_properties,
    infer_input_properties,
    infer_output_properties,
    infer_tool_properties,
    synthesize_tool_effect,
    tool_effect,
)

_INPUT_TYPES = {"start"}
_AGENT_TYPES = {"llm", "agent"}
_TOOL_TYPES = {"tool", "http-request"}
_ASSET_TYPES = {"knowledge-retrieval", "dataset-retrieval", "knowledge"}
_OUTPUT_TYPES = {"answer", "end"}


def _capability_for(source_kind: NodeType, target_kind: NodeType) -> str:
    if source_kind == NodeType.INPUT and target_kind == NodeType.AGENT:
        return "receiveInstruction"
    if target_kind == NodeType.TOOL:
        return "invokeTool"
    if target_kind == NodeType.DATA_ASSET:
        return "read"
    if target_kind == NodeType.OUTPUT:
        return "send"
    # Everything else -- including an agent -> agent workflow transition -- is
    # ordinary data/control flow. A Dify edge does NOT imply authority
    # delegation, so it is never labelled delegateTo (that would risk spuriously
    # tripping FH-014); explicit delegation would need a dedicated signal.
    return "dataFlow"


def load(data: dict[str, Any], analysis_id: str) -> AnalysisIR:
    workflow = data.get("workflow")
    if not isinstance(workflow, Mapping):
        raise IRValidationError("INVALID_INPUT", "Dify DSL must contain a 'workflow' section.")
    graph = workflow.get("graph")
    if not isinstance(graph, Mapping):
        raise IRValidationError("INVALID_INPUT", "Dify 'workflow.graph' must be a mapping.")
    raw_nodes = graph.get("nodes")
    raw_edges = graph.get("edges") or []
    if not isinstance(raw_nodes, list) or not isinstance(raw_edges, list):
        raise IRValidationError("INVALID_INPUT", "Dify 'graph.nodes' and 'graph.edges' must be lists.")
    if not raw_nodes:
        raise IRValidationError("EMPTY_IR", "Dify workflow declares no nodes.")

    builder = IRBuilder()
    ids = IdFactory()
    # dify node id -> (ir_id, NodeType)
    node_map: dict[str, tuple[str, NodeType]] = {}
    tool_nodes: list[str] = []

    for raw_node in raw_nodes:
        if not isinstance(raw_node, Mapping):
            continue
        dify_id = str(raw_node.get("id") or "")
        section = raw_node.get("data")
        if not dify_id or not isinstance(section, Mapping):
            continue
        node_type = str(section.get("type") or "").lower()
        title = str(section.get("title") or section.get("name") or node_type or dify_id)

        # Risk properties may be declared directly in the node's ``data`` block;
        # Dify keeps unknown keys there, and its own keys (title, model, memory,
        # variables...) do not collide with catalogued property names.
        if node_type in _INPUT_TYPES:
            nid = ids.make(NodeType.INPUT, title)
            props = infer_input_properties(title)
            apply_declared_properties(props, section, NodeType.INPUT)
            builder.add_node(nid, NodeType.INPUT, title, props)
            node_map[dify_id] = (nid, NodeType.INPUT)
        elif node_type in _AGENT_TYPES:
            nid = ids.make(NodeType.AGENT, title)
            props = {"role_type": "worker", "trust_level": "internal_logic", "autonomy_level": "full_auto", "guardrails": []}
            apply_declared_properties(props, section, NodeType.AGENT)
            builder.add_node(nid, NodeType.AGENT, title, props)
            node_map[dify_id] = (nid, NodeType.AGENT)
        elif node_type in _TOOL_TYPES:
            props = infer_tool_properties(title)
            apply_declared_properties(props, section, NodeType.TOOL)
            if node_type == "http-request" and tool_effect(props) not in {"send", "fetchWeb"}:
                props["capability_kinds"] = ["send", "invokeTool"]
                props["target_boundary"] = "external"
                props["access_kind"] = "external_call"
                props["side_effect"] = True
            nid = ids.make(NodeType.TOOL, title)
            builder.add_node(nid, NodeType.TOOL, title, props)
            node_map[dify_id] = (nid, NodeType.TOOL)
            tool_nodes.append(nid)
        elif node_type in _ASSET_TYPES:
            nid = ids.make(NodeType.DATA_ASSET, title)
            props = infer_asset_properties(title)
            apply_declared_properties(props, section, NodeType.DATA_ASSET)
            builder.add_node(nid, NodeType.DATA_ASSET, title, props)
            node_map[dify_id] = (nid, NodeType.DATA_ASSET)
        elif node_type in _OUTPUT_TYPES:
            nid = ids.make(NodeType.OUTPUT, title)
            # A Dify answer/end node is internal unless it declares otherwise;
            # derive output_kind from the declared boundary so they stay consistent.
            boundary = section.get("boundary")
            external = boundary is not None and str(boundary).strip().lower() == "external"
            props = infer_output_properties(title, external=external)
            apply_declared_properties(props, section, NodeType.OUTPUT)
            builder.add_node(nid, NodeType.OUTPUT, title, props)
            node_map[dify_id] = (nid, NodeType.OUTPUT)
        # Unsupported node kinds are skipped; their edges drop out below.

    for raw_edge in raw_edges:
        if not isinstance(raw_edge, Mapping):
            continue
        src = str(raw_edge.get("source") or "")
        tgt = str(raw_edge.get("target") or "")
        if src not in node_map or tgt not in node_map:
            continue
        src_id, src_kind = node_map[src]
        tgt_id, tgt_kind = node_map[tgt]
        builder.add_edge(src_id, tgt_id, _capability_for(src_kind, tgt_kind))

    # Synthesise each tool's downstream effect (external output / web asset /
    # read) so exfiltration and injection paths surface even when the DSL routes
    # the tool into an internal answer node. Executor tools instead get an
    # executeCode verb on their incoming agent hops.
    for tool_id in tool_nodes:
        props = builder.node_props(tool_id) or {}
        if tool_effect(props) == "executeCode":
            for edge in list(builder.edges):
                if edge.target == tool_id and edge.capability == "invokeTool":
                    builder.add_edge(edge.source, tool_id, "executeCode")
        else:
            synthesize_tool_effect(builder, ids, tool_id, props)

    name = "Dify workflow"
    app = data.get("app")
    if isinstance(app, Mapping) and app.get("name"):
        name = str(app["name"])
    return AnalysisIR(
        analysis_id=analysis_id,
        source_framework=SourceFramework.DIFY,
        metadata=Metadata(name=name),
        nodes=builder.nodes,
        edges=builder.edges,
    )
