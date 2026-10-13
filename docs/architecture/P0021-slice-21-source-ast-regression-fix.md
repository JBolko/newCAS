# P0021 Slice 21 — existing source AST test update

The Slice 19 test `source AST: source variable is not guessed from Python scope` expected `/unsupported node/` because a `Variable` was not yet supported. Slice 21 intentionally supports `Variable` only when a document-owned `resolveVariable` binding is supplied; without it the compiler now throws `variable x requires document-owned binding`.

This patch updates exactly the expected rejection message. It preserves the same invariant: an unresolved source variable must not fall through to a Python scope, and no guessing is permitted.

Only a test and this note change. No production files. Locally verified against Slice 21 source: Slice 19 and Slice 21 targeted tests, **22/22 PASS**. Run `node --test` in the full repository after unpacking.
