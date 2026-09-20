from __future__ import annotations

import argparse
import ast
import json
from pathlib import Path


def scan_registry(registry_path: Path):
    """Find alle _reg("navn", funktion)-kald i registry.py."""

    tree = ast.parse(registry_path.read_text(encoding="utf-8"))

    symbols = []

    for node in ast.walk(tree):

        if not isinstance(node, ast.Call):
            continue

        if not isinstance(node.func, ast.Name):
            continue

        if node.func.id != "_reg":
            continue

        if len(node.args) < 2:
            continue

        try:
            name = ast.literal_eval(node.args[0])
        except Exception:
            continue

        target = ast.unparse(node.args[1])

        symbols.append({
            "name": name,
            "target": target
        })

    return sorted(symbols, key=lambda x: x["name"].lower())


def build_runtime_report(root: Path):

    registry = root / "src/python/cas_math/registry.py"

    return {
        "version": 1,
        "public_symbols": scan_registry(registry)
    }


def print_report(report):

    symbols = report["public_symbols"]

    print("newCAS Runtime Report\n")
    print(f"Public symbols: {len(symbols)}\n")

    print("Examples")
    print("--------")

    for s in symbols[:10]:
        print(f"{s['name']:15} -> {s['target']}")

    if len(symbols) > 10:
        print("...")


def main():

    parser = argparse.ArgumentParser(description="newCAS Runtime Report")
    parser.add_argument("--root", default=".")

    args = parser.parse_args()

    root = Path(args.root)

    report = build_runtime_report(root)

    reports_dir = root / "tools/reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    out = reports_dir / "runtime.json"

    out.write_text(
        json.dumps(report, indent=2),
        encoding="utf-8"
    )

    print_report(report)

    print(f"\nReport written: {out.relative_to(root)}")


if __name__ == "__main__":
    main()