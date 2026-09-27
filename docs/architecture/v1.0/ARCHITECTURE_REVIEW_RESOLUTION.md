# newCAS Architecture Review Resolution

**Status:** FROZEN v1.0\
**Freeze date:** 2026-09-27\
**Reviewers:** Claude, Gemini, Grok, Qwen\
**Purpose:** Consolidated resolution of adversarial review findings incorporated into architecture v1.0.

## 1. Freeze criterion

The architecture may be frozen for implementation when:

1.  every external review finding is classified as **ACCEPT**,
    **CLARIFY**, **REJECT**, **MERGED**, or **DEFERRED**;
2.  no unresolved finding demonstrates a contradiction between the core
    invariants;
3.  all accepted semantic clarifications are incorporated into the
    architecture specification;
4.  all accepted normative cases are incorporated into the stress-test
    catalogue;
5.  remaining implementation choices do not change document meaning;
6.  the dependency/version capability gate has been completed before
    implementation begins.

The four independent reviews found no fatal contradiction in the central
model: Document authority, positional resolution, immutable/materialized
Values, task isolation, disposable evaluator state, and evaluator
independence remain intact.

------------------------------------------------------------------------

## 2. Decisions that are now frozen

### 2.1 Writer establishment

A writer exists only after the source has parsed as a complete
definition and its assignment target/binder declaration is structurally
valid.

After that point, the writer remains a writer even if later phases fail.

Therefore:

-   parse failure → no definition, no writer;
-   invalid assignment target/binder declaration → no writer;
-   name-resolution failure → writer exists, no Value;
-   unresolved callable → writer exists, no Value;
-   unsupported operation → writer exists, no Value;
-   mathematical/backend evaluation failure → writer exists, no Value.

Downstream references bind structurally to that writer and never fall
back to an earlier successful writer merely because the nearest writer
has no Value.

A later definition never retroactively repairs or unlocks an earlier
unresolved writer.

### 2.2 No retroactive name resolution

Resolution is positional.

Example:

``` text
f(x) := g(x)
g(x) := x²
A := f(2)
```

The first `f` does not later acquire `g`. `A` is unavailable because the
`f` writer has no Value.

Likewise:

``` text
f(x) := x + y
y := 5
f(2)
```

evaluates symbolically as `2 + y`, not `7`.

### 2.3 Materialized Values are immutable semantic snapshots

A materialized Value is never re-resolved against later document state.

``` text
a := 4
b := a
a := 7
```

leaves `b = 4`.

The same rule applies to ExpressionValue, FunctionValue, QuantityValue,
VectorValue, MatrixValue and other composite Values.

### 2.4 FunctionValue capture

A FunctionValue is an immutable closure consisting conceptually of:

-   lexical binders;
-   a resolved semantic body;
-   captured external Values/free-symbol identities required by that
    body.

Function definition does **not** require every mathematical operation in
the body to be eagerly computed at `:=`.

The body may be evaluated lazily when the function is applied, provided
that evaluation uses the already-resolved closure and never performs
dynamic document name resolution.

Thus performance strategy is not public semantics.

Example:

``` text
a := 4
f(x) := a*x
a := 7
f(2)
```

returns `8`.

And:

``` text
f(x) := x+1
g := f
f(x) := x²
g(3)
```

returns `4`.

`g := f` captures the current FunctionValue; it is not a dynamic alias
to the name `f`.

### 2.5 General self-recursive functions are not Release-1 semantics

The nearest-predecessor rule is retained unchanged.

A first definition such as:

``` text
f(n) := if(n <= 1, 1, n*f(n-1))
```

does not make its own writer visible while resolving its RHS.

Release 1 therefore does not support general self-recursive
FunctionValues. The implementation should return a specific diagnostic
for unsupported/self-referential callable use rather than silently
reinterpret it.

If recursive sequences are required pedagogically, they may later be
introduced as an explicit mathematical operation without changing
ordinary writer resolution.

### 2.6 Function writers are name-based, not overloaded by arity

newCAS does not introduce function overloading.

``` text
f(x) := x²
f(x,y) := x+y
f(3)
```

binds `f` to the nearest preceding writer, namely the two-argument
FunctionValue, and produces a `wrong-arity` diagnostic.

The earlier arity-1 `f` is not searched as a fallback.

### 2.7 Free-symbol identity

Display spelling is not sufficient semantic identity.

Within a task, unresolved ordinary mathematical names with the same name
denote the same task-local free mathematical symbol unless a
lexical/symbolic binder shadows them.

Conceptually a free-symbol identity may be represented as:

``` text
FreeSymbolIdentity(taskScopeId, name)
```

while lexical binders and operation-introduced dummy variables have
unique identities independent of display spelling.

Consequences:

``` text
A := x+1
B := x+2
A+B
```

uses the same free `x`.

But:

``` text
a := x
f(x) := a
```

does not allow the local binder of `f` to capture the free `x` already
contained in `a`.

Backend adapters must preserve these distinctions even when display
names are identical.

### 2.8 Lexical shadowing

Where multiple lexical or operation-introduced symbolic binders share a
display name, the innermost enclosing binder wins.

Binder identity, not spelling, determines capture.

### 2.9 Substitution

Substitution operates only on free symbols present in an already
materialized Value.

It does not:

-   rewrite historical document bindings;
-   re-resolve names;
-   replace lexical binders;
-   mean function application.

Therefore:

``` text
f(x) := x²
f | x=2
```

must not evaluate to `4`.

It may be a no-op with a diagnostic/warning that `x` is not a free
symbol. Function evaluation is written `f(2)`.

### 2.10 Lists, vectors and matrices

Mathematical type is never inferred from container appearance.

Release syntax must provide explicit constructors.

Normative semantic direction:

``` text
[1,2]                    -> ListValue
vector(1,2)              -> VectorValue
matrix([1,2],[3,4])      -> MatrixValue
```

Exact surface spelling may still be refined before grammar freeze, but
implicit List→Vector/Matrix conversion is not allowed.

### 2.11 EditingSession protects live editing

Keystrokes modify an editor buffer owned by EditingSession.

They do not mutate authoritative block source until commit.

Transient states such as:

``` text
a :=
```

while editing therefore do not temporarily remove a writer from the
mathematical document and cannot cause downstream writer/VAR
oscillation.

### 2.12 VAR/presentation invalidation

Presentation references use the same positional provider resolution as
mathematical references.

If a provider's Value changes from unavailable to available, or vice
versa, dependent presentation references are invalidated and recomputed.

A cached presentation diagnostic is never semantic authority.

### 2.13 Async epoch guard applies to all evaluation

Pure, volatile and external operations use the same monotonic runtime
epoch/generation validity check.

A late result may commit only if its request still belongs to the
current derived runtime state.

Volatility changes reproducibility semantics, not stale-result safety.

### 2.14 Copy and move

Derived state is never copied.

**Copy:** new block ID; copy authoritative source/settings; resolve from
scratch at destination.

**Move:** preserve block ID, including across task boundaries if the UI
permits such a move; update structural task membership and resolve from
scratch in the destination scope.

A block ID identifies the persistent document object, not its
mathematical scope.

### 2.15 Public Value serialization

Opaque backend handles are permitted only as disposable
implementation/cache details.

Every public Value type must have a defined serializable/transportable
representation sufficient for:

-   JS/Python boundaries where needed;
-   Web Worker/cross-thread transport where needed;
-   presentation;
-   diagnostics;
-   reconstruction;
-   tests.

Persistence need not serialize backend objects or handles.

------------------------------------------------------------------------

## 3. Review disposition matrix

  -----------------------------------------------------------------------
  ID              Reviewer        Finding              Resolution
  --------------- --------------- -------------------- ------------------
  C1              Claude          Writer boundary at   **ACCEPT** ---
                                  RHS parse error      parse failure
                                                       means no writer

  C2              Claude          Self recursion       **CLARIFY / R1
                                                       UNSUPPORTED**

  C3              Claude          Eager vs lazy        **CLARIFY** ---
                                  FunctionValue        immutable resolved
                                                       closure; lazy body
                                                       evaluation allowed

  C4              Claude          Arity-based writer   **REJECT proposed
                                  identity             solution** --- no
                                                       overloading

  C5              Claude          Nested binder        **ACCEPT**
                                  shadowing            

  G1              Gemini          Free-symbol freezing **CLARIFY** --- no
                                                       macro
                                                       re-resolution;
                                                       optional
                                                       diagnostic

  G2              Gemini          Self recursion       **MERGED with C2**

  G3              Gemini          `g := f` snapshot vs **ACCEPT snapshot
                                  alias                semantics**

  G4              Gemini          List/vector/matrix   **ACCEPT**
                                  ambiguity            

  G5              Gemini          Live-edit writer     **ALREADY SOLVED /
                                  oscillation          clarify
                                                       EditingSession**

  R1              Grok            Later definition     **ACCEPT no
                                  unlocks earlier      retroactive
                                  unresolved callable  unlock**

  R2              Grok            Free-symbol identity **ACCEPT**
                                  vs binders           

  R3              Grok            Intermediate         **ACCEPT**
                                  failures and writer  
                                  status               

  R4              Grok            VAR stale cache      **ACCEPT**
                                  after provider       
                                  repair               

  R5              Grok            Substitution through **CLARIFY**
                                  FunctionValue        

  R6              Grok            Cross-task copied    **CLARIFY** ---
                                  free symbols         copy source, then
                                                       resolve afresh

  R7              Grok            Volatile async       **ACCEPT**
                                  result after Undo    

  R8              Grok            Quantity magnitude   **CLARIFY** ---
                                  with free symbols    magnitude obeys
                                                       ordinary Value
                                                       rules

  Q1              Qwen            Substitution of      **ACCEPT**
                                  bound function       
                                  parameter            

  Q2              Qwen            Cross-task move      **REJECT proposed
                                  should create new ID solution** ---
                                                       Move preserves
                                                       object identity
                                                       and re-resolves

  Q3              Qwen            Recursive cycle      **MERGED with C2**

  Q4              Qwen            Forward references   **ACCEPT /
                                                       normative test**

  Q5              Qwen            Opaque handles vs    **ACCEPT**
                                  serialization        
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 4. Normative stress tests to add

### 4.1 RHS parse failure does not establish writer

``` text
a := 4
a := )(
b := a+1
```

Expected: second block has no writer; `b = 5`.

### 4.2 Later callable does not retroactively unlock earlier function

``` text
f(x) := g(x)
g(x) := x²
A := f(2)
```

Expected: `f` remains unavailable; `A` is blocked.

### 4.3 Forward free symbol remains free

``` text
f(x) := x+y
y := 5
A := f(2)
```

Expected: `A = 2+y`, not `7`.

### 4.4 Function assignment captures FunctionValue

``` text
f(x) := x+1
g := f
f(x) := x²
a := g(3)
b := f(3)
```

Expected: `a = 4`, `b = 9`.

### 4.5 Bound parameter is not substitution target

``` text
f(x) := x²
f | x=2
```

Expected: no-op or structured diagnostic; never `4`.

### 4.6 Name-based function shadowing

``` text
f(x) := x²
f(x,y) := x+y
f(3)
```

Expected: `wrong-arity`; no fallback to earlier `f`.

### 4.7 Free symbol is not captured by later local binder

``` text
a := x
f(x) := a
f(2)
```

Expected: free `x`, not `2`.

### 4.8 Free symbol is distinct from operation-local binder

``` text
a := x
integral(a, x, 0, 1)
```

Expected: the `x` contained in materialized `a` is not captured by the
integral's local integration binder.

### 4.9 Explicit List versus Vector

``` text
v := [1,2]
u := vector(1,2)
A := matrix([1,0],[0,1])
A*v
A*u
```

Expected: `A*v` type diagnostic; `A*u` returns a VectorValue.

### 4.10 Live editor buffer is not document state

Given:

``` text
a := 4
a := 7
Text: [VAR:a]
```

temporarily editing the second source buffer to `a :=` without commit
must leave the mathematical document and displayed VAR value unchanged.

### 4.11 Failed writer repaired

``` text
a := 4
a := 1/0
Text: [VAR:a]
```

After committing edit of second writer to `a := 7`, expected VAR becomes
available and displays `7`.

### 4.12 Late volatile result after Undo

Start a volatile evaluation, change/undo the document so its request
epoch becomes stale, then receive the old result.

Expected: result is discarded.

### 4.13 Cross-task move

Move a formula block from Task 2 into Task 1.

Expected: block ID is preserved; task membership changes; all semantic
bindings and derived state are reconstructed in Task 1.

------------------------------------------------------------------------

## 5. Freeze completion record

The independent semantic review phase closed after four reviewers.

For architecture v1.0:

1. the decisions in this document were incorporated into
   `ARCHITECTURE_SPECIFICATION_FROZEN_v1.0.md`;
2. the accepted normative cases were incorporated into
   `ARCHITECTURE_STRESS_TESTS_FROZEN_v1.0.md`;
3. an internal consistency pass found no contradiction introduced by
   consolidation;
4. unresolved surface-syntax choices remain explicitly classified as
   grammar-design or implementation choices, not architecture holes;
5. architecture v1.0 was frozen on 2026-09-27.

The dependency/version capability gate for SymPy, Pyodide, NumPy,
Plotly, KaTeX, Peggy and other required runtime dependencies belongs to
the implementation roadmap beginning with P0002. It is not part of the
architecture freeze criterion.

No fifth general architecture review is required unless implementation
evidence reveals a contradiction in frozen semantics. Such a discovery
requires an explicit architecture decision/ADR and architecture version
change before implementation continues.s