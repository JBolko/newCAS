# P0021 Slice 92a — legacy builtin namespace boundary

**State:** GREEN candidate; Node 24 and Windows acceptance pending.

## Why

Claude's S90a review B2 observed that the retiring source-to-Python path
(`Transformer` → `core.scope.exec` / `core.executor.eval`) exposed CPython's
ambient builtins. Under Python's normal `exec()` semantics, a globals mapping
without `__builtins__` gets an implicit copy of the full builtin dictionary.
S87a guarded legacy unit compilation; it did not prevent this other entry.

## Scope, no shortcuts

This slice edits **only** `src/python/core/*` (retiring executor), adds its
own Python regression file, and records this note. No change to the frozen
v1 contract, grammar, `Transformer`, Semantic IR, attested evaluator or Worker.

A single immutable `LEGACY_SAFE_BUILTINS` mapping provides only elementary
math-compatible Python builtins. It is installed on every legacy base context
construction, and reasserted whenever task-local dictionaries are merged or
consulted as execution globals. Document-defined names cannot replace the
privileged `__builtins__` key in the interpreter's global mapping.

**This is explicitly not a Python sandbox.** Other callable SymPy entry points
still exist in legacy's broad base context, and Python code generation is
still present. Treat all source-derived legacy evaluation as untrusted; do not
promote this to a student-release/security-complete claim.

## Evidence and limits

* Local Python suite: 264 tests GREEN, including six new S92a tests.
* Legacy JS safety / unit tests: 16 GREEN on local Node 22; full Node 24
  acceptance must be performed in the user's environment.
* Checks: immutable allowlist; no ambient `open`, `eval`, `exec`,
  `__import__`, `globals`, `compile`, `getattr`, `breakpoint`; task-scope
  poisoning of the `__builtins__` key cannot change the trusted global;
  ordinary arithmetic and source function calls remain operational;
  the new Python evaluator/adapters do not import this retired scope.
* No hostile filesystem/OS payload was executed.
* B2 overall stays **PARTIAL/OPEN** until legacy dynamic code generation is
  retired and the UI is migrated. This change does not make `sympify` safe.

## Follow-up

Do not duplicate the function catalog by hard-coding names in Peggy or the
new Semantic IR. If legacy must remain active longer, scrutinize the entire
existing `BASE_CONTEXT` call surface in a separate bounded contract slice.
In particular, avoid turning runtime function-name filtering into a second
semantic resolver. Prefer the planned UI migration to the attested IR path.
