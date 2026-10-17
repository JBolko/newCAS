# P0021 — disposition of Claude's independent S90a follow-up (2026-10-17)

**Status:** review triage and proposed sequence, NOT an amendment to frozen v1.0 or ADR-0006. Claude is a reviewer, not an architectural decision authority. Raw evidence and probes remain in the user-supplied `newCAS_S90a_review_og_probekit.md` outside the repository.

## Confirmed progress, with evidence qualifiers

- **F1/F2:** reporter reproduces closed cases and fuzz on the current reconstructed sources. Remaining atomic-mutation rollback and Diagnostic v1 formatting are separate explicit issues, not silently waived.
- **F3:** canonical generated parser/source synchronized after S88a. Language-localization semantics are not implemented.
- **F4:** S87a stopped a unit-expression injection path; **other legacy Python code-generation attacks remain**. Do not describe F4 as closed and do not reuse the legacy transformer/executor in the active IR architecture.
- **P0021 mathematical cases:** 19/55 normative cases were shown PASS by Claude's in-process real-Pyodide harness; this is **not** 19 verified browser/Web-Worker E2E tests. The report marks 18 blocked rows, zero silently wrong evaluations, and six cases correct only at binding level.
- **Release readiness:** student allowlist is a necessary boundary, not a release authorization. The production HTML/main.js entry still invokes legacy CASEngine; no evidence of end-user migration yet.

## New findings and disposition

| ID | Evidence level | Assessment / next action |
|----|----|----|
| B1 nested parsing complexity | Observed with reproducible timings | S91a enables Peggy packrat via the generator and adds mandatory bounded tests. Resource budgets and parsing at editing time remain open; memory costs must be measured. |
| B2 function names reach dynamic Python | Static generated code and Python context confirmed | Critical legacy-only exposure, not solved by S87a. Contain or disable legacy execution before student release; follow with S92 review. Restricting Python `__builtins__` alone is **not** a sandbox, nor is a function-name whitelist a proof of safety. Never run payload in a real school browser. |
| B3 ambiguous Danish decimals | Observed grammatical ambiguity | Canonical `f(1,5)` is legitimate as a two-argument call. Therefore a global `digit, digit` rejection would introduce false errors. Define explicit locale/provenance/offset mapping at the UI ingress first; do not modify the canonical grammar for locale inference. |
| B4 hidden passing TODO and weak multistatement gate | Observed test-policy flaw | Promote already-passing knownGap tests to mandatory tests in a separate small slice; demand actual evaluation/commit and real Worker evidence for multistatement acceptance. Never count TODO as GREEN. |
| B5 trust/error rendering and CDN | Confirmed code patterns, exploit chain not shown | Treat Worker messages and document import as untrusted; typed diagnostics, safe text rendering, size guards, dependency pinning/offline/CSP policy before release. Avoid claiming confirmed student-controlled XSS. |

## Architecture choices NOT automatically adopted

- **Multi-statement:** left-to-right, strictly previous provider, no fallbacks and task-scoped results are desired. New active semantics require a reviewed extension to ADR-0006. `languageVersion >= 1.1`, `(blockId, ordinal)` naming, `#k` wire IDs and all-or-nothing parent commits are proposals, **not** established contracts. Ordinals can change on insertion; use revision/generation attestation and explicit parent-child projections; do not insert fake block identities into the authoritative document.
- **Two compilers / duplicate graphs:** the review exposes structural debt, but deleting a compiler or graph before proving all supported source roles and downstream invalidation would be another quick-fix. Start with RED coverage and migration mapping, then consolidate on the P0007/P0008/P0010 contracts.
- **F5 Worker supervision:** terminate/respawn/timeout requires task- and generation-local cancellation, warm-up policy, max output sizes and diagnostics. Test with a real Web Worker as well as a Node harness.
- **Pyodide version:** verify dependency compatibility (review flags SymPy 1.14 vs mpmath 1.4.1); no version change without P0004 decision and real browser smoke.

## Working order after S90a checkpoint

1. **S91a:** fix B1 parser build policy and speed (this package); keep resource bounds open.
2. **Next security slice:** reproduce/contain B2 on current legacy entrypoints without introducing a pseudo-sandbox into the new IR engine; consider blocking legacy entry pending actual UI migration if containment cannot be convincingly verified.
3. **Test-hygiene slice:** remove passing knownGap wrappers, make active S90 gate test real evaluation/commit, and correct the 55-case coverage ledger.
4. **S93 design gate:** resolve single authoritative source-attested compiler pathway and binder semantics before enabling multi-statement functions.
5. **Worker/release hardening:** F5/B5; preserve task isolation, no stale commits, no silent recovery.

No remote review probes are automatically installed as ordinary project tests. The supplied kit includes intentional REDs, potential long computations and an installer that contacts the network; it should be reviewed and selectively adopted rather than bulk-imported.
