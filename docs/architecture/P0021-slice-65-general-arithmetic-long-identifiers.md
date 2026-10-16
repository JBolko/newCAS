# P0021 Slice 65 — arithmetic expression assignments and long identifiers

Status: locally GREEN (five new focused Node tests). Node 24 full-regression verification remains with the integrating checkout.

## Language invariant

A maximal contiguous identifier is one name: `ab` does not mean `a*b`. Both `a*b` and the explicitly separated `a b` parse as multiplication in the current Peggy grammar. No lexer split, implicit name-based multiplication, or speculative lookup has been introduced. This invariant preserves long identifiers.

## Integration

The existing runtime-owned ordered batch now dispatches arithmetic `Assignment` RHS expressions, and bare `Variable` reads, through a source-attested value evaluator. The existing P0021 `compileSelectedSourceAst` handles the grammar and selected OperationSpecs; P0020 snapshot references provide exact provider identities; `evaluateNestedSelectedCalls` uses the existing selected-operation evaluator. There is no persistent cache, Python task scope, new graph, or new DocumentRuntime.

Tested examples: `a:=2; b:=3; c:=a*b+1; c` yields 7; `ab:=11; named:=ab+1` yields 12, while `a b+1` yields 7; changing `a` produces 13; unresolved `ab` fails closed despite `a` and `b` being defined.

## Remaining limitations

The selected path covers arithmetic expressions that lower through the currently selected value-role operations, integer literals, provider reads and arithmetic assignments. It does not yet generalize top-level arbitrary expression statements, symbolic roles, noninteger literals, nested user-defined calls, or the production Pyodide worker path as a whole. The existing literal assignment and one-argument function paths remain unchanged. More integration tests are needed for selective execution and worker evaluation of these expressions.
