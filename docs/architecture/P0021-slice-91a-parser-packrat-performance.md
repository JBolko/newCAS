# P0021 Slice 91a — canonical parser packrat memoization

**Status:** GREEN candidate until Node 24 + Python verification on the authoritative checkout. **Scope:** parser *generation policy*, regenerated derived parser, and regression tests. FROZEN v1.0 unchanged.

## Trigger / evidence

Claude S90a follow-up B1 reproduced exponential parsing time on short nested source. The report records approx. 5 seconds for `f(` repeated 10 times and milliseconds for memoized Peggy output, with 20,000 identical parsed ASTs/errors. We have inspected the supplied probe code, not rerun those timings on the user's Windows checkout.

## Design decision

- Keep `docs/Grammatik.pegjs` as the **only** canonical grammar. No grammar rule, DocumentRuntime, IR, Value, identity, Worker or Python module changes.
- Enable Peggy's supported `cache: true` option in `tools/build/generate_canonical_parser.mjs`; `src/js/parser.mjs` stays **derived**, regenerated on the user's Node 24 environment by the supplied verifier. Do not hand-edit parser source.
- Update the exact-generation guard from S88a and the pilot's comparison generator, so both match this build policy.
- Guard nested complete and incomplete source with a *subprocess timeout* (rather than allowing a CI test to hang). Prove representative AST and diagnostic equivalence with a deterministic corpus.
- Do **not** introduce arbitrary source-size, nesting-depth or lexeme limits in this slice. Those require a reviewed input/resource policy, structured Diagnostic v1 behavior and checks at the canonical source ingress (without silently changing math semantics). Packrat caching trades memory for parsing time and is **not** a complete resource-abuse defense.

## RED → GREEN acceptance

1. With the new generator but the old derived parser, `node tools/build/generate_canonical_parser.mjs --check` reports drift (expected RED).
2. Explicit `--write` regenerates the derived parser using Peggy 5.1.0 as pinned in `package.json`.
3. `--check`, S88a sync tests, the S91a bounded nesting tests, and the full JS/Python suites pass on Node 24. The verifier archives all outputs and a backup under `tools/reports/`.
4. Regressions are not waived by TODO; the S91a gate is an ordinary blocking test. No browser performance claim is made until a real UI probe.

## Out of scope / following review items

- **B2 is open and security-critical:** legacy function names and Python builtins; contain separately, never reuse the legacy compiler in active Semantic IR.
- **B3:** Danish decimal comma requires explicit locale mode and a provenance-preserving normalization contract; do not reject all `digit, digit` in the canonical parser, as `f(1,5)` is a legitimate two-argument call.
- **B4:** remove passing `knownGap` wrappers (hostile fuzz and parser sync) in a dedicated test-hygiene slice; no hidden green.
- **S90b:** multi-statement metadata and runtime require a reviewed v2/addendum to ADR-0006. Do not merge ordinal keys directly into authoritative block identity.
- **B1 resource budgets:** separate RED tests + proposed limits tied to Diagnostic v1 and canonical ingress, then an end-to-end editing responsiveness test.
