"""GET /capabilities: the capability catalog (``catalogs/capabilities.yaml``)."""

from __future__ import annotations

from fastapi import APIRouter

from ...core.catalogs import capability_catalog

router = APIRouter()


@router.get("/capabilities", summary="List the capability verbs and the rules that evaluate each")
def list_capabilities() -> dict:
    # Catalog order (the agent cognitive cycle) is kept so clients can group by
    # phase. An empty evaluated_by means the verb is vocabulary only: accepted on
    # edges and drawn in the graph, but no rule checks it.
    return {
        "capabilities": [
            {
                "verb": verb,
                "description": descriptor.get("description", ""),
                "typical_source": descriptor.get("typical_source"),
                "typical_target": descriptor.get("typical_target"),
                "evaluated_by": list(descriptor.get("evaluated_by") or []),
            }
            for verb, descriptor in capability_catalog().items()
        ]
    }
