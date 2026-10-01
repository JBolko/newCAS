# P0008 — OperationSpec Contract v1

**Status:** COMPLETE / GREEN  
**Series:** newCAS post-freeze implementation  
**Baseline at closure:** full JS suite 220/220  
**Normative basis:** Frozen Architecture v1.0 and P0005–P0007 contracts

## 1. Purpose

OperationSpec is the small declarative contract that describes public-operation
policy needed by semantic resolution and evaluator dispatch without placing
operation-specific rules in DocumentRuntime.

The governing boundary is:

> **Semantic IR records the resolution performed; OperationSpec describes the
> policy resolution uses.**

OperationSpec does not parse, resolve, allocate identities, construct Semantic IR,
evaluate mathematics, inspect document order, manage dependencies, or define
diagnostics.

`Operation ≠ FunctionValue`.

## 2. Contract

```text
OperationSpec {
    operationSpecVersion: 1,
    operationId: string,
    evaluatorId: string,
    signatures: SignatureSpec[],
    purity: "pure" | "volatile",
    diagnosticAdapterId: string | null
}

SignatureSpec {
    arguments: ArgumentSpec[]
}
```

For the common one-signature case, `operationSpec(...)` accepts
`arguments: [...]` as construction shorthand. The resulting spec exposes
`arguments` as an alias of the sole signature's argument list.

A multi-signature operation uses `signatures` and does not expose a single
`arguments` view. A caller supplies either `arguments` or `signatures`, never both.

All public contract objects and nested containers are immutable and detached from
caller-owned containers.

## 3. Argument roles

v1 defines:

```text
value
symbolic
scoped
```

### `value`

An ordinary resolved mathematical Value/expression operand. It does not mean
numeric literal.

### `symbolic`

A symbolic target whose semantic role overrides ordinary materialized document
lookup for that argument position.

Example:

```text
diff(expression:value, variable:symbolic)
solve(equation:value, unknown:symbolic)
```

OperationSpec declares the role. Semantic resolution later applies it and records
the resolved result in Semantic IR.

### `scoped`

An operation-introduced symbolic/binder role with explicit governed arguments:

```text
{
    name: "binder",
    role: "scoped",
    scopeOver: ["body"]
}
```

`scopeOver` targets names in the same signature. Argument order never implicitly
creates scope.

Validation requires unique argument names, existing scope targets, no self-scope
and no duplicate scope targets.

## 4. Multiple semantic signatures and arity

Different valid semantic call forms are represented as complete signatures rather
than optional-argument guessing.

Example:

```text
integrate(integrand:value, variable:symbolic)

integrate(
    integrand:value,
    variable:symbolic,
    lower:value,
    upper:value
)
```

This metadata is sufficient for generic arity/signature selection. P0009 owns the
stable diagnostic contract for invalid arity.

## 5. Variadic signatures

A final repeated argument is explicit:

```text
{ name: "value", role: "value", variadic: true }
```

A signature may contain at most one variadic argument, and it must be final.

No repetition semantics are inferred from operation name or argument position.

## 6. Integration bounds

The bounded integration signature deliberately declares both bounds as `value`:

```text
integrand : value
variable  : symbolic
lower     : value
upper     : value
```

Therefore the same signature covers:

```text
integrate(f(x), x, 1, 5)
integrate(f(x), x, 1, x)
integrate(f(t), t, a, x)
```

In:

```text
F(x) := integrate(f(x), x, 1, x) + 5
```

the integration variable is the symbolic target; the final `x` is an ordinary
Value expression used as the upper bound. No third integration signature is
required.

## 7. Evaluator dispatch

`evaluatorId` is an opaque stable dispatch identity.

OperationSpec does not contain evaluator callbacks or evaluator implementation
objects. Later evaluator layers dispatch using the identity after semantic
resolution has completed.

## 8. Purity and volatility

v1 defines:

```text
pure
volatile
```

Purity/volatility is declarative metadata only. OperationSpec does not implement
caching, invalidation, dirty state, generations, epochs or document scheduling.

Later runtime layers consume the metadata under their own contracts.

## 9. Diagnostic adaptation

`diagnosticAdapterId` is either `null` or an opaque declarative identity.

P0008 does not define diagnostic codes, backend-string matching, error objects or
adapter callbacks. P0009 owns the structured diagnostic contract.

## 10. Forward integration invariant

This section is intentionally permanent and must be checked when later layers are
implemented.

### 10.1 Scope

```text
OperationSpec owns scope policy.
Resolution applies scope policy.
Semantic IR records the resolved result.
Evaluator consumes the resolved result.
```

`scopeOver` is not a temporary workaround. It is the declarative policy boundary.

When P0019 semantic resolution is implemented, it must consume `scopeOver`
generically and create the appropriate P0006 identities / P0007 resolved IR.

Do not introduce a second operation-specific scope mechanism in DocumentRuntime or
the evaluator. If migration temporarily requires one, remove it when generic
OperationSpec-driven resolution becomes authoritative.

### 10.2 Symbolic operations

The same rule applies to `diff`, `integrate`, `solve`, substitution and later
symbolic operations: higher layers must consume argument roles generically rather
than branch on operation names to reproduce P0008 policy.

P0014 evaluator implementation owns the mathematics of symbolic operations, not
document lookup or symbolic-target resolution.

## 11. Representative exit evidence

P0008 pressure-tested representative operations covering:

- ordinary Value operands (`sin`);
- symbolic targets (`diff`, `solve`);
- multiple signatures and variable Value bounds (`integrate`);
- mixed Value/symbolic roles (substitution);
- variadic Values (`min`);
- explicit scoped relationships;
- evaluator dispatch;
- purity/volatility;
- diagnostic-adaptation metadata.

A test-only generic consumer selected signatures, expanded variadic arguments,
read symbolic/scoped roles and obtained evaluator dispatch without
operation-name-specific branches.

Final full JS suite at closure:

```text
tests 220
pass 220
fail 0
```

No P0005–P0007 production changes were required.

## 12. Non-goals

P0008 deliberately does not define:

- parser or surface grammar;
- document writer lookup or nearest-predecessor semantics;
- SemanticIdentity allocation;
- Semantic IR construction;
- evaluator transport/outcomes;
- mathematical operation implementation;
- Value-category compatibility/type checking;
- structured diagnostic codes;
- dependency graph behavior;
- dirty/blocked state;
- presentation.

Those belong to their respective later contracts.
