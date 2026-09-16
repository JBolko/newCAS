from pathlib import Path

from tools.analyze.import_scanner import module_name_from_path, scan_imports
from tools.analyze.project_graph import build_project_graph


def test_module_name_from_path():
    root = Path("/project/src/python")
    assert module_name_from_path(root / "cas_math" / "statistics.py", root) == "cas_math.statistics"
    assert module_name_from_path(root / "core" / "__init__.py", root) == "core"
    assert module_name_from_path(root / "bootstrap.py", root) == "bootstrap"


def test_relative_imports_are_resolved(tmp_path):
    root = tmp_path / "src" / "python"
    (root / "core").mkdir(parents=True)
    path = root / "core" / "executor.py"
    path.write_text(
        "from .context import build_base_context\n"
        "from .scope import task_registry\n"
        "from output.result import wrap_result\n",
        encoding="utf-8",
    )

    imports = scan_imports(path, "core.executor")

    assert "core.context" in imports
    assert "core.scope" in imports
    assert "output.result" in imports


def test_build_graph_excludes_tests_by_default(tmp_path):
    python_root = tmp_path / "src" / "python"
    (python_root / "core").mkdir(parents=True)
    (python_root / "tests").mkdir(parents=True)

    (python_root / "core" / "__init__.py").write_text("", encoding="utf-8")
    (python_root / "core" / "context.py").write_text("", encoding="utf-8")
    (python_root / "tests" / "test_context.py").write_text("", encoding="utf-8")

    graph = build_project_graph(tmp_path)

    assert "core" in graph.modules
    assert "core.context" in graph.modules
    assert "tests.test_context" not in graph.modules


def test_build_graph_includes_tests_when_requested(tmp_path):
    python_root = tmp_path / "src" / "python"
    (python_root / "tests").mkdir(parents=True)
    (python_root / "tests" / "test_context.py").write_text("", encoding="utf-8")

    graph = build_project_graph(tmp_path, include_tests=True)

    assert "tests.test_context" in graph.modules
