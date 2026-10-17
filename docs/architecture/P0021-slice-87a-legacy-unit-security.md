# P0021 Slice 87a — legacy unit compilation boundary (F4)

## Result, scope, and status

This is a deliberately **legacy-only containment slice**. It closes the reproducible F4
unit-text to Python-source injection found by Claude, *provided* the locally checked
Node 24 verification passes. Legacy `CASEngine` and the Python executor still run
text-generated Python; do **not** infer that the overall legacy engine has passed a
security audit or is ready for student use.

- `src/js/legacy/compile-legacy-unit.js` is a syntax-checked, bounded unit-expression
  compiler. It only accepts named units exported by the existing legacy UNITS/context,
  and optional `*`, `/`, parentheses and integer powers between -12 and +12.
- Input cannot contain Python calls, identifiers outside that set, quotes, semicolons,
  attribute access, other punctuation, unrestricted nesting, or unrestricted length.
- Quantity emits Python *only* from vetted syntax-tree tokens. Conversion targets are
  a **single named known unit**, emitted via a quoted string literal. Composite target
  conversion is rejected until the old Python converter defines its semantics;
  silently accepting it would misrepresent capability.
- `min`, `g` and `N` keep their existing legacy aliases (`minute`, `gram`, `newton`).
- **Only** `src/js/transformer.js` imports this compiler. The P0021 Semantic IR,
  OperationSpec, Value, task evaluation, and stateless Python Worker are unchanged.
- Parser grammar (`docs/Grammatik.pegjs`) and generated `parser.mjs` are untouched;
  their canonical-sync audit is a separate Slice 88 concern.

## Risk that remains

1. Dynamic Python `exec` / `eval` still exists in retiring `src/python/core`.
   This slice does not claim it is safe for arbitrary untrusted files.
2. F4's known four malicious unit-input cases are now mandatory tests and must be GREEN,
   but other Python-generation sites have not been exhaustively audited.
3. Python conversion of composite targets, unknown symbols and unsupported unit spellings
   is intentionally **fail closed**, not a silent fallback.
4. Full Node 24 and Python regressions must be accepted on the user's actual checkout.
   No additional real-browser claim is made by this slice.

## Multi-statement source — follow-up architectural decision, not implemented here

`Program` already parses semicolon-delimited statements, and the desired
`a:=1; b:=3; resultat:=a b` is a sensible future source construct. It is not
permitted to reinterpret its multiple writers as a single source writer or to
silently execute one of its assignments. Before enabling evaluation, specify
stable **intra-block statement identity and order**, nearest-writer resolution,
mutation invalidation, partial failures, and whether each statement has its own
presentation/result. Do not introduce a second runtime. The choice of `;` versus
another separator is not what blocks support.

## Disposal of one-shot migration scripts

After all local Node 24/Python tests pass, `p0021-slice-87a-verify.ps1` removes
only *exact, hash-matching* one-time `tools/migrations/p0021-slice-84-*.ps1`
and `p0021-slice-86a-verify.ps1` files, plus the two one-shot root
`SLICE85A_README.md`/`SLICE86A_README.md` files. It preserves changed files and all
normative/architectural documents, implementation, tests and reports.
The Slice 87a verification script itself is a disposable one-shot script; after
returning its logs and accepting GREEN, delete only that script manually.

## Verification

1. `node --test tests/js/p0021-slice-87a-legacy-unit-boundary.test.mjs tests/pilot/05-legacy-injection-and-exec-surface.test.mjs`
2. `node --test` (Node 24)
3. `python -m unittest discover -s tests/python -p 'test_*.py' -v`
4. Real browser/Pyodide validation remains separate.
