# P0020 Slice 1 — writer establishment from parsed AST

**Scope: bounded pure helper, not a DocumentRuntime migration.**

A structurally valid, fully parsed assignment or function definition
establishes a writer *before* resolution/evaluation succeeds. The writer
is identified by its owning block ID, task scope, name, and document
position. Mathematical failures or unavailable Values do not undo it.

This helper intentionally accepts one parsed source statement per block.
An empty/multiple-statement program establishes no writer under this
bounded API rather than guessing sub-block positions. The parser must
have already accepted the **complete** source. Real parser errors and
writer positions/identities remain caller responsibilities.

Only `Assignment` and `FunctionDefinition` establish writers here.
Function parameters must be unique valid identifiers. Syntactically
valid bodies are not evaluated to establish a writer.

This does NOT: resolve lexical capture, change the old document dependency
analyzer, dispatch to Python, implement full document transaction semantics,
or change any frozen contract.

## Verification

10 local tests passed against current extracted P0006/P0007 modules and
P0019 Slice 4 resolver. No whole-repository test claim. New files only.

From newCAS repository root:

```powershell
Expand-Archive -LiteralPath ".\P0020-slice-1-writer-establishment.zip" -DestinationPath "." -Force
node --test tests/js/p0020-writer-establishment.test.mjs
node --test
```

Expected JS suite **388** (= 378 + 10) if prior baseline unchanged.
Last Python baseline is 191 + 16, unchanged by this JS-only slice.

## Next

P0020 Slice 2: real parse-to-writer fixture using current Peggy grammar;
then integrate positional binding into one small *derived* document-analysis
boundary, maintaining the frozen `no success-dependent fallback` semantics.
