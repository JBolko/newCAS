from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

from .project_graph import build_project_graph


@dataclass
class Finding:
    rule: str
    level: str      # "warning" eller "error"
    message: str
    module: str


def run_layer_guard(root: Path):

    graph = build_project_graph(root)

    findings: list[Finding] = []

    # -------------------------------------------------
    # LEGACY-001
    # -------------------------------------------------

    for name in sorted(graph.modules):

        if name.endswith("_old"):

            findings.append(
                Finding(
                    "LEGACY-001",
                    "warning",
                    "Legacy module detected.",
                    name,
                )
            )

    # -------------------------------------------------
    # LAYER-001
    # -------------------------------------------------

    for name, module in graph.modules.items():

        if name.startswith("cas_math"):

            for imp in sorted(module.internal_imports):

                if imp.startswith("core."):

                    findings.append(
                        Finding(
                            "LAYER-001",
                            "error",
                            "cas_math må ikke importere core.*",
                            f"{name} -> {imp}",
                        )
                    )

    # -------------------------------------------------
    # LAYER-002
    # -------------------------------------------------

    for name, module in graph.modules.items():

        if name.startswith("output"):

            for imp in sorted(module.internal_imports):

                if imp == "core.executor":

                    findings.append(
                        Finding(
                            "LAYER-002",
                            "error",
                            "output må ikke importere core.executor",
                            f"{name} -> {imp}",
                        )
                    )

    # -------------------------------------------------
    # LAYER-003
    # -------------------------------------------------

    registry = graph.modules.get("cas_math.registry")

    if registry:

        for imp in sorted(registry.internal_imports):

            if imp.startswith("core.executor"):

                findings.append(
                    Finding(
                        "LAYER-003",
                        "error",
                        "registry må ikke importere executor",
                        f"cas_math.registry -> {imp}",
                    )
                )

    return graph, findings


def print_report(graph, findings):

    print("newCAS Layer Guard v1")
    print()

    print(f"Modules:         {graph.module_count}")
    print(f"Internal edges:  {graph.internal_edge_count}")
    print("Rules checked:   4")
    print()

    if findings:

        print("Findings")
        print("--------")

        for f in findings:

            icon = "!" if f.level == "warning" else "X"

            print(f"{icon} {f.rule}")
            print(f"  {f.module}")
            print(f"  {f.message}")
            print()

    else:

        print("No findings.")
        print()

    errors = sum(f.level == "error" for f in findings)
    warnings = sum(f.level == "warning" for f in findings)

    print("Summary")
    print("-------")
    print(f"Errors:   {errors}")
    print(f"Warnings: {warnings}")


def main():

    parser = argparse.ArgumentParser()

    parser.add_argument("--root", default=".")

    args = parser.parse_args()

    graph, findings = run_layer_guard(Path(args.root))

    print_report(graph, findings)

    raise SystemExit(
        1 if any(f.level == "error" for f in findings) else 0
    )


if __name__ == "__main__":
    main()