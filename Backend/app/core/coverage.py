"""Rule-coverage warnings for framework uploads (plan Phase 3.2).

A framework adapter can't produce every shape the rules look for, so a clean
result on a CrewAI/Dify/LangGraph file doesn't mean the same as a clean result
on a generic one. ``coverage_warnings`` returns the gaps declared for the
analysis' framework in ``catalogs/adapter_coverage.yaml``.

The warnings depend only on the framework, so they're computed on read rather
than stored: analyses saved before this existed get them too.
"""

from __future__ import annotations

from typing import Any

from .catalogs import adapter_coverage_catalog
from .ir.models import SourceFramework


def coverage_warnings(framework: SourceFramework) -> list[dict[str, Any]]:
    """``{kind, rules, message}`` per gap that applies to ``framework``."""
    return [
        {
            "kind": gap["kind"],
            "rules": list(gap["rules"]),
            "message": " ".join(str(gap["message"]).split()),
        }
        for gap in adapter_coverage_catalog()
        if framework.value in gap.get("frameworks", [])
    ]
