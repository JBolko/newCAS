# P0021 Slice 92b — mandatory pilot regressions and non-dummy npm test

**Status:** GREEN candidate; final acceptance on project's pinned Node 24 / Python environment.
**Scope:** test harness only. No grammar, Semantic IR, DocumentRuntime, Worker, Python evaluator, legacy security boundary, or frozen architecture changes.

## Why

Claude's S90a independent review (finding B4) observed that two *already passing* probes were still wrapped as `knownGap`. A future failure inside such a test could be reported as `TODO`, without making `node --test` fail. `npm test` also just printed a placeholder message. These two problems undermine the RED–YELLOW–GREEN acceptance gate.

## Changes

1. Promote the existing hostile/incomplete-source differential fuzz (F1/F2) into an ordinary, mandatory Node test. It still checks **incremental vs. fresh document state** for 30 × 15 hostile edits; the other 100 × 25 normal edits remain unchanged.
2. Promote the generated-vs-canonical parser AST equivalence probe (F3) into an ordinary, mandatory Node test. Use `cache: true` for the regenerated reference, matching Slice 91a's parser generator. The parser and grammar are **not modified**.
3. Make `npm test` run **both complete suites** via `test:js` (`node --test`, including `tests/pilot`) and `test:python` (`unittest discover`).
4. Add a small test-harness contract test so these gates cannot accidentally revert to `TODO` or to an `echo` stub.

## Acceptance

- `node tools/build/generate_canonical_parser.mjs --check` succeeds with the *already generated* parser from S91a. The verifier deliberately does **not** rewrite generated code.
- Focused regression (S92b guard, hostile fuzz, parser language probes): zero unexpected failures, and the two promoted probes do not carry TODO markers. The still-open F4 and F8 probes are **intentionally** TODO.
- `npm test`: full JS and Python exit 0 on the user's Node 24 environment. Any mandatory JS/Python failure must make `npm test` fail.
- No change in production or security status: **legacy B2 remains open**; student release remains blocked. The existing `knownGap` helper is retained for genuinely open gaps.

## Next

Review function-definition compilation (S93) against the normative v1 contracts **before** attempting multi-statement evaluation (v2 addendum). Do not merge compilers or create a second document runtime as a shortcut.
