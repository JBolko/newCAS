# newCAS Architecture Specification

**Status:** FROZEN v1.0\
**Freeze date:** 2026-09-27\
**Purpose:** Normative blank-sheet architecture for the next newCAS implementation.

## 1. Executive statement

newCAS is a **reactive mathematical document that uses a CAS as an
evaluator**. It is not a persistent CAS workspace with a document editor
layered on top.

The central invariant is:

> **The document is the only authoritative mathematical state.**

All other mathematical state must either be authoritative document data
or be deterministically derivable from authoritative document data,
except for operations explicitly declared volatile or external.

This specification deliberately separates language semantics, document
semantics, reactive execution, evaluator/backend responsibilities,
presentation, editing-session state and persistence.

## 2. Design goals

newCAS shall:

1.  give a deterministic meaning to document order and redefinitions;
2.  support symbolic mathematics without reimplementing SymPy;
3.  make runtime/backend state disposable;
4.  support targeted reactive recalculation rather than global replay;
5.  preserve exact mathematical values independently of display
    rounding;
6.  keep task/problem scopes isolated;
7.  allow text, plots and other presentation blocks to react to
    mathematical values;
8.  remain backend-independent at its public Value/Operation boundary;
9.  provide simple recommended student practice while retaining precise
    semantics for unusual cases;
10. make save/load reconstruct mathematical meaning without serializing
    Python/SymPy runtime state.

## 3. Non-goals

The architecture does **not** require newCAS to:

-   reproduce SymPy's symbolic algorithms;

-   implement every mathematical feature SymPy exposes;

-   make every legal language construct recommended for students;

-   preserve undo history in `.ncas`;

-   preserve backend object identity across reloads;

-   make volatile operations reproducible;

-   support cross-task references in the initial design;

-   infer vectors, matrices or functions from ambiguous container
    syntax;

-   expose backend choice (SymPy/NumPy/etc.) in public semantics.

-   General self-recursive FunctionValues are not a Release 1 language
    feature; recursive-sequence support, if later required, must be
    explicit rather than weakening nearest-predecessor resolution.

## 4. Authority and lifetime model

### 4.1 Document Model --- authoritative and persistent

The Document owns data whose meaning must survive save/load:

-   document identity and metadata;
-   ordered tasks/problems;
-   ordered blocks;
-   persistent task/scope IDs;
-   persistent block IDs;
-   block type;
-   formula source;
-   text content and text segments;
-   presentation/display settings intentionally chosen by the user;
-   explicit document-level references where such features are defined.

### 4.2 Editing Session --- ephemeral

The Editing Session owns editing state that normally disappears when the
document is closed:

-   undo/redo history;
-   history cursor;
-   active editor buffers not yet committed;
-   selection, focus and active block;
-   transient UI state.

Autosave is persistence, not a document transaction.

### 4.3 Document Runtime --- derived

Document Runtime owns reconstructible semantics and reactive state:

-   parsed ASTs;
-   semantic IR;
-   reads/writes;
-   writer identities;
-   resolved bindings;
-   dependency graph;
-   presentation dependencies;
-   calculation state (`idle`, `running`, `success`, `error`, `dirty`,
    `blocked` or equivalent);
-   cached Values;
-   diagnostics;
-   runtime generations/epochs;
-   position-dependent variable/value views.

None of this is mathematical authority.

### 4.4 Evaluator/backend --- disposable

The evaluator may physically hold:

-   SymPy expressions;
-   SymPy Symbols/Dummies;
-   NumPy arrays;
-   compiled/materialized FunctionValues;
-   opaque handles;
-   operation caches.

These are disposable implementation state. Loss of the evaluator must
not destroy document meaning.

## 5. Core semantic invariants

The following rules are normative.

1.  **Document authority.** Mathematical meaning is reconstructed from
    the authoritative document.
2.  **Task mathematical scope.** A top-level task/problem defines a
    mathematical scope. Subtasks within that task share the scope.
    Different tasks are isolated. This is a document-semantic scope, not
    a persistent Python/runtime Task Scope.
3.  **Document order.** Block order is part of mathematical semantics.
4.  **Writer establishment.** A writer exists only after the complete
    source parses as a definition and its assignment target/binder
    declaration is structurally valid. Any later resolution,
    unsupported-operation, mathematical or backend failure leaves that
    writer in place without a current Value.
5.  **Nearest predecessor.** A positionally resolved name binds to the
    nearest preceding writer of that name in the same scope, subject to
    lexical and operation-specific resolution rules.
6.  **No success-dependent fallback.** Bindings do not skip a writer
    merely because its Value is unavailable or evaluation failed. A
    later definition never retroactively repairs an earlier unresolved
    writer.
7.  **Materialized Values are not re-resolved.** Name resolution
    operates on source/semantic occurrences, never recursively on
    symbols contained in already materialized Values.
8.  **Semantic identity.** Within one task mathematical scope,
    unresolved ordinary names with the same spelling denote the same
    free mathematical symbol unless shadowed. Lexical binders and
    operation-introduced symbolic targets have unique semantic
    identities independent of display spelling, preventing accidental
    capture.
9.  **Atomic block evaluation.** A block either produces its valid
    mathematical transition/Value or produces no valid transition.
    Failed evaluation must not partially mutate hidden state.
10. **Disposable runtime.** Backend/runtime state may be deleted and
    reconstructed without loss of pure document meaning.

## 6. Recommended student practice versus language semantics

newCAS distinguishes:

-   **legal/defined semantics** --- what the language means;
-   **supported mathematics** --- what newCAS officially evaluates;
-   **recommended student practice** --- simple patterns students should
    normally use;
-   **suspicious constructs** --- legal constructs for which UI
    diagnostics may be useful.

Recommended practice includes:

-   define `A(x) := ...` when `x` is intended as a function argument;
-   use a global `a := 4` only when that value should apply from that
    point through the task;
-   use local substitution such as `| a=4` for a local insertion into a
    still-symbolic Value;
-   normally avoid multiple assignments to the same variable/function in
    one task;
-   place definitions before their intended uses.

These recommendations do not replace formal semantics.

## 7. Document order and writer semantics

Consider:

``` text
a := 2
b := a + 1
a := 3*b
```

The semantic model is analogous to:

``` text
a₁ := 2
b  := a₁ + 1
a₂ := 3*b
```

The implementation need not expose SSA, but dependencies are between
definition/block identities, not merely symbol-name nodes.

### 7.1 Read-before-write in one definition

``` text
a := 4
a := a + 1
```

The RHS `a` binds to the previous writer. The second block then becomes
the new writer. Result: new `a = 5`.

Without a previous writer:

``` text
a := a + 1
```

RHS `a` may become a free mathematical symbol according to ordinary
unresolved-symbol rules. UI may diagnose this as suspicious.

### 7.2 Failure does not alter binding

``` text
a := 4
a := 1/0
b := a + 1
```

The second `a` is the nearest writer. `b` is blocked/unavailable; it
must not fall back to the first `a`.

### 7.3 Parse/structural boundary for writer establishment

A writer exists only when the **complete source** parses as a definition
and the assignment target or binder declaration is structurally valid.

``` text
a := 4
a :=
b := a + 1
```

and

``` text
a := 4
a := )(
b := a + 1
```

both contain a parse-invalid second source. No second definition/writer
exists, so `b` binds to the first `a`.

By contrast, once a complete valid definition exists, all later failures
preserve writer identity:

-   unresolved callable/name-resolution failure;
-   unsupported operation;
-   dimension/type failure discovered during evaluation;
-   mathematical/backend failure such as division by zero.

Such a writer has no current Value, and downstream references bind to it
and become blocked/unavailable. They never fall back to an earlier
successful writer.

A later definition also never retroactively repairs an earlier
unresolved writer:

``` text
f(x) := g(x)
g(x) := x²
A := f(2)
```

The first `f` was resolved at its own document position, where `g` was
unavailable. `A` therefore remains blocked. Reordering or redefining `f`
after `g` is required.

## 8. Parsing, semantic resolution and Semantic IR

The architecture separates:

``` text
Source
  ↓
Parser / AST
  ↓
Structural semantics
  ↓
Name & scope resolution
  ↓
Semantic IR
  ↓
Evaluator
```

The parser determines what was written. It must not inspect document
runtime state.

Semantic Resolution determines what names mean at the block's document
position.

The evaluator receives already-resolved mathematical meaning and must
not infer document semantics.

### 8.1 Candidate Semantic IR concepts

The exact representation remains an implementation design, but the
architecture requires concepts equivalent to:

-   `Define`
-   `DefineFunction`
-   `Literal`
-   `BoundReference` / provider Value reference
-   `Binder`
-   `LocalReference`
-   `FreeSymbol`
-   `SymbolTarget`
-   `OperationReference`
-   `Call`
-   operators/relations
-   list/vector/matrix constructors
-   quantity construction
-   substitution

The IR should be small and canonical even when surface syntax is rich.

## 9. Name resolution

Resolution priority is contextual rather than a single global name
table.

Typical priority:

1.  lexical binder introduced by the current semantic construct;
2.  operation-introduced symbolic/scoped name;
3.  nearest preceding document writer in the same task;
4.  free mathematical symbol, where that syntactic role permits one.

Unknown names in callable position need not be accepted as arbitrary
unknown functions. A call such as `sni(x)` should be diagnosable rather
than silently inventing an unknown callable.

A structurally valid definition can nevertheless remain a writer when
its RHS contains an unresolved callable.

Example:

``` text
f(x) := x²
f(x) := g(x)
A := f(2)
```

The second `f` is the nearest writer. Its RHS cannot resolve `g` as
callable, so it has no valid Value. `A` binds to the second `f` and is
blocked; it does not fall back to the first `f`.

## 10. Expressions, functions and lexical capture

### 10.1 Expression versus function

``` text
A := x + 1
```

binds an Expression Value, not an implicit function.

``` text
f(x) := x + 1
```

binds a FunctionValue with local binder `x`.

Free symbols do not implicitly parameterize an expression.

### 10.2 Function capture

``` text
A := x + y
f(x) := A
```

The local parameter `x` does not capture the free `x` already contained
in materialized `A`. `A` is an existing Value.

A FunctionValue is conceptually an immutable closure over:

-   its lexical binders;
-   a resolved semantic body;
-   captured external Values and free-symbol identities required by that
    body.

The closure may be evaluated lazily when called. Lazy backend work must
not perform dynamic document name resolution.

``` text
a := 4
f(x) := a*x
a := 7
f(2)
```

therefore returns `8` regardless of whether the backend computed the
function body eagerly at definition or lazily at application.

### 10.3 FunctionValues are Values

Functions may be assigned and passed:

``` text
f(x) := x²
A := f
B := A(3)
```

`A := f` captures the current immutable FunctionValue. It is not a
dynamic alias to the name `f`.

``` text
f(x) := x+1
g := f
f(x) := x²
g(3)
```

returns `4`.

Function writers are name-based; Release 1 does not introduce
overloading by arity. If the nearest writer named `f` has the wrong
arity, application produces a structured `wrong-arity` diagnostic rather
than searching older writers.

Higher-order use may likewise be supported without introducing a
separate static type system.

### 10.4 Binder identity

Binders require identity independent of spelling. Conceptually:

``` text
Binder(id=42, displayName="x")
LocalReference(42)
```

This prevents accidental capture in nested/shadowed constructs.

Example:

``` text
f(x) := x + y
g(y) := f(y)
```

`g`'s local `y` must not capture `f`'s free `y`.

Within one task, unresolved ordinary names with the same spelling denote
the same task-local free mathematical symbol unless shadowed by a
lexical or operation-introduced binder. Conceptually this may be
represented as `FreeSymbolIdentity(taskScopeId, name)`.

Lexical binders and operation-introduced dummy variables have unique
identities independent of spelling. Where several enclosing binders
share a display name, the innermost enclosing binder wins.

Backend adapters may use SymPy `Dummy`, uniquely mapped `Symbol` objects
or an equivalent mechanism to preserve these identities while rendering
user-facing names normally.

## 11. Symbolic targets and operation scopes

Some operations establish symbolic roles that override ordinary document
lookup for specific argument positions.

Example:

``` text
x := 17
diff(x², x)
```

The `x` introduced as differentiation variable is a symbolic target;
result is `2*x`.

But:

``` text
x := 17
A := x²
diff(A, x)
```

`A` was already materialized as `289`; its internal Value is not
re-resolved. Result is `0`.

The same principle applies to operations such as integral, sum, product,
solve and limit, according to their OperationSpec.

Nested binders with identical display names must retain distinct
identities; ordinary lexical scoping applies, so the innermost enclosing
binder wins.

General self-recursive FunctionValues are not part of Release 1
semantics. While resolving the RHS of a first definition
`f(...) := ...`, that definition is not yet a preceding writer for `f`.
A self-call therefore receives a specific unsupported/self-reference
diagnostic rather than creating a reactive dependency cycle. If
recursive sequences are later required pedagogically, they should be
introduced explicitly without weakening ordinary nearest-predecessor
resolution.

## 12. Substitution

Substitution is an explicit mathematical operation, e.g.:

``` text
A | x=2
f(5) | a=5
```

The exact surface grammar is subject to grammar design, but substitution
semantics are:

-   it operates only on free symbols present in an existing materialized
    Value;
-   it does not replace lexical binders or operation-introduced local
    binders;
-   it does not mean function application;
-   it does not rewrite historical document bindings;
-   it does not recursively re-resolve names against current document
    state.

Example:

``` text
a := 4
f(x) := a*x
f(2) | a=7
```

returns `8`, because `f` already captured/materialized `a=4`; there is
no free `a` to substitute.

A no-op substitution may optionally produce a diagnostic if the target
symbol is absent, but the mathematical result is unchanged.

## 13. OperationSpec and public operations

Public newCAS operations should be declared through a small declarative
operation contract rather than hard-coded document-runtime special
cases.

An OperationSpec may describe:

-   public name and aliases;
-   argument roles;
-   which arguments introduce symbolic targets or lexical binders;
-   evaluator dispatch;
-   purity/volatility;
-   supported Value categories;
-   diagnostic adaptation metadata where useful.

OperationSpec must remain a small declarative vocabulary, not evolve
into a second programming language.

Adding an ordinary mathematical operation should ideally require
implementation + OperationSpec + tests, not changes to DocumentRuntime
semantics.

## 14. Value model

A Value is a mathematical result/operand, distinct from transport Result
objects and presentation.

Required architectural properties:

-   typed enough to preserve mathematical identity;
-   immutable at the newCAS semantic level;
-   backend-independent;
-   serializable/transportable where required;
-   not inferred solely from container appearance.

Candidate Value categories include:

-   scalar/expression;
-   function;
-   relation;
-   list/data collection;
-   vector;
-   matrix;
-   quantity;
-   set/solution-like backend-adapted values;
-   regression;
-   distribution.

This list is not a promise that Release 1 implements all categories.

### 14.1 Representability is not operability

A Value may be representable even when a requested operation on it is
invalid. Mathematical operation validity should generally be checked at
operation/evaluator/backend time rather than by creating a large static
generic type system.

## 15. Lists, vectors and matrices

Mathematical type must not be inferred merely from nested containers.

The language shall use explicit syntax/constructors where ambiguity
would otherwise arise.

Normative semantic direction:

``` text
[1,2]                  -> ListValue
vector(1,2)            -> VectorValue
matrix([1,2],[3,4])    -> MatrixValue
```

The exact final spelling remains a grammar-design choice until grammar
freeze, but implicit List→Vector/Matrix conversion is not permitted.

Semantics include:

-   Matrix × Matrix: matrix product;
-   Scalar × Matrix: scalar multiplication;
-   Matrix × Vector: legitimate operation, backend validates dimensions;
-   Vector × Vector: avoid assigning ambiguous meaning to `*`; prefer
    explicit `dot`/`cross` where appropriate;
-   List × List: no silent vector or elementwise interpretation unless
    explicitly specified by an operation.

For `A^-1`, MatrixValue means matrix inverse; scalar means reciprocal.
Inverse functions should use an explicit operation rather than
overloading this notation.

## 16. Quantities and units

Quantity is a true Value composition, not formatting.

A useful model is:

``` text
QuantityValue {
    magnitude: Value,
    unit: Unit
}
```

Thus the magnitude may be scalar, vector or matrix where supported:

``` text
5 [m]
(5,6) [m/s]
matrix(...) [N/m]
```

Unit names are resolved through a UnitRegistry/specialized unit
language, not ordinary document name resolution.

Backend capability does not automatically imply official newCAS unit
capability.

Unit algebra and dimensional validity should use the selected backend
where appropriate; DocumentRuntime must not become a physical-dimension
engine.

## 17. Dependency model

For each task, dependency analysis is derived from ordered blocks.

It produces at least:

-   writer identities;
-   read → provider bindings;
-   dependency edges;
-   sufficient information to detect provider changes after structural
    edits.

Dependencies are between block/definition identities, not only symbol
names.

Example:

``` text
f(x) := x²
g(x) := f'(x)
f(x) := g(x)
```

is structurally:

``` text
f₁ → g → f₂
```

not a name-level cycle `f ↔ g`.

### 17.1 Full rebuild on structural mutation

For expected document sizes, insert/move/remove may rebuild dependency
analysis from authoritative block order. This is preferred over complex
incremental graph surgery until performance evidence requires otherwise.

### 17.2 Binding changes matter

A structural edit may change the provider identity without changing the
apparent set of symbol names or even graph edge count. Provider bindings
therefore must be compared, not merely edge sets.

## 18. Reactive calculation state

Dependency graph determines **what** is affected. Document
semantics/order determine **which Values apply**.

A source or structural change invalidates only affected blocks and
downstream consumers.

A failed provider blocks dependent calculation; independent branches
continue.

Cached stale Values may exist for UX/performance, but they must never be
treated as current mathematical Values.

### 18.1 Async result protection

Runtime uses monotonic generations/epochs to reject stale asynchronous
results.

Document history position and runtime epoch are distinct concepts. Undo
may return the document to earlier content while runtime epoch continues
to increase.

An evaluator result may be committed only if it still matches the
current request/generation. The same epoch/generation guard applies to
pure, volatile and external operations; volatility never permits a stale
result to commit after an edit or Undo.

## 19. Editing and document transactions

Undo/redo is session state, not mathematical state.

Keystrokes in an active editor modify an EditingSession-owned buffer.
Authoritative block source changes only on commit. Transient
parse-invalid text in the editor buffer therefore cannot temporarily
remove writers, rebind downstream formulas or make VAR references
oscillate.

A practical representation is a linear `DocumentTransaction[]` plus
cursor. Transactions contain reversible authoritative-document changes
such as:

-   SetBlockSource;
-   InsertBlock;
-   RemoveBlock;
-   MoveBlock;
-   SetBlockProperty/Setting.

One user action may contain multiple primitive changes.

After undo, a new edit truncates the redo branch.

Undo reverts Document changes; DocumentRuntime then
re-resolves/recalculates. Backend state is never rolled back.

Copy/duplicate creates fresh block IDs. Move preserves block identity.
Derived AST/bindings/results are never copied as authority.

## 20. Text blocks and VAR references

Text may consist of segments. A VAR UI action inserts a reference to an
existing mathematical Value available at the text block's position.

Conceptually:

``` text
VariableSegment {
    name: "h",
    display: {
        mode: "significantFigures",
        digits: 3
    }
}
```

The segment inherits the scope of its containing block and uses the same
nearest-predecessor resolution principle as formula references.

Example:

``` text
a := 4
Text: "a = [VAR:a]"
a := 7
```

The text displays `4`. Moving the text below the second definition
causes it to display `7`.

A VAR segment presents an existing Value; it does **not** execute hidden
mathematics. To display `f(2)`, the student should normally create a
calculation Value and insert that Value.

If the nearest writer exists but has no valid Value, VAR does not fall
back to an older writer. It becomes unavailable/diagnostic, optionally
showing stale presentation clearly marked as stale.

If structural change removes the nearest writer, resolution is
recomputed and may bind to an earlier writer. If no valid provider
exists, the VAR reference is unresolved because a presentation reference
requires an available defined Value; it does not display a free symbol
as though it were a computed value.

Display rounding/significant figures are presentation settings and never
alter the underlying Value.

## 21. Presentation dependencies

Presentation blocks may depend on mathematical Values without producing
mathematical state.

Examples:

-   VAR text segment;
-   result display;
-   plot of an existing function/value;
-   result table that only presents Values.

Presentation dependencies use the same semantic provider resolution
where applicable, but they do not create mathematical writer edges.

A block that actually performs mathematical calculations (for example, a
future calculated table) belongs on the mathematical/evaluation side of
the boundary even if its output is tabular.

## 22. Persistence and `.ncas`

`.ncas` is the living editable/reactive document.

Save/load must preserve authoritative Document data and version
metadata. It must not require serialization of SymPy/Python runtime
state.

Recommended version metadata:

-   `fileFormatVersion` --- how the file structure is decoded;
-   `languageVersion` --- what source syntax/semantics mean;
-   `engineVersion` --- evaluator semantic/capability version relevant
    to reconstruction;
-   optional application build metadata for debugging.

On load:

``` text
Document source/order
  ↓
parse
  ↓
semantic resolution in document order
  ↓
dependencies/bindings
  ↓
evaluation
  ↓
Values/presentation
```

Pure operations should reconstruct equivalent mathematical meaning.
Explicitly volatile/external operations may legitimately produce
different Values.

Disposable caches may optionally be persisted for performance, but they
are never authoritative and must be safe to discard.

Undo history is normally not part of `.ncas`.

PDF is a frozen presentation/submission artifact, not the living
mathematical document.

## 23. Save/load and order

Reload follows document order and nearest-predecessor semantics exactly
as live editing does.

Example:

``` text
a := 4
f(x) := a*x
a := 7
```

Reload reconstructs `f(x)=4*x`. A later writer cannot affect a
previously resolved/materialized Value.

Any implementation that first collapses the task to a final-name table
(`a=7`) and then evaluates earlier blocks from that table violates this
specification.

## 24. Variable/value views

A UI variable list is a derived, position-sensitive view, not semantic
authority.

For a VAR button at a text block, the natural view is the Values
available at that position in the containing task.

A final-task variable table may be useful for debugging or UI, but must
not be used as the evaluator environment for earlier blocks.

## 25. Evaluator boundary

The evaluator's mathematical contract should be equivalent to:

``` text
evaluate(
    resolvedInstruction,
    inputValues,
    evaluationOptions
) -> EvaluationOutcome {
    value?,
    diagnostics[],
    metadata?
}
```

Exact transport is an implementation decision.

The evaluator must not require mathematical knowledge of:

-   taskId;
-   documentId;
-   block order;
-   nearest-predecessor resolution;
-   dependency graph;
-   dirty state;
-   undo history;
-   editor state.

Block/request IDs may be carried as correlation metadata for async
routing, but evaluator semantics must not depend on them.

The evaluator may use opaque backend handles and caches for performance.
Such handles are disposable and are not authority.

## 26. Backend boundary and complexity budget

> **newCAS introduces its own complexity only when the problem belongs
> to newCAS.**

newCAS owns:

-   language semantics;
-   name/scope resolution;
-   document order and dependencies;
-   public Value/Operation contracts;
-   reactivity;
-   persistence;
-   presentation contracts;
-   pedagogical diagnostics;
-   adaptation of backend results/errors.

Backends own mathematical computation appropriate to them:

-   SymPy: symbolic algebra, solving, differentiation, integration,
    simplification, limits and related symbolic work;
-   NumPy: numeric arrays/linear algebra/statistical computation where
    it is the natural backend;
-   other backends may be introduced behind the same public semantics.

Backend selection is an evaluator implementation concern and must not
leak into Semantic IR or public Value semantics.

newCAS validates its own language/API/OperationSpec contract. Backend
validates mathematical conditions for a concrete valid operation where
appropriate.

Example:

-   `det(v)` may be rejected by newCAS operation contract as invalid
    argument type;
-   `A₂×₂ * v₃` is a legitimate operation kind whose shape mismatch can
    be detected by backend and adapted to `dimension-mismatch`;
-   `inverse(A)` accepts a MatrixValue; backend determines whether the
    concrete matrix is invertible.

## 27. Diagnostics

Diagnostics are part of the public newCAS contract and should be
structured, e.g. code + parameters + severity/presentation metadata.

Locale translates diagnostics; it must not change mathematical
semantics.

Useful categories include:

-   syntax error;
-   invalid assignment target;
-   unresolved callable;
-   unavailable/blocked provider;
-   invalid argument type;
-   dimension mismatch;
-   backend mathematical failure;
-   unsupported operation/capability;
-   suspicious but legal construct.

Tests should prefer diagnostic codes over localized text.

## 28. Locale

newCAS has one mathematical language/semantic model. Locale may control:

-   translated diagnostics;
-   input aliases where explicitly supported;
-   decimal/display conventions;
-   UI labels.

Locale must not create country-specific parser/runtime branches or alter
`.ncas` mathematical meaning.

## 29. Statistics, regression and distributions

Statistics should use ordinary Values and operations where possible.

Regression may return a rich `RegressionValue` containing or exposing
model FunctionValue, coefficients, residuals and fit measures.
Presentation operations such as plot/residual plot are distinct from
mathematical Value production.

DistributionValue is a legitimate Value concept for operations such as
cdf/quantile/pdf/pmf and QQ plots, but newCAS need not build a complete
symbolic probability system to support practical statistics.

## 30. Plotting

Plotting is presentation. Plotly or another renderer consumes a
PlotSpec/data derived from mathematical Values.

Plotting must not decide document semantics or name resolution.

If the source Value becomes invalid/unavailable, the plot is
unavailable/stale rather than silently continuing as current truth.

The architecture should allow heavy evaluator work to move to a Web
Worker without changing mathematical contracts.

## 31. Grammar principles

Prefer explicit syntax over heuristic guessing where ambiguity affects
meaning.

Current/favored principles include:

-   `:=` definition;
-   `=` mathematical relation;
-   explicit function parameters;
-   explicit unit syntax `[unit]`;
-   explicit substitution `|` at low precedence;
-   explicit list/vector/matrix distinctions where required;
-   no splitting of unknown identifiers merely to guess implicit
    multiplication.

The current grammar is not sacred. Parser/Transformer may be redesigned
where the semantic model requires it.

## 32. Copy, move and structural edits

-   **Move:** preserve block ID; re-resolve at new position/scope. If UI
    permits a move across task boundaries, the block keeps its object
    identity while task membership changes; all semantic bindings and
    derived state are reconstructed in the destination scope.
-   **Duplicate/copy:** create fresh block IDs; copy authoritative
    content/settings; do not copy AST, bindings, results or backend
    state as authority.
-   **Copy task:** create fresh task/scope and block identities; analyze
    independently.
-   **Delete:** remove writer; re-resolve affected
    downstream/position-dependent references.
-   **Undo delete:** restore original block identity, then re-resolve
    normally.

If future document features contain explicit persistent block-ID
references, copy/paste may require local ID remapping for those explicit
references. Ordinary mathematical name resolution must not depend on
such remapping.

## 33. Pure versus volatile operations

OperationSpec should distinguish operations whose result is reproducible
from document state from explicitly volatile/external operations.

For pure operations:

> same authoritative document + language/engine semantics + relevant
> settings ⇒ equivalent mathematical meaning/results.

For volatile operations such as random generation, reload may produce a
different Value unless the operation explicitly stores a seed/value as
authoritative data.

## 34. Release completeness

Architecture completeness and implementation completeness are different.

Release 1 may support a narrower mathematical surface, especially for
early gymnasium use, provided exposed functionality is semantically
complete and reliable.

The long-term goal is sufficient breadth for relevant 3.g exam work.

One program/language is preferred. Subject-specific UI may use
progressive disclosure, but there should not be separate math/physics
parsers or evaluator semantics.

## 35. Migration implications for current newCAS

The existing architecture contains a persistent Python Task Scope
(`task_registry`, `ScopedGlobals`, `run_in_task(taskId, ...)`) whose
state follows execution history.

This specification supersedes the idea that persistent Task Scope is
authoritative mathematical state.

Likely retained concepts/components:

-   parser infrastructure, subject to grammar revision;
-   registry/public operation catalog, evolved toward OperationSpec;
-   BASE_CONTEXT as evaluator implementation context, not document
    state;
-   result/diagnostic transport concepts;
-   Document Model;
-   DependencyAnalyzer/DependencyGraph concepts;
-   block identities and task IDs;
-   dirty/generation protections;
-   structural mutation semantics.

Likely refactored/replaced:

-   DocumentRuntime evaluation orchestration;
-   CASEngine contract;
-   Python persistent task-scope ownership;
-   auto-symbolization as execution-history behavior;
-   replay/reset as the primary consistency mechanism.

The migration should not begin until this architecture has passed
independent review and dependency/capability review.

## 36. Pre-implementation dependency/capability gate

After architecture freeze and before implementation/refactor, review and
lock compatible versions/capabilities of at least:

-   Pyodide;
-   SymPy;
-   NumPy;
-   Plotly.js;
-   KaTeX;
-   Peggy.js;
-   other actual runtime dependencies.

Review criteria include browser/Pyodide compatibility, API stability,
offline distribution, bundle size/performance and required mathematical
capabilities.

Capability probes should test the selected backend behavior for cases
relevant to the public contract (e.g. solution sets/ConditionSet,
limits/special values, matrices, units, diagnostics adaptation).

`SymPy can do it` does not automatically mean
`newCAS officially supports it`.

## 37. Architecture acceptance criterion

A proposed feature or implementation should be rejected or redesigned if
it requires any of the following without an explicit new architectural
decision:

-   hidden authoritative mathematical state outside Document;
-   result dependence on historical execution order rather than document
    order;
-   success-dependent provider fallback;
-   re-resolution inside materialized Values;
-   evaluator knowledge of document/task semantics;
-   UI reading Python/SymPy scope directly;
-   backend-specific public semantics;
-   display rounding mutating mathematical Values;
-   save/load requiring serialized backend state.

## 38. Open implementation decisions

The following are intentionally **not** frozen by this architecture:

-   exact JS class/module names;
-   exact Semantic IR JSON representation;
-   exact Value transport encoding;
-   exact OperationSpec schema;
-   where opaque backend handles/caches are used as local performance
    optimizations;
-   exact table block taxonomy;
-   exact syntax for vectors/matrices where not already established;
-   exact result Value representation for all SymPy
    solution/set/special-value cases;
-   exact UI wording/severity of suspicious-construct warnings;
-   performance optimizations after correctness is established.

Every public Value type must nevertheless have a defined
serializable/transportable representation for the boundaries that
require it (including presentation, tests and cross-thread/cross-runtime
transport). Opaque handles are disposable implementation details and
never the only representation of public mathematical meaning.

These open implementation choices must not be mistaken for semantic
ambiguity.

## 39. Independent review closure

The architecture was adversarially reviewed independently by four
external models (Claude, Gemini, Grok and Qwen). No reviewer produced a
counterexample requiring abandonment of the core ownership model,
nearest-predecessor semantics, immutable/materialized Values, task
isolation or evaluator independence.

Accepted findings were consolidated in
`newCAS_ARCHITECTURE_REVIEW_RESOLUTION.md` and incorporated before the
v1.0 freeze.

No additional general architecture review is required for v1.0. A future
implementation discovery that would change normative mathematical
semantics requires an explicit architecture decision/ADR and a new
architecture version; it must not be introduced as an implementation
patch.

## 40. Normative summary

The architecture can be summarized as:

``` text
EDITING SESSION
  ephemeral editor/history state
          │ edits
          ▼
DOCUMENT MODEL
  authoritative source/order/scope/settings
          │ derive
          ▼
DOCUMENT RUNTIME
  parse → resolve → bindings → dependencies
  reactive validity / Values / diagnostics
          │ resolved instruction + input Values
          ▼
EVALUATOR
  OperationSpec dispatch + Value adaptation
          │
          ├── SymPy
          ├── NumPy
          └── other backend implementations

PERSISTENCE: Document ↔ .ncas
PRESENTATION: Values → text/plots/tables/PDF
```

The evaluator computes mathematics. Document Runtime determines why a
particular Value applies at a particular document position. The Document
remains the source of truth.
