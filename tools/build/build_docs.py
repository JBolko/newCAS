from subprocess import run
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]

print("newCAS Build Driver v1.1\n")

steps = [
    ("Module Graph",
     ["python", "-m", "tools.analyze.project_graph", "--root", str(ROOT)]),

    ("Layer Guard",
     ["python", "-m", "tools.analyze.layer_guard", "--root", str(ROOT)]),

    ("Runtime Report",
     ["python", "-m", "tools.analyze.runtime_report", "--root", str(ROOT)]),

    ("AST Report",
        ["node", "tools/analyze/ast_report.mjs"]),

    ("Documentation",
        ["python", "-m", "tools.build.generate_architecture_docs",
        "--root", str(ROOT)])
]

for i, (name, command) in enumerate(steps, 1):

    print(f"[{i}/{len(steps)}] {name}...", end=" ")

    result = run(
        command,
        cwd=ROOT,
        capture_output=True,
        text=True
    )

    if result.returncode == 0:
        print("OK")
    else:
        print("FAILED\n")
        print(result.stdout)
        print(result.stderr)
        sys.exit(result.returncode)

print("\nBuild completed.")