from pathlib import Path

from tools.analyze.layer_guard import run_layer_guard


def test_legacy_detector():

    graph, findings = run_layer_guard(Path("."))

    assert any(f.rule == "LEGACY-001" for f in findings)