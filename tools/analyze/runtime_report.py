from __future__ import annotations

import argparse
import ast
import json
import sys
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


def load_runtime_context(root: Path):
    """
    Byg den samme runtime-context som newCAS selv bruger.

    src/python tilføjes midlertidigt til sys.path, så imports virker
    på samme måde som i Pyodide-runtime.
    """

    python_root = root / "src" / "python"

    path_added = False

    if str(python_root) not in sys.path:
        sys.path.insert(0, str(python_root))
        path_added = True

    try:
        from core.context import build_base_context

        context, forbidden = build_base_context()

        context_symbols = []

        for name in sorted(context, key=str.lower):
            value = context[name]

            context_symbols.append({
                "name": name,
                "callable": callable(value),
                "python_type": type(value).__name__
            })

        return context_symbols, sorted(forbidden, key=str.lower)

    finally:
        if path_added:
            sys.path.remove(str(python_root))


def build_runtime_report(root: Path):

    registry_path = root / "src/python/cas_math/registry.py"

    public_symbols = scan_registry(registry_path)

    context_symbols, forbidden_symbols = load_runtime_context(root)

    public_names = {item["name"] for item in public_symbols}
    context_names = {item["name"] for item in context_symbols}
    forbidden_names = set(forbidden_symbols)

    return {
        "version": 2,

        "public_symbols": public_symbols,

        "base_context": {
            "count": len(context_symbols),
            "symbols": context_symbols
        },

        "forbidden_symbols": {
            "count": len(forbidden_symbols),
            "symbols": forbidden_symbols
        },

        "consistency": {
            "public_missing_from_context":
                sorted(public_names - context_names),

            "public_not_forbidden":
                sorted(public_names - forbidden_names)
        }
    }


def print_report(report):

    public_symbols = report["public_symbols"]
    context = report["base_context"]
    forbidden = report["forbidden_symbols"]
    consistency = report["consistency"]

    print("newCAS Runtime Report\n")

    print(f"Public symbols:    {len(public_symbols)}")
    print(f"BASE_CONTEXT:      {context['count']}")
    print(f"Forbidden symbols: {forbidden['count']}")

    print("\nConsistency")
    print("-----------")

    missing = consistency["public_missing_from_context"]
    redefinable = consistency["public_not_forbidden"]

    if missing:
        print(
            "Public missing from BASE_CONTEXT:",
            ", ".join(missing)
        )
    else:
        print("[OK] All public symbols are in BASE_CONTEXT")

    if redefinable:
        print(
            "Public symbols not forbidden:",
            ", ".join(redefinable)
        )
    else:
        print("[OK] All public symbols are protected")


def main():

    parser = argparse.ArgumentParser(
        description="newCAS Runtime Report"
    )

    parser.add_argument("--root", default=".")

    args = parser.parse_args()

    root = Path(args.root).resolve()

    report = build_runtime_report(root)

    reports_dir = root / "tools/reports"
    reports_dir.mkdir(parents=True, exist_ok=True)

    out = reports_dir / "runtime.json"

    out.write_text(
        json.dumps(
            report,
            indent=2,
            ensure_ascii=False
        ),
        encoding="utf-8"
    )

    print_report(report)

    print(
        f"\nReport written: "
        f"{out.relative_to(root)}"
    )


if __name__ == "__main__":
    main()