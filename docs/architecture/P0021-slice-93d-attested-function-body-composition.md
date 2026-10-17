# P0021 Slice 93d — attested function-body composition (GREEN candidate)

## Scope and architectural decision

Promotes the three S93c RED capability contracts into ordinary mandatory
regressions, with additional fail-closed tests. Does not change any frozen v1
architecture document, expand the Value schema, add an evaluator, change Python,
or touch legacy CASEngine/Transformer.

A function-body call such as `g(x):=f(x)*2` is **not** resolved by reading
`f` from the current source-name environment during evaluation. P0020 analyzes
calls in the defining block against earlier positions; the function-definition
task attests each callable provider (providerId, source name, current-revision
FunctionValue). The compiler obtains only an explicit provider-reference.

During *materialization*, an attested FunctionValue call is normalized by the
existing identity-based `applySelectedFunctionValue` operation. That performs
mathematical beta substitution of the earlier FunctionValue and its captured
ExpressionValues, producing an ordinary expression tree with the **current
definition's own binder identities**. The resulting FunctionValue is a normal
immutable, transportable P0005 Value; callable captures are not smuggled into
the resulting scalar `capturedValues` collection. No Python string creation,
source-name lookup, implicit globals or dynamic operation selection occurs.

The purpose is to share the established compiler/mathematical Value path, not
to introduce another dispatch mechanism.

## Precise guarantees in this slice

1. Prior `f(x):=x+1`, then `g(x):=f(x)*2`, then `g(3)` evaluates to 8.
2. Captures in the *earlier* `f` remain valid: with `a:=2`, `f(x):=a*x+1`,
   `g(x):=f(x)+f(1)`, then `g(3)` is 10.
3. Later `f` redefinition cannot affect an earlier definition of `g`.
4. Forward calls, non-callable scalar providers, wrong arity, missing or forged
   callable providers fail closed; they do not fall back to a later definition.
5. Calls not selected by OperationSpec require an explicitly attested document
   provider-reference. Scalar variable captures continue to be distinct.
6. The existing single-statement-per-block v1 constraint is unchanged.

## Deliberately not addressed

- General free-symbol algebra and symbolic operation roles (F6/F7).
- Structural identities and atomic commits for multiple statements in one block.
- General recursion or mutually recursive definitions, future callable types,
  non-expression function results or arbitrarily large function expansion.
- Real Web Worker/browser acceptance and resource quotas (F5 / S94).
- Migration of the production UI away from legacy CASEngine.

## RED → GREEN gates

- S93c pressure: three previously failing examples become ordinary JS tests.
- S93d new mandatory regression: nine tests, including negative boundary tests.
- Parser --check, selected regression suites, full `node --test`, and full Python
  regression must all return zero on the user's Node 24 baseline.
- The historical `tests/pressure/p0021-slice-93c-composed-functions.red.mjs`
  may be retired **only after full acceptance** and only if its content matches
  the exact previously distributed SHA256. Temporary migration-verification
  scripts are not part of the student release or the intended Git commit.
