# P0007 --- Semantic IR v1

**Status:** COMPLETE / GREEN\
**Series:** newCAS post-freeze implementation\
**Normative basis:** Frozen Architecture v1.0 §8--§12 and P0006 Semantic
Identity Contract v1\
**Scope:** smallest immutable, source-independent representation of
already-resolved mathematical meaning.\
**Out of scope:** parsing, document-order lookup, OperationSpec
argument-role policy, evaluator transport, backend mapping, diagnostics.

## Governing rule

> Semantic IR records resolution decisions; it does not make them.

Semantic IR sits after structural and name/scope resolution. It contains
the meaning selected by those layers, not unresolved document names
whose meaning would depend on later lookup.

## Canonical vocabulary

P0007 v1 deliberately contains only:

-   `define(writerId, body)` → node kind `define`
-   `defineFunction(writerId, parameters, body)` → node kind
    `define-function`
-   `providerReference(providerId)` → node kind `provider-reference`
-   `semanticReference(identity)` → node kind `semantic-reference`
-   `operationReference(operationId)` → node kind `operation-reference`
-   `call(callee, args)` → node kind `call`
-   `valueLiteral(value)` → node kind `value`

The helper name `valueLiteral(...)` describes its role; the concrete
serialized node kind is `value`.

No additional IR node kind is introduced merely because P0005 has a
corresponding Value kind.

## Resolved references

`providerReference(providerId)` records that document-semantic
resolution has already selected a particular writer/provider. It
performs no lookup and carries no current provider Value.

`semanticReference(identity)` refers directly to a P0006 `free-symbol`,
`binder`, or `operation-local` SemanticIdentity.

This separation preserves nearest-predecessor, read-before-write,
failed-writer and capture semantics while keeping document order and
runtime history outside the IR.

## Writer identity

`writerId` and `providerId` are opaque stable identities supplied by
document/semantic-resolution layers. P0007 neither allocates them nor
derives them from display names.

Definition identity and RHS provider identity are independent. Thus a
resolved `a := a + 1` may define `writer:a2` while its RHS explicitly
references `writer:a1`.

## Functions and capture

Function parameters are explicit P0006 binder identities. Function
bodies refer to them through `semanticReference`.

External document captures remain explicit `providerReference` nodes.
Free mathematical symbols remain P0006 free-symbol identities.

Creating an immutable `FunctionValue` from a successfully evaluated
definition belongs to later evaluator/Value-adapter work.

## Materialized Values

A materialized P0005 Value is carried by `valueLiteral(value)` and is
not recursively re-resolved.

A free-symbol identity already contained in a Value is therefore not
captured by a later lexical binder or same-spelled operation-local
identity.

## Canonical calls

Pre-materialization mathematical construction may use:

`call(operationReference(operationId), args)`

This is sufficient for arithmetic/operators, relations, containers and
substitution when the semantic distinctions are explicit in the
arguments.

Substitution targets use `semanticReference(identity)`, not display
spelling.

P0007 does not decide public operation identifiers, arity, argument
roles, symbolic scopes, purity, volatility or evaluator dispatch. Those
policies belong to P0008 OperationSpec.

## Operation-local identities

P0007 can carry an `operation-local` SemanticIdentity but does not
decide which argument position introduces it.

Resolved symbolic targets are therefore representable without
hard-coding `diff`, `integral`, `sum`, `solve` or `limit` policy into
the IR.

## Immutability and transport

Semantic IR nodes are deeply immutable and detached from caller-owned
arrays and objects.

They are plain transportable data and survive JSON transport without
live runtime objects.

No node contains parser objects, source text, document position,
DocumentRuntime state, dependency graphs, dirty/generation state,
execution history, Pyodide objects, SymPy objects or backend dispatch
metadata.

## Evaluator boundary

P0007 does not implement P0010.

A `providerReference(providerId)` is valid P0007 IR because provider
selection is itself a completed semantic-resolution decision.

P0010 later defines how a resolved instruction and required materialized
input Values cross the evaluator boundary:

`resolved instruction + input Values + options -> EvaluationOutcome`

The evaluator must not need `taskId`, document order, dependency graph
or execution history.

## Permanent fixture coverage

The consolidated P0007 suite covers 18 source-independent fixtures:

1.  nearest-predecessor selection after resolution;
2.  read-before-write with distinct previous/new writer identities;
3.  function body with lexical binder, captured provider and free
    symbol;
4.  operation-local symbolic identity without OperationSpec policy;
5.  same-spelled free/binder/operation-local identities without capture;
6.  deep immutability and caller detachment;
7.  materialized Value not re-resolved by later lexical binder;
8.  materialized Value distinct from same-spelled operation-local
    target;
9.  container construction through canonical Call;
10. relation construction through canonical Call;
11. substitution target as SemanticIdentity rather than spelling;
12. substitution distinguishing free symbol from same-spelled binder;
13. absence of source/document-runtime/backend context;
14. identical resolved meaning independent of source history;
15. explicit provider choice without document-order lookup;
16. explicit function binder and external provider capture;
17. explicit operation identity without dispatch metadata;
18. JSON transport without live runtime objects.

At P0007 closure the complete JS suite is **172/172 GREEN**.

## Exit decision

The frozen P0007 exit criterion is satisfied: source-independent IR
fixtures cover the required semantic distinctions without parser,
DocumentRuntime, OperationSpec policy or backend dependencies.

Slices 2 and 3 required no production change to `semantic-ir.js`. The
small canonical vocabulary is therefore sufficient for P0007; no second
AST hierarchy is justified.

Further operation metadata belongs to P0008 rather than extending P0007
speculatively.
