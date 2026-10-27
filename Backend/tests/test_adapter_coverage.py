"""``catalogs/adapter_coverage.yaml`` matches what each adapter can reach.

Each ``coverage_<framework>.yaml`` fixture is written to reach every rule its
adapter can express, using the declarations the catalog names. So for each
framework the rules that fire must be exactly the catalog minus its
``not_expressible`` gaps. A rule that becomes reachable (or stops being) fails
here until the catalog and the fixture are updated together.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.core.catalogs import adapter_coverage_catalog, rule_catalog
from app.core.coverage import coverage_warnings
from app.core.ir.models import NodeType, SourceFramework
from app.core.parser.adapters._common import declarable_properties
from app.core.pipeline import analyze_text
from app.main import app

from .conftest import fixture_text, rule_ids

client = TestClient(app)

FRAMEWORKS = [SourceFramework.CREWAI, SourceFramework.DIFY, SourceFramework.LANGGRAPH]


def _gap_rules(framework: SourceFramework, kind: str) -> set[str]:
    return {
        rule
        for gap in adapter_coverage_catalog()
        if gap["kind"] == kind and framework.value in gap["frameworks"]
        for rule in gap["rules"]
    }


def _strip_declarations(text: str) -> str:
    """Drop the property declarations the needs_declaration gaps ask for."""
    for declared in (
        "capability_kinds: [deployRelease]",
        "recipient_type: public_channel",
        "trust_level: trusted_core",
        "exposure_boundary: external",
        "authentication_scope: elevated",
        "contains_regulated_data: [gdpr]",
        "shared: true",
    ):
        text = text.replace(f", {declared}", "").replace(f"{declared}, ", "").replace(declared, "")
    # Data assets: the external boundary is the FH-025 declaration; outputs
    # keep theirs, which the frameworks infer anyway (and Dify needs, see below).
    text = text.replace("Partner feed, boundary: external", "Partner feed")
    text = text.replace("Partner feed, type: data_asset, boundary: external", "Partner feed, type: data_asset")
    return text


def test_catalog_entries_are_well_formed():
    rules = set(rule_catalog())
    valid = {f.value for f in FRAMEWORKS}
    for gap in adapter_coverage_catalog():
        assert gap["kind"] in {"not_expressible", "needs_declaration"}, gap
        assert gap["rules"] and set(gap["rules"]) <= rules, gap
        assert gap["frameworks"] and set(gap["frameworks"]) <= valid, gap
        assert str(gap["message"]).strip(), gap
        # needs_declaration names its properties so a client can render its own
        # text; each one must be a real property and appear in the message.
        if gap["kind"] == "needs_declaration":
            assert gap["properties"], gap
            for prop in gap["properties"]:
                assert any(prop in declarable_properties(t) for t in NodeType), (gap, prop)
                assert f"`{prop}" in gap["message"], (gap, prop)
        else:
            assert not gap.get("properties"), gap


def test_a_rule_is_not_both_expressible_and_not_for_one_framework():
    for framework in FRAMEWORKS:
        overlap = _gap_rules(framework, "not_expressible") & _gap_rules(framework, "needs_declaration")
        assert not overlap, (framework, overlap)


@pytest.mark.parametrize("framework", FRAMEWORKS, ids=lambda f: f.value)
def test_fixture_reaches_exactly_the_expressible_rules(framework):
    findings = analyze_text(fixture_text(f"coverage_{framework.value}.yaml")).findings
    expected = set(rule_catalog()) - _gap_rules(framework, "not_expressible")
    fired = rule_ids(findings)
    assert fired == expected, {"missing": sorted(expected - fired), "unexpected": sorted(fired - expected)}


@pytest.mark.parametrize("framework", FRAMEWORKS, ids=lambda f: f.value)
def test_needs_declaration_rules_depend_on_the_declaration(framework):
    # Without the declared properties, the needs_declaration rules go quiet.
    text = _strip_declarations(fixture_text(f"coverage_{framework.value}.yaml"))
    fired = rule_ids(analyze_text(text).findings)
    still_firing = fired & _gap_rules(framework, "needs_declaration")
    if framework == SourceFramework.DIFY:
        # The stripped Dify fixture keeps `boundary: external` on its answer
        # node, so FH-004/FH-034 still fire; that's the declaration they need.
        still_firing -= {"FH-004", "FH-034"}
    assert not still_firing, sorted(still_firing)


def test_generic_has_no_warnings():
    assert coverage_warnings(SourceFramework.GENERIC) == []


def test_warnings_carry_kind_rules_properties_and_one_line_message():
    warnings = coverage_warnings(SourceFramework.CREWAI)
    assert warnings
    for warning in warnings:
        assert set(warning) == {"kind", "rules", "message", "properties"}
        assert "\n" not in warning["message"]
    declared = {r for w in warnings if w["kind"] == "needs_declaration" for r in w["rules"]}
    assert {"FH-012", "FH-017", "FH-025", "FH-026"} <= declared


def test_api_returns_warnings_on_parse_detail_and_analyze():
    created = client.post(
        "/analyses",
        files={"file": ("coverage_dify.yaml", fixture_text("coverage_dify.yaml"), "application/x-yaml")},
    )
    assert created.status_code == 200, created.text
    body = created.json()
    expected = coverage_warnings(SourceFramework.DIFY)
    assert body["warnings"] == expected

    analysis_id = body["analysis_id"]
    assert client.get(f"/analyses/{analysis_id}").json()["warnings"] == expected
    analyzed = client.post(f"/analyses/{analysis_id}/analyze")
    assert analyzed.status_code == 200, analyzed.text
    assert analyzed.json()["warnings"] == expected


def test_api_appends_ignored_property_warnings_after_coverage():
    text = "agents:\n  clerk:\n    role: Clerk\n    data_assets: [{name: Patients, sensitivty: high}]\ntasks: {}\n"
    created = client.post("/analyses", files={"file": ("crew.yaml", text, "application/x-yaml")})
    assert created.status_code == 200, created.text
    warnings = created.json()["warnings"]
    coverage = coverage_warnings(SourceFramework.CREWAI)
    assert warnings[: len(coverage)] == coverage
    [ignored] = warnings[len(coverage) :]
    assert ignored["kind"] == "ignored_property"
    assert ignored["suggestion"] == "sensitivity"

    # Stored with the analysis, so the detail and analyze responses repeat it.
    analysis_id = created.json()["analysis_id"]
    assert client.get(f"/analyses/{analysis_id}").json()["warnings"] == warnings
    assert client.post(f"/analyses/{analysis_id}/analyze").json()["warnings"] == warnings


def test_api_generic_upload_has_empty_warnings():
    created = client.post(
        "/analyses",
        files={"file": ("hiresmart_generic.yaml", fixture_text("hiresmart_generic.yaml"), "application/x-yaml")},
    )
    assert created.json()["warnings"] == []
