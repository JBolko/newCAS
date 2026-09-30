# P0006 Exit Audit --- Semantic Identity Contract

**Status:** COMPLETE / GREEN\
**Audit date:** 2026-09-30

## Normative requirements audited

P0006 is responsible for semantic identity independent of parser,
evaluator, backend, and DocumentRuntime:

-   same unresolved ordinary name in the same task denotes the same
    task-local free symbol;
-   the same spelling in different tasks denotes different free-symbol
    identities;
-   lexical binders have unique identity independent of display
    spelling;
-   operation-introduced symbolic targets/dummies have unique identity
    independent of display spelling;
-   innermost enclosing binder wins during shadowing;
-   lexical and operation-local scopes may shadow one another according
    to nesting;
-   already materialized Values are not re-resolved or retroactively
    captured;
-   FunctionValue can transport binder identities and resolved captures
    without dynamic document lookup;
-   semantic identities are immutable and backend-independent;
-   the contract can be tested without DocumentRuntime.

## Evidence before audit fix

The repository-level P0006 stress run reached 150/150 passing tests.
This covered nested same-name binders, sibling scopes, task isolation,
lexical/operation-local shadowing in both directions, Value transport,
FunctionValue captures, and preservation of materialized free symbols.

## Audit finding

`isSemanticIdentity()` validated schema but did not require the supplied
object to be immutable. Therefore a caller-created mutable lookalike
could be accepted by `LexicalIdentityScope.push()`. Mutating that object
after scope construction could change the semantic identity observed by
the scope.

This violated the P0006 immutability boundary even though
constructor-created identities were already frozen.

## Fix

-   `isSemanticIdentity()` now requires `Object.isFrozen(value)`.
-   Value construction now deep-freezes the detached transport object
    before validation.
-   Value decoding now deep-freezes the parsed detached object before
    validation.
-   Tests reject mutable identity lookalikes.
-   Tests verify that decoded identity references are frozen.
-   Tests verify that Value construction detaches and freezes
    caller-owned identity payloads.

This keeps the dependency direction unchanged: Value may depend on
SemanticIdentity validation; SemanticIdentity does not depend on Value.

## Scope boundary audit

No parser integration was added.\
No document-order writer resolution was added.\
No evaluator/backend mapping was added.\
No OperationSpec argument-role semantics were added.\
No global counter or UUID allocator was added.

Deterministic allocation of unique binder/operation-local IDs remains a
responsibility of resolved Semantic IR construction in P0007 rather than
process-global identity state.

## Full-suite verification

After the audit fix, the full repository command:

``` text
npm run test:js
```

completed with:

``` text
154 tests
154 pass
0 fail
```

The audit-specific tests for mutable lookalikes, scope mutation
protection, decoded frozen identities, and caller-owned identity
detachment/freezing all pass.

## Exit decision

Every P0006 responsibility has direct implementation and test evidence,
and no audited behavior requires DocumentRuntime, parser integration,
evaluator state, backend objects, or OperationSpec policy.

**P0006 exit criterion is satisfied.**

**Final status: COMPLETE / GREEN.**

The next current roadmap item is P0007 --- Semantic IR v1.
