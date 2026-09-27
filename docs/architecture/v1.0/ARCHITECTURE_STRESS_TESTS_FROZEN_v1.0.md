# newCAS Architecture --- Normative Stress Tests

**Status:** FROZEN v1.0 companion to
`newCAS_ARCHITECTURE_SPECIFICATION_FROZEN_v1.0.md`\
**Purpose:** Minimal counterexamples and expected semantics for
review/regression

These examples are normative semantic probes unless explicitly marked as
an open UI/implementation decision.

## 1. Nearest predecessor

``` text
a := 4
b := a+1
a := 7
```

Expected: `b = 5`.

## 2. Redefinition before use

``` text
a := 4
a := 7
b := a+1
```

Expected: `b = 8`.

## 3. Read-before-write

``` text
a := 4
a := a+1
b := a
```

Expected: second `a = 5`, `b = 5`.

## 4. No predecessor

``` text
a := a+1
```

Expected: RHS `a` is a free symbol; result is symbolic `a+1`. A warning
may be shown.

## 5. Function captures preceding Value

``` text
a := 4
f(x) := a*x
a := 7
f(2)
```

Expected: `8`.

## 6. Free function parameter remains free

``` text
f(x) := a*x
a := 7
f(2)
```

Expected: `2*a`, not `14`.

## 7. Explicit substitution on free symbol

``` text
f(x) := a*x
f(2) | a=7
```

Expected: `14`.

## 8. Substitution cannot rewrite captured binding

``` text
a := 4
f(x) := a*x
f(2) | a=7
```

Expected: `8`.

## 9. Materialized expression does not become function

``` text
A := x+1
A(2)
```

Expected: diagnostic; `A` is ExpressionValue, not FunctionValue.

## 10. Existing Value is not captured by new binder

``` text
A := x+y
f(x) := A
```

Expected: local `x` does not replace the free `x` already contained in
A.

## 11. Lexical identity

``` text
f(x) := x+y
g(y) := f(y)
```

Expected: `g` contains its local `y` plus `f`'s distinct free `y`; no
accidental capture.

## 12. Function redefinition chain

``` text
f(x) := x²
g(x) := f'(x)
f(x) := g(x)
```

Expected dependency identities: `f₁ → g → f₂`. Values: `g(x)=2x`,
`f₂(x)=2x`.

## 13. Reordered unresolved callable

``` text
f(x) := x²
f(x) := g(x)
g(x) := f'(x)
```

Expected: second `f` is writer but has no Value because `g` is
unresolved at its position. Final `g` binds to second `f` and is
blocked; it must not fall back to first `f`.

## 14. Syntax-invalid definition is not writer

``` text
a := 4
a :=
b := a+1
```

Expected: invalid middle source contributes no writer; `b=5`.

## 15. Evaluation-failed definition remains writer

``` text
a := 4
a := 1/0
b := a+1
```

Expected: second `a` remains provider; `b` is blocked/unavailable, not
`5`.

## 16. Symbolic target overrides document binding in direct operation

``` text
x := 17
diff(x²,x)
```

Expected: `2*x`.

## 17. Materialized Value is not re-resolved

``` text
x := 17
A := x²
diff(A,x)
```

Expected: `0`.

## 18. Dummy variable shadows document writer

``` text
k := 100
sum(k²,k,1,3)
```

Expected: `14`.

## 19. Materialized input is not captured by dummy variable

``` text
k := 100
A := k²
sum(A,k,1,3)
```

Expected: `30000` if the sum operation repeats the already materialized
`A=10000` three times; it must not reinterpret A as `k²`.

## 20. Free symbol inside existing Value is not captured by later local binder

``` text
a := x
integral(a*x,x,0,1)
```

Expected: the free `x` already contained in `a` is semantically distinct
from the integral's local integration variable. Backend identity must
preserve this distinction.

## 21. Task isolation

``` text
Opgave 1:
a := 4

Opgave 2:
b := a+1
```

Expected: Opgave 2 cannot see Opgave 1's `a`; its `a` is free, so
`b=a+1`.

## 22. VAR uses same positional resolution

``` text
a := 4
Text: "a=[VAR:a]"
a := 7
```

Expected: text displays `4`. Move text below second assignment: displays
`7`.

## 23. VAR does not fall back on evaluation failure

``` text
a := 4
a := 1/0
Text: "a=[VAR:a]"
```

Expected: VAR binds second `a` and is unavailable/diagnostic; it must
not display first `a` as current.

## 24. VAR after structural deletion

``` text
a₁ := 4
a₂ := 7
Text: "a=[VAR:a]"
```

Delete `a₂`.

Expected: structural re-resolution now binds VAR to `a₁`, displaying
`4`. This is rebinding after document change, not success-dependent
fallback.

## 25. VAR performs no hidden calculation

Given:

``` text
f(x) := 2*x
```

A text VAR insertion may present `f` itself if FunctionValue has an
inline presentation. It must not silently evaluate arbitrary `f(2)`
entered inside the text reference. Student should create a calculation
Value for `f(2)` and reference that Value.

## 26. Move changes binding, preserves block identity

``` text
a₁ := 4
X := a
 a₂ := 7
```

Move `a₂` before X.

Expected: X rebinds from `a₁` to `a₂`; moved block retains its
persistent block ID.

## 27. Duplicate gets fresh identity

Duplicate a formula block.

Expected: copied authoritative source/settings, fresh block ID, newly
derived bindings/results. Runtime/AST/backend state is not cloned as
authority.

## 28. Copy across task scopes

Copy:

``` text
f(x) := a*x
```

from a task with preceding `a:=4` into a task with no `a`.

Expected: copied f contains free `a`; no hidden reference to source
task.

## 29. Save/load preserves positional semantics

``` text
a := 4
f(x) := a*x
a := 7
```

After save, close, load on another machine: expected `f(x)=4*x`.

No serialized Python task scope is required.

## 30. Runtime crash is recoverable

Delete all evaluator/backend objects and caches while retaining
Document.

Expected: pure mathematical meaning can be reconstructed by parse →
resolve → dependency analysis → evaluation. Volatile operations are
exempt from identical Value reproduction.

## 31. Async stale result

A block begins evaluation at runtime epoch N. Document changes and same
block evaluates at epoch N+1. Old result returns last.

Expected: epoch N result is discarded.

## 32. Undo does not roll runtime epoch backwards

Edit → evaluation starts → Undo restores earlier document content.

Expected: DocumentHistory cursor may move backward, but runtime epoch
increases. Results from the abandoned edit cannot commit after Undo.

## 33. Matrix shape error is not document semantics

``` text
A := matrix(2x2)
v := vector(length=3)
w := A*v
```

Expected: operation kind is semantically valid; backend detects shape
mismatch; adapter returns structured `dimension-mismatch`.
DocumentRuntime does not implement matrix algebra validation.

## 34. Quantity presentation does not mutate Value

``` text
h := 7.83472 [m]
Text: "h=[VAR:h, 2 decimals]"
```

Expected: display `7.83 m`; underlying h retains full Value/precision.

## 35. Regression backend does not leak

``` text
R := linreg(X,Y)
```

Expected: public result is RegressionValue (or final chosen public
equivalent), independent of whether NumPy/SymPy/another backend computed
it.

## 36. Error branch does not stop independent branch

Two independent dependency branches; one provider fails.

Expected: its downstream is blocked; independent dirty branch continues
recalculation.

## 37. Same-name error affects only later consumers

``` text
h₁(t) := valid...
A := h(2)
h₂(t) := unresolvedCallable(t)
B := h(2)
```

Expected: A remains based on h₁. h₂ is writer without Value. B binds h₂
and is blocked.

## 38. Delete failed writer changes structure

Using case 37, delete h₂.

Expected: B re-resolves to h₁ and becomes calculable. This is structural
rebinding, not fallback-on-error.

## 39. No-op substitution

``` text
a := 4
A := a*x
A | a=10
```

Expected: A was materialized as `4*x`; substitution target `a` is
absent/free no longer. Result remains `4*x`. UI may warn that
substitution target does not occur.

## 40. Evaluator ignorance test

For every case above, evaluator must be able to calculate from resolved
instruction + required input Values without knowing taskId, block order,
dependency graph, dirty state or history.

If a case requires evaluator knowledge of those document concepts, the
architecture has failed this test.

## 41. RHS parse failure does not establish writer

``` text
a := 4
a := )(
b := a+1
```

Expected: second source has no writer; `b = 5`.

## 42. Later callable does not retroactively unlock earlier writer

``` text
f(x) := g(x)
g(x) := x²
A := f(2)
```

Expected: `f` has no Value at its definition position; `A` is
blocked/unavailable.

## 43. Forward free symbol remains free

``` text
f(x) := x+y
y := 5
A := f(2)
```

Expected: `A = 2+y`, not `7`.

## 44. Function assignment captures FunctionValue

``` text
f(x) := x+1
g := f
f(x) := x²
a := g(3)
b := f(3)
```

Expected: `a = 4`, `b = 9`.

## 45. Bound parameter is not a substitution target

``` text
f(x) := x²
f | x=2
```

Expected: no-op or structured diagnostic; never `4`.

## 46. Function writers do not overload by arity

``` text
f(x) := x²
f(x,y) := x+y
f(3)
```

Expected: structured `wrong-arity` diagnostic; no fallback to the
earlier `f`.

## 47. Free symbol is not captured by later local binder

``` text
a := x
f(x) := a
f(2)
```

Expected: free `x`, not `2`.

## 48. Existing free symbol is distinct from operation-local binder

``` text
a := x
integral(a, x, 0, 1)
```

Expected: the free `x` already inside materialized `a` is not captured
by the integration binder.

## 49. Explicit List versus Vector

``` text
v := [1,2]
u := vector(1,2)
A := matrix([1,0],[0,1])
A*v
A*u
```

Expected: `A*v` produces a type diagnostic; `A*u` returns a VectorValue.

## 50. Live editor buffer is not document state

Given:

``` text
a := 4
a := 7
Text: [VAR:a]
```

temporarily editing the second source buffer to `a :=` without commit
leaves the authoritative document and displayed VAR value unchanged.

## 51. Failed writer repaired

``` text
a := 4
a := 1/0
Text: [VAR:a]
```

After committing an edit of the second writer to `a := 7`, expected: VAR
becomes available and displays `7`.

## 52. Late volatile result after Undo

Start a volatile evaluation, then edit/Undo so the request epoch becomes
stale before its result arrives.

Expected: the late result is discarded.

## 53. Cross-task move preserves block identity but re-resolves

Move a formula block from Task 2 into Task 1.

Expected: block ID is preserved; task membership changes; all bindings
and derived state are reconstructed in Task 1.

## 54. Same unresolved name denotes same task-local free symbol

``` text
A := x+1
B := x+2
C := A+B
```

Expected: both occurrences refer to the same free mathematical symbol
`x`; `C = 2x+3`, not an expression containing two unrelated
x-identities.

## 55. First self-recursive function is unsupported in Release 1

``` text
f(n) := if(n<=1, 1, n*f(n-1))
A := f(4)
```

Expected: the definition establishes a writer for `f` after successful
parse and valid binder declaration, but its RHS receives the structured
self-reference/unresolved-callable diagnostic defined for Release 1. It
has no Value; `A` is blocked. No reactive dependency cycle is created
and the evaluator is not allowed to recurse accidentally.

## 56. Review criterion

A reviewer should try to find a minimal document for which:

1.  two normative rules imply different results;
2.  result depends on historical execution rather than current document;
3.  save/load changes pure mathematical meaning;
4.  an invalid/failed writer causes success-dependent fallback;
5.  a materialized Value is accidentally re-resolved;
6.  lexical capture depends on display spelling rather than semantic
    identity;
7.  evaluator must know document semantics;
8.  backend choice changes public semantics;
9.  presentation changes mathematical Value;
10. structural mutation leaves hidden ghost state.
