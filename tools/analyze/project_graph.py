from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import argparse

from .import_scanner import scan_python_file, module_name_from_path


@dataclass
class ModuleInfo:
    name: str
    path: Path
    internal_imports: set[str] = field(default_factory=set)
    external_imports: set[str] = field(default_factory=set)


@dataclass
class ProjectGraph:
    modules: dict[str, ModuleInfo] = field(default_factory=dict)

    @property
    def module_count(self):
        return len(self.modules)

    @property
    def internal_edge_count(self):
        return sum(len(m.internal_imports) for m in self.modules.values())

    @property
    def external_import_count(self):
        return sum(len(m.external_imports) for m in self.modules.values())

    def format_text(self):
        lines = [
            "newCAS Module Graph",
            "",
            f"Python modules:    {self.module_count}",
            f"Internal edges:    {self.internal_edge_count}",
            f"External imports:  {self.external_import_count}",
            "",
            "Internal architecture",
            "---------------------",
            "",
        ]

        for name in sorted(self.modules):
            mod = self.modules[name]

            lines.append(name)

            for dep in sorted(mod.internal_imports):
                lines.append(f"  -> {dep}")

            lines.append("")

        external = sorted(
            {
                dep
                for mod in self.modules.values()
                for dep in mod.external_imports
            }
        )

        lines.extend(
            [
                "External dependencies",
                "---------------------",
                "",
            ]
        )

        lines.extend(external)

        return "\n".join(lines)

    def format_tree(self):
        roots = sorted(
            name
            for name in self.modules
            if not any(
                name in m.internal_imports
                for m in self.modules.values()
            )
        )

        def walk(name: str, prefix=""):
            lines = [prefix + name]

            children = sorted(self.modules[name].internal_imports)

            for i, child in enumerate(children):
                branch = "└── " if i == len(children) - 1 else "├── "
                lines.extend(walk(child, prefix + branch))

            return lines

        out = ["newCAS Runtime Tree", ""]

        for r in roots:
            out.extend(walk(r))
            out.append("")

        return "\n".join(out)


def build_project_graph(root: Path, include_tests=False):
    src = root / "src" / "python"

    graph = ProjectGraph()
    module_names = {}

    for py in src.rglob("*.py"):
        rel = py.relative_to(src)

        if not include_tests and rel.parts and rel.parts[0] == "tests":
            continue

        name = module_name_from_path(rel)
        module_names[name] = py
        graph.modules[name] = ModuleInfo(name=name, path=py)

    for name, py in module_names.items():
        imports = scan_python_file(py, src)

        for imp in imports:
            if imp in module_names:
                graph.modules[name].internal_imports.add(imp)
            else:
                graph.modules[name].external_imports.add(imp.split(".")[0])

    return graph


def main():
    parser = argparse.ArgumentParser()

    parser.add_argument("--root", default=".")
    parser.add_argument("--include-tests", action="store_true")
    parser.add_argument("--tree", action="store_true")

    args = parser.parse_args()

    graph = build_project_graph(Path(args.root), args.include_tests)

    if args.tree:
        print(graph.format_tree())
    else:
        print(graph.format_text())


if __name__ == "__main__":
    raise SystemExit(main())