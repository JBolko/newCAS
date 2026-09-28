# P0005 --- Value Contract v1

**Status:** Draft contract for implementation\
**Series:** newCAS post-freeze implementation\
**Normative basis:** Frozen Architecture v1.0, especially §§14--16\
**Scope:** Public mathematical Values and their stable transport
representation.\
**Out of scope:** semantic identity details (P0006), Semantic IR
(P0007), OperationSpec (P0008), diagnostics (P0009), evaluator transport
(P0010), SymPy adapter implementation (P0011).

## 1. Purpose

P0005 defines the smallest backend-independent Value layer that lets
newCAS own mathematical meaning, immutability and transport without
reimplementing a computer algebra system.

The governing rule is:

> **Representation is not evaluation.**

newCAS Values preserve mathematical meaning and stable structure. SymPy
or another selected backend performs symbolic mathematics, dimensional
algebra and other backend-supported computation.

A public Value must never depend for its meaning on a live backend
object, Python process, Pyodide runtime, `repr`, `str`, `srepr`, backend
exception class, or other backend implementation detail.

## 2. Required properties

Every public Value in v1 is:

1.  **Mathematical** --- it represents a result or operand, not UI state
    or a transport Result object.
2.  **Immutable** at the newCAS semantic level.
3.  **Backend-independent** at its public boundary.
4.  **Serializable/transportable** wherever document/runtime boundaries
    require it.
5.  **Explicitly typed where mathematical meaning differs**; container
    appearance alone does not determine type.
6.  **Round-trippable** through the canonical Value encoding without
    changing its newCAS mathematical meaning.
7.  **Independent of backend lifetime**; destroying and recreating
    Pyodide must not destroy authoritative Value meaning.

An opaque backend handle may be cached as an optimization, but it is
never the sole representation of a public Value.

## 3. Deliberately small Value family

Release-1 Value v1 starts with these coarse-grained categories:

``` text
Value
├── ExpressionValue
├── FunctionValue
├── RelationValue
├── SetValue
├── ListValue
├── VectorValue
├── MatrixValue
└── QuantityValue
```

Additional structured result Values are added only when a Release-1
operation demonstrates a concrete need. Regression/distribution or other
rich result types are therefore not invented speculatively in P0005.

There are deliberately no public `AddValue`, `MulValue`, `PowValue`,
`SinValue`, `IntegerValue`, `MeterValue`, etc. Such a hierarchy would
duplicate backend mathematics.

## 4. Common transport envelope

All Values use a versioned public envelope:

``` json
{
  "valueVersion": 1,
  "kind": "expression",
  "data": {}
}
```

`valueVersion` versions the Value encoding, not the document format or
backend.

`kind` identifies the mathematical Value category.

`data` contains the canonical payload for that category.

Presentation metadata is not part of mathematical equality unless
explicitly stated by a later contract.

## 5. ExpressionValue

`ExpressionValue` represents ordinary scalar/symbolic mathematical
expressions.

Its transport representation uses a **small symbolic transport tree**.
The tree is not an evaluator and performs no simplification, solving,
differentiation, dimensional analysis or algebra.

The required constructor vocabulary should remain minimal and
evidence-driven. Initial core forms are expected to include:

-   exact integer;
-   exact rational;
-   finite floating/approximate number with explicit representation
    policy;
-   named mathematical constants/special scalar values supported by
    Release 1;
-   symbol reference;
-   addition;
-   multiplication;
-   power;
-   supported mathematical function application.

Example shape:

``` json
{
  "valueVersion": 1,
  "kind": "expression",
  "data": {
    "expr": {
      "op": "add",
      "args": [
        {"op": "integer", "value": "2"},
        {"op": "symbolRef", "identity": "P0006:placeholder-x"}
      ]
    }
  }
}
```

The exact identity encoding is intentionally deferred to P0006. P0005
only requires expression serialization to reference semantic identities
rather than rely on display names alone.

The transport tree must not expose SymPy class names or `srepr`.

## 6. FunctionValue

A `FunctionValue` is a materialized mathematical function/closure, not
merely a function name.

Conceptually:

``` text
FunctionValue {
    parameters: [BinderReference...],
    body: Value/expression representation,
    capturedValues: resolved immutable captures as required
}
```

Exact binder/free-symbol identity is P0006 work.

A FunctionValue must be reconstructible after backend disposal without
re-resolving captured document names against current document state.

General self-recursive functions remain outside Release 1 according to
the frozen architecture.

## 7. RelationValue

`RelationValue` represents mathematical relations such as equality and
inequalities when they are Values rather than instructions.

Initial relation operators may include:

``` text
eq, ne, lt, le, gt, ge
```

Operands are Values/expressions.

Relation representation must not be inferred from backend Boolean
classes.

## 8. SetValue

`SetValue` provides a stable public representation for set/solution-like
results required by Release 1.

The initial adapter target should cover only demonstrated backend
outputs, expected to include:

-   empty set;
-   finite set;
-   interval;
-   union/intersection where required;
-   conditional/implicit set form where required by supported solve
    behavior.

Backend ordering is not semantic set ordering and must not be serialized
as though it were.

Backend-generated dummy names are not public identity.

Exact handling of special SymPy set forms is finalized from P0003
evidence and P0011 adapter tests rather than by mirroring the full SymPy
set hierarchy.

## 9. ListValue, VectorValue and MatrixValue

These are distinct Values even where their serialized payloads contain
similar arrays.

``` text
ListValue   ≠ VectorValue ≠ MatrixValue
```

No nested-list shape inference converts one category into another.

### ListValue

Ordered collection of Values with list/data semantics.

### VectorValue

Ordered mathematical vector with explicit vector identity/type.

Orientation conventions, if needed, are specified by the vector/matrix
operation contract rather than guessed from storage shape.

### MatrixValue

Rectangular mathematical matrix.

Canonical payload contains dimensions and entries explicitly enough to
validate transport integrity.

Example:

``` json
{
  "valueVersion": 1,
  "kind": "matrix",
  "data": {
    "rows": 2,
    "cols": 2,
    "entries": [
      ["<Value>", "<Value>"],
      ["<Value>", "<Value>"]
    ]
  }
}
```

Matrix algebra remains evaluator/backend work.

## 10. QuantityValue

A physical quantity is mathematical Value composition, not formatting.

The frozen conceptual form remains:

``` text
QuantityValue {
    magnitude: Value,
    unit: Unit
}
```

P0005 refines this into three deliberately separated concerns:

1.  **canonical mathematical quantity**;
2.  **canonical unit representation**;
3.  **optional presentation preference**.

The mathematical Value must not depend on how the quantity was
originally displayed.

### 10.1 Canonical SI direction

Where practical, physical quantities are normalized to a canonical SI
representation for authoritative mathematical state.

Examples:

``` text
5 cm       → 0.05 m
72 km/h    → 20 m/s
20 degC    → 293.15 K
```

A preferred display unit may allow the UI to show `5 cm`, `72 km/h` or
`20 °C` without changing the canonical mathematical Value.

Display preference is not itself authoritative mathematical state.

### 10.2 Backend delegation

newCAS does **not** implement a general physical-dimension engine.

The Unit/Quantity adapter delegates to the selected backend where
supported:

-   dimensional algebra;
-   dimensional compatibility;
-   compound units;
-   multiplicative scale conversion;
-   simplification/conversion of ordinary units.

The adapter validates backend behavior and normalizes it into the public
newCAS contract.

`DocumentRuntime` performs no dimensional algebra.

### 10.3 Affine temperature units

Absolute Celsius and Fahrenheit temperatures are affine scales and are
treated at the UnitAdapter boundary.

Canonical absolute temperature is kelvin:

``` text
T[K] = T[degC] + 273.15
T[K] = (T[degF] - 32) * 5/9 + 273.15
```

Temperature intervals are multiplicative:

``` text
Δ1 degC = 1 K
Δ1 degF = 5/9 K
```

Therefore coefficients involving temperature **differences** remain
ordinary multiplicative unit expressions:

``` text
1 / degC          ↔ 1 / K          for interval-based coefficients
J / (kg * degC)   ↔ J / (kg * K)
```

No Celsius-specific physics is built into individual operations such as
heat capacity or thermal expansion. The distinction belongs to the unit
boundary between absolute temperature and temperature interval.

### 10.4 Unit representation

The public Unit encoding must not consist solely of a SymPy unit object.

A canonical unit representation must preserve enough stable information
to reconstruct the supported unit through the UnitAdapter.

The exact UnitRegistry vocabulary/schema is implementation detail to be
finalized with P0016 evidence; P0005 requires only that the
representation be versioned, backend-independent and serializable.

## 11. Special scalar/backend results

P0003 demonstrated that backend outputs may include objects such as
infinities, complex infinity, accumulated bounds and backend-specific
special set forms.

P0005 does not mirror every SymPy class.

For each Release-1-supported result, one of the following must be
explicit:

1.  canonical representation inside an existing Value kind;
2.  a justified structured Value form;
3.  an unsupported-result outcome at the evaluator boundary.

Raw backend objects are never leaked as accidental public Values.

## 12. Mathematical equality versus presentation equality

Canonical Value equality concerns mathematical/semantic Value structure
as defined by newCAS.

The following do not by themselves make Values mathematically different:

-   backend object identity;
-   backend-generated dummy names;
-   ordering of mathematically unordered sets;
-   preferred display unit;
-   formatting/LaTeX choices;
-   cached backend handles.

Semantic identity references inside expressions/functions are
significant and are finalized in P0006.

## 13. Serialization invariants

For every Value fixture `v`:

``` text
decode(encode(v)) ≡ v
```

where `≡` means equality under the newCAS Value contract.

Serialization must be deterministic enough for tests and transport.
Determinism must not invent order where the mathematical object is
unordered; unordered structures require canonicalization rules.

The serializer must reject malformed Value payloads rather than silently
reinterpret them.

## 14. P0005 fixtures

The initial fixture suite should include at least:

### Expression

-   integer and rational;
-   approximate scalar;
-   free symbolic expression;
-   nested arithmetic;
-   supported function call;
-   special scalar values chosen for Release 1.

### Function

-   one parameter;
-   multiple parameters;
-   captured resolved value;
-   same display name with distinct identity placeholders.

### Relation/set

-   equality;
-   inequality;
-   empty set;
-   finite set;
-   interval;
-   representative conditional set if supported in Release 1.

### Containers

-   heterogeneous ListValue where allowed;
-   VectorValue;
-   MatrixValue;
-   matrix containing symbolic entries.

### Quantity

-   `5 m`;
-   `72 km/h` canonicalized to `20 m/s`;
-   scalar quantity with compound SI unit;
-   vector/matrix magnitude with a unit if Release-1 support is
    retained;
-   absolute `20 degC` canonicalized to `293.15 K`;
-   temperature interval `20 degC` canonicalized as `20 K`;
-   Fahrenheit interval fixture reserved as a scale test even if
    Fahrenheit is not exposed initially.

## 15. P0005 test boundary

P0005 tests test **Value construction and serialization**, not SymPy
mathematics.

Required tests:

1.  fixture encode/decode round trip;
2.  immutability;
3.  explicit List/Vector/Matrix distinction;
4.  deterministic encoding;
5.  malformed-payload rejection;
6.  presentation preference does not alter mathematical Value;
7.  Quantity canonical/display separation;
8.  identity placeholders survive transport without falling back to
    names.

SymPy conversion tests belong primarily to P0011.

Unit evaluator behavior belongs primarily to P0016.

## 16. Explicit non-goals

P0005 does not:

-   implement symbolic simplification;
-   implement dimensions;
-   reproduce SymPy's expression class hierarchy;
-   define final semantic identity format;
-   define Semantic IR;
-   define public operation dispatch;
-   define diagnostic codes;
-   implement the evaluator;
-   define all possible mathematical objects;
-   guarantee support merely because SymPy can represent an object.

## 17. Exit criteria

P0005 is GREEN when:

-   the minimal Value family is accepted;
-   a stable versioned transport encoding exists;
-   representative Value fixtures exist;
-   serialization/round-trip tests are green;
-   List/Vector/Matrix remain explicitly distinct;
-   QuantityValue preserves mathematical quantity independently of
    display;
-   unit design delegates dimensional mathematics to the backend rather
    than duplicating it;
-   no public Value depends solely on a live SymPy/Pyodide object;
-   no P0005 implementation prematurely implements P0006--P0011
    responsibilities.

## 18. Implementation sequence

Recommended small-green sequence:

1.  Create Value schema/types with no SymPy dependency.
2.  Implement `encodeValue` / `decodeValue`.
3.  Add expression transport primitives only as demanded by fixtures.
4.  Add List/Vector/Matrix fixtures.
5.  Add Quantity/Unit transport forms and canonical/display separation.
6.  Add Function/Relation/Set fixtures using temporary
    identity-reference placeholders.
7.  Run serialization tests.
8.  Replace temporary identity placeholder contract in P0006 without
    changing Value-category semantics.

No backend adapter should be introduced merely to make P0005 tests pass.
