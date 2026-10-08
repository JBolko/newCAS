# P0010 — Evaluation transport contract v1

**Status:** candidate for closure; final full-repo run pending.

## Boundary

The semantic/document layer produces an already resolved evaluator invocation:

`EvaluationRequest { evaluationRequestVersion: 1, evaluatorId, instruction, inputs, options }`.

- `evaluatorId` is the opaque stable dispatch identity from P0008.
- `instruction` and `options` are evaluator-local, deeply frozen, transport-safe data trees. Their keys are not interpreted by P0010 for document semantics.
- `inputs` is a dense, ordered, immutable array of materialized P0005 Values.
- No document/task/provider/dependency/history authority exists in the request envelope. Semantic resolution and runtime orchestration must enforce ownership of content placed inside `instruction` and `options`.
- No raw backend objects, callbacks or runtime state cross this boundary.

Returns exactly one of:

- `EvaluationOutcome { evaluationOutcomeVersion: 1, status: "success", value: Value }`
- `EvaluationOutcome { evaluationOutcomeVersion: 1, status: "failure", diagnostic: Diagnostic }`

Both envelopes have exact own enumerable data fields. The recognizers reject hidden extra properties, symbol keys and accessors without executing getters.

## Transport integrity

`instruction` and `options` use recursively safe, plain data-property object/array graphs with finite numeric leaves. Arrays must be dense and carry no extra own properties. Constructors clone/freeze data. Recognizers require recursively frozen, valid content. Cycles are rejected; shared acyclic subtrees are allowed.

The same dense-array rule holds for `inputs`, whose elements must be P0005 Values.

## Layering decisions / non-goals

- No recursive blacklist of semantic-looking field names. That would improperly move resolution authority into transport validation.
- No parallel dispatch field or invented `operation` requirement: P0008 `evaluatorId` is sufficient for this boundary.
- No SymPy adapter (P0011), mathematical implementation (P0012–P0017), grammar/resolution (P0018–P0019), document scheduling (P0024), or legacy Python task scope compatibility.
- This contract describes shapes, not the concrete per-evaluator instruction schema.

## Pressure history

Slices 1–5: request construction, canonical envelope, deep recognition, adversarial JavaScript property shapes, and dense input array validation.
Slice 6: success/failure envelope integrity.
Exit pressure: request outer envelope checked by the same descriptor-based strategy as outcome.

A deliberately over-strong Slice-2 test was corrected: key names like `history` can be evaluator-local and do not by themselves confer document authority.
