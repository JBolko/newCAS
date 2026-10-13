# P0021 Slice 40 — Source-bound variable-argument function call

**Status:** GREEN in focused Node tests, pending full Node 24 regression in user checkout.
**Baseline:** 719 green JS tests after Slice 39; expected 726 after seven new tests.

## Scope

Connect three *existing* boundaries: the actual Peggy/P0020 source snapshot,
P0021 callable dependency projection and planned task, and current-revision
provider outcomes from the existing P0021 Value gateway. The bounded supported
expression is a top-level, unary document function call `f(x)` where both the
function and the variable argument are uniquely bound to document writers.

`createSourceVariableFunctionTaskEvaluator` accepts a document source snapshot,
parser, the already-selected call name, and the standard evaluated outcomes
reader. It obtains the function Value and argument Value from *the same gateway
envelope*, verifies both against exact P0020 identities, then delegates to
`evaluateBoundSourceFunctionCall` with its original one-provider attestation.
All math execution remains the existing function application path. There is no
runtime name lookup, shadow registry, Python document state, or new revision
system.

## Evidence

- Real parser and derived source snapshot for `x:=12; f(t):=t^3+4t; f(x)`
  produce both document providers; existing batch computes 1776.
- Replacing x with 3 computes 39; updating its current provider outcome alone
  also computes 39 (there are no pre-materialized argument constants).
- Missing provider, wrong function Value, nonvariable argument, and stale
  document revision fail closed.

## Not yet completed

- The test preloads successful current-revision outcomes for `x` and `f`,
  instead of evaluating these writer tasks through an actual DocumentRuntime.
- The host supplies the existing selected scalar evaluation callback; this
  slice does not add a new real Worker browser smoke test.
- Multiargument calls, compound argument expressions, captures, ambiguous
  callable resolution, document mutation lifecycle, and asynchronous stale
  commits remain separate integration work.

The next vertical slice should materialize the `x` and `f` writer outcomes
from their own document tasks before evaluating the call, then exercise
recomputation after an authoritative edit.
