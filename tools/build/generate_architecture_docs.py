from __future__ import annotations

import argparse
import json
from pathlib import Path


def load_json(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"Missing report: {path}")

    return json.loads(path.read_text(encoding="utf-8"))


def status(ok: bool) -> str:
    return "OK" if ok else "FAIL"


def generate(root: Path) -> Path:
    reports = root / "tools" / "reports"

    runtime = load_json(reports / "runtime.json")
    ast = load_json(reports / "ast.json")

    public_symbols = runtime.get("public_symbols", [])
    base_context = runtime.get("base_context", {})
    forbidden = runtime.get("forbidden_symbols", {})
    runtime_consistency = runtime.get("consistency", {})

    ast_node_types = ast.get("node_types", [])
    ast_consistency = ast.get("consistency", {})

    public_missing = runtime_consistency.get(
        "public_missing_from_context", []
    )
    public_not_forbidden = runtime_consistency.get(
        "public_not_forbidden", []
    )

    parser_missing = ast_consistency.get(
        "parser_not_supported_by_transformer", []
    )
    transformer_uncovered = ast_consistency.get(
        "transformer_not_covered_by_parser_cases", []
    )

    lines = [
        "# newCAS — Generated Architecture Report",
        "",
        "> **AUTO-GENERATED — DO NOT EDIT MANUALLY.**",
        ">",
        "> Generated from the current newCAS source and analysis reports.",
        "",
        "## Runtime API",
        "",
        f"- Public newCAS symbols: **{len(public_symbols)}**",
        f"- BASE_CONTEXT symbols: **{base_context.get('count', 0)}**",
        f"- Forbidden symbols: **{forbidden.get('count', 0)}**",
        "",
        "### Runtime consistency",
        "",
        f"- Registry → BASE_CONTEXT: **{status(not public_missing)}**",
        f"- Public symbols protected: **{status(not public_not_forbidden)}**",
        "",
        "## Parser and Transformer",
        "",
        f"- Parser: `{ast.get('parser', 'unknown')}`",
        f"- Transformer: `{ast.get('transformer', 'unknown')}`",
        f"- AST node types: **{len(ast_node_types)}**",
        "",
        "### AST node types",
        "",
    ]

    for node_type in ast_node_types:
        lines.append(f"- `{node_type}`")

    lines.extend([
        "",
        "### Parser / Transformer consistency",
        "",
        f"- Parser → Transformer: **{status(not parser_missing)}**",
        f"- Transformer → parser cases: **{status(not transformer_uncovered)}**",
        "",
        "## Public newCAS functions",
        "",
    ])

    for symbol in public_symbols:
        name = symbol.get("name", "?")
        target = symbol.get("target", "?")
        lines.append(f"- `{name}` → `{target}`")

    lines.extend([
        "",
        "---",
        "",
        "This file contains machine-derived facts.",
        "Architectural decisions and rationale belong in the",
        "human-maintained styredokumenter and ADRs.",
        "",
    ])

    out_dir = root / "docs" / "generated"
    out_dir.mkdir(parents=True, exist_ok=True)

    out = out_dir / "ARCHITECTURE_REPORT.md"

    out.write_text(
        "\n".join(lines),
        encoding="utf-8"
    )

    return out


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate newCAS architecture documentation"
    )
    parser.add_argument("--root", default=".")

    args = parser.parse_args()
    root = Path(args.root).resolve()

    out = generate(root)

    print("newCAS Documentation Generator\n")
    print(f"Generated: {out.relative_to(root)}")


if __name__ == "__main__":
    main()