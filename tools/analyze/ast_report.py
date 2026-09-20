from __future__ import annotations

import argparse
import json
from pathlib import Path


def collect_node_types(tree, node_types):
    if isinstance(tree, dict):
        if "type" in tree:
            node_types.add(tree["type"])
        for value in tree.values():
            collect_node_types(value, node_types)
    elif isinstance(tree, list):
        for item in tree:
            collect_node_types(item, node_types)


def main():

    parser = argparse.ArgumentParser(description="newCAS AST Report")
    parser.add_argument("--root", default=".")
    args = parser.parse_args()

    root = Path(args.root)

    examples = root / "tools/examples"

    node_types = set()

    if examples.exists():
        for file in sorted(examples.glob("*.json")):
            try:
                data = json.loads(file.read_text(encoding="utf-8"))
                collect_node_types(data, node_types)
            except Exception:
                pass

    report = {
        "version": 1,
        "node_types": sorted(node_types)
    }

    reports = root / "tools/reports"
    reports.mkdir(parents=True, exist_ok=True)

    out = reports / "ast.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print("newCAS AST Report\n")
    print(f"Node types: {len(node_types)}\n")

    for name in sorted(node_types):
        print(f"  {name}")

    print(f"\nReport written: {out.relative_to(root)}")


if __name__ == "__main__":
    main()