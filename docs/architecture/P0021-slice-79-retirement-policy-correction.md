# P0021 Slice 79 — retire implementations, preserve normative semantics

## Correction to Slice 78
The Slice 78 audit erroneously asserted that six historical implementation files
and three historical test files **must continue to exist**. This makes a
migration inventory a permanent prohibition on cleanup. Slice 79 replaces that
existence assertion with a policy guard; the remaining S78 checks still verify
that historical evaluators are not statically reachable from the active batch.

## Decision rule
- **Keep as invariants:** P0020-selected, positional provider identity; no
  post-failure/later-provider fallback; task isolation; immutable P0005 Values;
  revision/stale-result safety; typed failure for unsupported or invalid input.
- **Not normative:** class/function names of historical adapters; the old
  adapter API shapes, special integer-only evaluator restrictions, source-AST
  traversal mechanics, file existence, or preservation of outdated tests.
- **Before removal:** check all actual importers, including browser fixtures;
  determine whether each old test covers a *still normative* behavior. If so,
  test that behavior via DocumentRuntime + the active IR batch; otherwise retire
  the old test with its adapter. Do **not** introduce compatibility features
  into the new IR evaluator merely to satisfy old tests.

This slice deliberately does **not** delete old implementation files. It fixes
only the erroneous audit gate and adds regression checks of the real active
routing/boundaries. A later removal slice may delete adapters and their
obsolete tests in one reviewable change. No change to frozen architecture.

## Validation
Run `node --test tests/js/p0021-ir-legacy-retirement-readiness.test.mjs tests/js/p0021-ir-retirement-policy.test.mjs`
then `node --test`. Browser probes and production code are unchanged.
