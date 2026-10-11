# P0012 Slice 17 — equality solving (bounded GREEN)

**Scope:** selected `solve(equation, symbol)` for **finite real solution sets** and the empty set. This release intentionally chooses the **real domain provisionally for this handler**; it does **not** set a system-wide CAS default, does **not** implement domain selection, and does **not** claim complex solutions are absent.

- Input: public `RelationValue` with `operator: "eq"` and two `ExpressionValue` operands, plus a `symbolRef` target Value with symbolic role.
- One disposable P0011 `SympyValueAdapter` is used for both sides, target and finite solution elements. RelationValue/SetValue conversion is deliberately managed at the selected-operation boundary; P0011's **general** transport contract is unchanged.
- Kernel: `sympy.solveset(lhs-rhs, target, domain=sympy.S.Reals)`.
- Output: public `SetValue` (`setKind: "finite"` with public Values, or `setKind: "empty"`). Stable sorting is used for output serialization.
- If SymPy yields the full real line, an interval, ImageSet, ConditionSet, or another set kind **not representable by the current public v1 shape**, return `unsupported-operation`, not an invalid finite SetValue. This is a **known limitation**, not a claim that the equation has no solutions.
- Target identity comes from SemanticIdentity via the adapter mapping; never recover it by display-name matching.
- Selected OperationSpec expects roles `value, symbolic`; no public operationId string dispatch.
- P0009 diagnostics for incorrect arity and operand forms; internal integration errors remain ValueError.
- This slice does not support inequalities, multiple variables, conditional sets, parameter constraints, arbitrary domains, or general relation/set adapters.

**Verification:** Six Slice 17 RED tests pass; reconstructed full P0012 suite 119/119 locally. User checkout, P0011 full and Node tests require confirmation.

From repository root:

```powershell
Expand-Archive -LiteralPath ".\P0012-slice-17-solve-GREEN.zip" -DestinationPath "." -Force
node --test
python -m unittest discover -s tests/python -p "test_p0012_*.py" -q
python -m unittest discover -s tests/python -p "test_p0011_*.py" -q
```

**Next pressure:** document an explicit solution domain and add representable results for equations true for all real values (`Reals`) and potentially conditional/interval solution sets. Do not silently add `sp.S.Reals` as a public Value unsupported by P0005. Later add complex-domain support and parameterized equations.
