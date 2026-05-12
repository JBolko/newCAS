from core.context import build_base_context
from output.errors import make_error, classify_error
from output.result import wrap_result
from units.convert import convert_to_unit
from core.executor import run_in_task
import sympy as sp

# Test af fase 1
ctx, forbidden = build_base_context()
print(f"Context størrelse: {len(ctx)}")
print(f"Forbudte symboler: {len(forbidden)}")
print(f"limit callable: {callable(ctx['limit'])}")
print(f"arclength callable: {callable(ctx['arclength'])}")

# Test af fase 2
# 1. Test wrap_result med scalar, list, complex & error
print(wrap_result(42))
print(wrap_result([sp.Symbol('x'), sp.Symbol('x')]))
print(wrap_result(sp.sqrt(-4)))
print(make_error(ZeroDivisionError("test")))

# 2. Test convert_to_unit
expr = sp.physics.units.kilogram
res = convert_to_unit(expr, "gram")
print("convert:", res)

# Test af fase 3
# 1. Tilordning (skal returnere success)
print("1:", run_in_task("t1", "x = 5\ny = 10"))

# 2. Udtryk med auto-symboler
print("2:", run_in_task("t1", "x + y"))

# 3. CAS-funktion fra registret
print("3:", run_in_task("t1", "mean([1, 2, 3, 4, 5])"))

# 4. Fejlhåndtering
print("4:", run_in_task("t1", "1 / 0"))

