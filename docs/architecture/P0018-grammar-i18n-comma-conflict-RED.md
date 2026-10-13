# P0018 — Grammar/i18n comma collision (RED probe)

**Scope:** no production changes, no P0005–P0012 contract modifications.

Current Peggy grammar has `Number = [0-9]+([.,][0-9]+)?` and `Args` accepts `[;,]` separators. Therefore `f(1,5)` can parse as **one argument** containing decimal 1.5, though the same spelling can conventionally indicate **two arguments** 1 and 5.

Proposed layering for review (not yet an architectural decision):

- Preserve locale-neutral numerical transport and SymPy boundary (`.`). The parser's AST uses numeric values, not localized strings.
- Decide input locale policy in editing/language-front-end. Danish locale may permit `1,5` decimals and recommend `;` for separating arguments; English locale may use `1.5` and `,`.
- Avoid replacing every comma blindly; lexical context and ambiguous constructs matter.
- Do **not** change FunctionCall versus multiplication semantics or introduce a new registry as part of this probe.

Test from the repository root with the existing Peggy dependency installed:

```powershell
node --test tools/probes/p0018_grammar_i18n_red.mjs
```

Expected on the **current unmodified grammar**: two GREEN tests and **one deliberately RED**. It demonstrates a collision, not an accidental regression. It is intentionally placed under `tools/probes`, not `tests/js`, to preserve the normal green regression baseline. The probe does not prove browser/UI locale handling; that belongs to a later separate slice.

The 27 Python `.py` test files uploaded have been inventoried (excluding cached bytecode). They cover P0011 adapter and P0012 selected Python handler boundaries, but are not a current end-to-end JS grammar/DocumentRuntime test harness.
