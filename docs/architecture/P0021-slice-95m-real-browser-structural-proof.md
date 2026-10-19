# P0021 Slice 95m — real-browser structural editing proof

**Status:** GREEN candidate; Node 24 and real Pyodide browser acceptance required.
**Prerequisite:** S95l installed and accepted.

This slice extends the **existing S95f TEST-ONLY** browser page. It imports the
S95l single-operation structural action; does not change `main.js`, `.ncas`,
DocumentRuntime, OperationSpec, SymPy, or the selected Worker implementation.
No additional evaluator, document model, router, editing layer or scheduler.

The **S95m structure acceptance button** exercises real document-order
mathematics with a live supervised Pyodide/SymPy Worker:

1. `a:=2; f(t):=t^2+a; f(3); f(4)` in **four separate formula blocks**
   yields 11 and 18. This is **not** S90 multi-statement grammar.
2. Insert a separately identified `a:=5` before the function. `f` now
   captures the nearest preceding definition and the results become 14/21.
3. Move the inserted block after both calls, **preserving block object ID**.
   Results return to 11/18 under positional provider binding.
4. An incomplete active EditingSession draft (`a:=`) refuses a structural
   delete without discarding the draft or mutating document authority.
5. Remove the inserted block and recalculate to 11/18 again.

All structural operations call S95l's prevalidated editing action, which calls
the existing authoritative DocumentRuntime API. Re-rendering DOM inputs from
the authoritative runtime in this *test page* is merely presentation; no
second source registry or CalculationState cache is created.

S95f variable-length fixture, S95g renderer and S95k Enter acceptance remain
available on the page and must still pass after installation.

**Limitations:** no Undo/Redo, grouped transaction rollback, real student UI
cutover, task transfers, persistent `.ncas` editing or multi-operation atomicity.
These remain separately governed by the frozen P0026–P0028 architecture.

Local focus: **122/122 JavaScript**; Python 264/264 on local Python.
The user's Node 24 and real Pyodide browser are the acceptance authority.
