from __future__ import annotations

import argparse
import json
from pathlib import Path

from tools.analyze.project_graph import build_project_graph


def allowed_target(target: str, allowed: list[str]) -> bool:
    return any(
        target == rule or target.startswith(rule + ".")
        for rule in allowed
    )


def main():
    parser = argparse.ArgumentParser(description="newCAS Layer Guard")
    parser.add_argument("--root", default=".")

    args = parser.parse_args()

    root = Path(args.root)

    graph = build_project_graph(root)

    policy = json.loads(
        (root / "tools/policy/layer_policy.json").read_text(
            encoding="utf-8"
        )
    )

    violations = []

    for module_name, module in sorted(graph.modules.items()):

        base = next(
            (
                name
                for name in policy
                if module_name == name
                or module_name.startswith(name + ".")
            ),
            None,
        )

        if base is None:
            continue

        for dep in sorted(module.internal_imports):

            if not allowed_target(dep, policy[base]):
                violations.append((module_name, dep, base))

    print("newCAS Layer Guard\n")
    print(f"Modules: {graph.module_count}")
    print(f"Internal edges: {graph.internal_edge_count}")
    print(f"Violations: {len(violations)}\n")

    if violations:

        for module, dep, rule in violations:
            print("LAYER-001")
            print(f"  Module : {module}")
            print(f"  Import : {dep}")
            print(f"  Policy : {rule}\n")

        raise SystemExit(1)

    print("[OK] Architecture OK")


if __name__ == "__main__":
    main()