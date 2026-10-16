# P0021 Slice 78 — legacy evaluator retirement readiness (GREEN)

## Scope
This slice adds four static, bounded audit tests and no production changes.
Slice 76 switched the active batch expression route to attested resolved IR;
Slice 77 exercised cross-task overlapping generations. Six historical adapters
remain on disk but are not statically reachable from the active batch module.

## Evidence versus open questions

| Historical adapter | Active batch | Contract-retirement status |
|---|---|---|
| source integer assignment | Not reachable | Keep until all direct API consumers checked |
| source literal function | Not reachable | Keep; source-attestation contracts need parity review |
| source variable function | Not reachable | Keep; negative/provenance contracts need parity review |
| source expression | Not reachable | Keep until IR replacement coverage is complete |
| bound function | Not reachable | Keep; explicit argument/current-revision contracts need parity review |
| source composed expression | Not reachable | Keep until all nested/capture contracts are mapped |

The audit checks a bounded **static relative import graph**, not dynamic imports
or all repo entrypoints. Active-IR witnesses cover selected positive and
negative behavior, not every direct legacy API test. **This is not permission
to delete old modules or their tests.**

## Exit criteria for actual removal

1. Map every historical adapter test to an active IR/DocumentRuntime equivalent
   or document why it is intentionally obsolete.
2. Migrate the browser contract depending on a historical adapter.
3. Verify there are no remaining production/test consumers of retired exports.
4. Delete one adapter at a time, adjust architecture tests that intentionally
   require presence, and run the full Node 24 suite and necessary real Worker probes.

The selected Pyodide Worker version baseline and its browser acceptance tests
are unaffected. Frozen architectural contracts are unchanged.
