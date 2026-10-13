# P0019 Slice 1 — OperationSpec argument plan

**Scope:** P0008 argument signature selection only. No document-semantic resolution or new Python dispatcher.

A generic `planOperationArguments(spec,arity)` selects P0008 signatures and returns immutable per-position roles, or `wrong-arity`. This is a prerequisite for source-aware P0019 symbolic-target handling; it does not itself resolve `x`, inspect document state or construct P0007 Semantic IR. Avoid equating these policy tests with full source-to-evaluator integration.

Tests: `node --test tests/js/p0019-operation-argument-plan.test.mjs` (7 new).

Full: `node --test` (expected 355 from prior 348), then P0012/P0011 suites unchanged at 191 and 16. Retain P0018 parking decision.

Important: the current P0008 catalogue contains temporary `probe.symbolic.*` evaluator identifiers. Do not promote these to permanent public identifiers implicitly.
