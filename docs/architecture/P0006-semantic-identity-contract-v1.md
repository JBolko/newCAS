# P0006 --- Semantic Identity Contract v1

**Status:** COMPLETE / GREEN\
**Series:** newCAS post-freeze implementation\
**Normative basis:** Frozen Architecture v1.0 §10.4, §11 and
Architecture Review Resolution §2.7--2.9\
**Scope:** Backend-independent semantic identity,
lexical/operation-local shadowing, immutable identity transport, and the
identity boundary used by Values.\
**Out of scope:** parser integration, document writer lookup, Semantic
IR construction, OperationSpec argument-role rules, evaluator/backend
mapping.

## 1. Purpose

P0006 defines identity independently of spelling, backend objects,
execution history, and document lookup.

The governing distinction is:

> **Display spelling is not semantic identity.**

The contract is intentionally small. It establishes what an identity
*is* and how already-established symbolic scopes shadow one another. It
does not decide which document writer a source name refers to, which
operation arguments introduce symbolic targets, or how a backend
represents the identity.

## 2. Identity categories

P0006 defines three versioned identity categories:

``` text
FreeSymbolIdentity(taskScopeId, name)
BinderIdentity(id, displayName)
OperationLocalIdentity(id, displayName)
```

Their public transport shapes are:

``` text
{
  identityVersion: 1,
  kind: "free-symbol",
  taskScopeId,
  name
}
```

``` text
{
  identityVersion: 1,
  kind: "binder",
  id,
  displayName
}
```

``` text
{
  identityVersion: 1,
  kind: "operation-local",
  id,
  displayName
}
```

A valid `SemanticIdentity` is immutable. Constructor-created identities
are frozen, and mutable lookalikes are not accepted as semantic
identities.

## 3. Equality and identity keys

Identity equality is structural by semantic category:

-   free symbol: category + `taskScopeId` + `name`;
-   binder: category + unique `id`;
-   operation-local: category + unique `id`.

`displayName` is not part of binder or operation-local semantic
equality. It is the spelling used for presentation and lexical
resolution.

Consequently:

-   repeated unresolved ordinary `x` in the same task denotes the same
    free mathematical symbol;
-   the same spelling in different tasks denotes different free symbols;
-   two binders displaying `x` remain different when their IDs differ;
-   a binder and an operation-local identity never merge merely because
    their opaque IDs or display names happen to match.

## 4. Lexical and operation-local shadowing

`LexicalIdentityScope` represents an already-established stack of
symbolic frames.

Resolution proceeds from the innermost frame outward. If an enclosing
binder or operation-local identity has the requested display name, the
innermost such identity wins. If no enclosing identity matches, the name
resolves to the task-local free symbol.

Lexical binders and operation-local identities participate in the same
nesting rule. Either may shadow the other when it is the inner scope.

Sibling scopes remain isolated.

This mechanism is not document writer resolution. P0006 does not
implement nearest-predecessor lookup or source-order binding.

## 5. Materialized Values and capture

Identity contained in an already materialized Value is semantic data. It
is never re-resolved merely because that Value is later used inside a
scope containing a binder with the same display spelling.

Therefore a materialized free `x` remains that free symbol inside a
later `f(x)` scope. The later binder cannot retroactively capture it.

This supports the frozen examples conceptually:

``` text
A := x + 1
B := x + 2
```

Both materialized expressions may contain the same task-local
free-symbol identity for `x`.

Likewise:

``` text
a := x
f(x) := a
```

The `x` already contained in materialized `a` remains free and is
distinct from the function parameter identity.

And for:

``` text
f(x) := x + y
g(y) := f(y)
```

`f`'s free `y` is not captured by `g`'s local `y`; identity, not
spelling, determines capture.

P0006 defines this identity/capture boundary. Construction of resolved
closures from source belongs to later semantic-resolution work.

## 6. Value integration

P0005 Values use `SemanticIdentity` directly:

-   `ExpressionValue` `symbolRef.identity`;
-   `FunctionValue` `parameters[].identity`;
-   `FunctionValue` `capturedValues[].identity`.

Display-name strings are not accepted in those positions.

Value construction detaches caller-owned payload data and deep-freezes
it before validation. Value decoding likewise freezes parsed transport
data before semantic validation. Thus a transported identity cannot
become mutable merely because it crossed the serialization boundary.

The dependency direction remains:

``` text
Value -> SemanticIdentity
```

`SemanticIdentity` does not depend on Value.

## 7. Operation-local identities

Symbolic operations may introduce local symbolic identities, for example
a differentiation variable, summation index, integration variable, or
another operation-local target.

P0006 defines the identity category and its nesting behavior.

Which public operations introduce such identities, and which argument
positions have symbolic-target roles, is deliberately deferred to P0008
`OperationSpec`.

## 8. Uniqueness ownership

P0006 requires binder and operation-local IDs to be unique within the
semantic object graph in which they occur.

It deliberately does not introduce a process-global counter, random UUID
allocator, or runtime-history-based identity source.

Deterministic allocation belongs to construction of resolved Semantic IR
in P0007. This keeps semantic identity independent of process lifetime
and execution order.

## 9. Backend independence

No `SemanticIdentity` contains SymPy, Python, Pyodide, or other backend
objects.

Backend mapping is P0011 work. A backend adapter may use `Dummy`,
uniquely mapped symbols, or another backend mechanism internally, but it
must preserve the semantic distinctions established here while allowing
normal display spelling.

## 10. Immutability audit finding

The P0006 exit audit found one contract hole: schema-valid
caller-created mutable lookalikes could initially pass
`isSemanticIdentity()`.

The fix made immutability part of identity validity:

-   `isSemanticIdentity()` requires the identity object to be frozen;
-   scopes reject mutable identity lookalikes;
-   Value construction freezes detached payloads before validation;
-   Value decoding freezes parsed payloads before validation.

This was intentionally fixed at the identity/transport boundary rather
than compensated for in parser, runtime, or evaluator code.

## 11. Test evidence

The completed P0006 suite covers, without DocumentRuntime:

-   same free name in the same task;
-   same spelling in different tasks;
-   binder identity independent of display spelling;
-   operation-local identity distinct from lexical identity;
-   free-symbol fallback;
-   lexical shadowing;
-   three nested same-name binders;
-   sibling-scope isolation;
-   lexical over operation-local shadowing;
-   operation-local over lexical shadowing;
-   materialized free-symbol isolation;
-   task identity preserved through Values;
-   category separation even with the same opaque ID;
-   FunctionValue binder/capture transport;
-   nested FunctionValues with same-spelled distinct binders;
-   free symbols preserved through nested FunctionValues;
-   operation-local identities preserved through Value transport;
-   rejection of mutable identity lookalikes;
-   frozen decoded identity references;
-   detachment and freezing of caller-owned identity payloads.

The full repository JavaScript suite after the exit-audit fix is:

``` text
154 tests
154 pass
0 fail
```

## 12. Explicit non-goals

P0006 does not:

-   parse source;
-   perform document-order writer lookup;
-   implement nearest-predecessor resolution;
-   define Semantic IR;
-   define operation argument roles;
-   allocate identities from process-global state;
-   map identities to SymPy/backend objects;
-   evaluate mathematics;
-   own DocumentRuntime dependency or reactive state.

## 13. Exit criteria

P0006 is GREEN when identity/capture stress tests are green without
DocumentRuntime and the identity contract remains independent of parser,
evaluator, backend, and document writer resolution.

**Exit result: COMPLETE / GREEN.**

The identity and capture contract is now the stable input boundary for
P0007 Semantic IR v1.
