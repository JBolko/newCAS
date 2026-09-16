from pathlib import Path
import ast


def module_name_from_path(rel: Path) -> str:
    parts = list(rel.with_suffix("").parts)

    if parts and parts[-1] == "__init__":
        parts = parts[:-1]

    return ".".join(parts)


def _resolve_relative(current_module: str, module: str | None, level: int) -> str:
    parts = current_module.split(".")

    if level:
        parts = parts[: len(parts) - level]

    if module:
        parts.extend(module.split("."))

    return ".".join([p for p in parts if p])


def scan_python_file(path: Path, src_root: Path) -> set[str]:
    current = module_name_from_path(path.relative_to(src_root))
    tree = ast.parse(path.read_text(encoding="utf-8"))

    imports = set()

    for node in ast.walk(tree):

        if isinstance(node, ast.Import):
            for alias in node.names:
                imports.add(alias.name)

        elif isinstance(node, ast.ImportFrom):
            if node.level:
                imports.add(_resolve_relative(current, node.module, node.level))
            elif node.module:
                imports.add(node.module)

    imports.discard("__main__")
    imports.discard("js")

    return imports