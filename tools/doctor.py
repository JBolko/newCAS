from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def ok(message: str) -> None:
    print(f"[OK]   {message}")


def fail(message: str, hint: str | None = None) -> None:
    global HAS_ERRORS

    HAS_ERRORS = True
    print(f"[FAIL] {message}")

    if hint:
        print(f"       {hint}")


def command_version(command: str, args: list[str]) -> str | None:
    executable = shutil.which(command)

    if executable is None:
        return None

    try:
        result = subprocess.run(
            [executable, *args],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=10
        )
    except (OSError, subprocess.TimeoutExpired):
        return None

    if result.returncode != 0:
        return None

    output = result.stdout.strip() or result.stderr.strip()

    return output.splitlines()[0] if output else "available"


def check_file(relative_path: str, hint: str | None = None) -> None:
    path = ROOT / relative_path

    if path.is_file():
        ok(relative_path)
    else:
        fail(f"Missing: {relative_path}", hint)


def check_json(relative_path: str, hint: str | None = None) -> None:
    path = ROOT / relative_path

    if not path.is_file():
        fail(f"Missing: {relative_path}", hint)
        return

    try:
        json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        fail(
            f"Invalid JSON: {relative_path}",
            str(error)
        )
        return

    ok(relative_path)


HAS_ERRORS = False


print("newCAS Doctor\n")

print("Environment")
print("-----------")

python_version = sys.version.split()[0]
ok(f"Python {python_version}")

node_version = command_version("node", ["--version"])

if node_version:
    ok(f"Node {node_version}")
else:
    fail("Node is not available")

npm_version = command_version("npm", ["--version"])

if npm_version:
    ok(f"npm {npm_version}")
else:
    fail("npm is not available")


print("\nProject structure")
print("-----------------")

check_file(
    "docs/Grammatik.pegjs",
    "Grammar source of truth is required."
)

check_file(
    "src/js/parser.mjs",
    "Generated parser is missing."
)

check_file(
    "src/js/transformer.js",
    "Transformer source is required."
)

check_file(
    "src/python/cas_math/registry.py",
    "Public CAS registry is required."
)

check_file(
    "tools/build/build_docs.py"
)

check_file(
    "tools/analyze/runtime_report.py"
)

check_file(
    "tools/analyze/ast_report.mjs"
)


print("\nGenerated artifacts")
print("-------------------")

check_json(
    "tools/reports/runtime.json",
    "Run: npm run tools:runtime"
)

check_json(
    "tools/reports/ast.json",
    "Run: npm run tools:ast"
)

check_file(
    "docs/generated/ARCHITECTURE_REPORT.md",
    "Run: npm run tools:build"
)

print("\nHealth checks")
print("-------------")


# Runtime consistency
runtime_path = ROOT / "tools/reports/runtime.json"

if runtime_path.is_file():
    try:
        runtime = json.loads(
            runtime_path.read_text(encoding="utf-8")
        )

        consistency = runtime.get("consistency", {})

        missing_context = consistency.get(
            "public_missing_from_context", []
        )

        not_forbidden = consistency.get(
            "public_not_forbidden", []
        )

        if not missing_context:
            ok("Registry → BASE_CONTEXT consistency")
        else:
            fail(
                "Public symbols missing from BASE_CONTEXT",
                ", ".join(missing_context)
            )

        if not not_forbidden:
            ok("Public symbols are protected")
        else:
            fail(
                "Public symbols not protected",
                ", ".join(not_forbidden)
            )

    except (OSError, json.JSONDecodeError):
        pass


# Parser / Transformer consistency
ast_path = ROOT / "tools/reports/ast.json"

if ast_path.is_file():
    try:
        ast_report = json.loads(
            ast_path.read_text(encoding="utf-8")
        )

        consistency = ast_report.get("consistency", {})

        parser_missing = consistency.get(
            "parser_not_supported_by_transformer", []
        )

        transformer_uncovered = consistency.get(
            "transformer_not_covered_by_parser_cases", []
        )

        if not parser_missing:
            ok("Parser → Transformer consistency")
        else:
            fail(
                "Parser node types missing from Transformer",
                ", ".join(parser_missing)
            )

        if not transformer_uncovered:
            ok("Transformer → parser case coverage")
        else:
            fail(
                "Transformer node types without parser cases",
                ", ".join(transformer_uncovered)
            )

    except (OSError, json.JSONDecodeError):
        pass

print("\nResult")
print("------")

if HAS_ERRORS:
    print("newCAS development environment has problems.")
    raise SystemExit(1)

print("newCAS development environment is healthy.")