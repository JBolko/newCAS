# P0021 Slice 95b — isolated selected-IR UI cutover pilot

**Status:** GREEN candidate; Node 24 and actual browser/Pyodide acceptance outstanding.
**Checkpoint:** S94 `296fbbe`; S95a bounded route audit GREEN on user machine.

## Purpose

Map an actual human-controlled input event (draft → explicit source commit → selected evaluation → display) through the existing semantic and transport stack. This is intentionally a **browser test page only** under `tests/browser/`. The production UI remains `src/js/main.js` with legacy `CASEngine`; student shipping remains blocked.

## Ownership and controls

1. Three text inputs are **draft buffers**. No mutation of authoritative source occurs while merely typing. Clicking *Beregn dokumentet* explicitly commits changed strings by `DocumentRuntime.setBlockSource`.
2. The host advances its evaluation revision before committing source changes. DocumentRuntime owns source, block identities, calculations, dirty propagation and stale-result checks. There is no second document store, semantic scheduler, caching registry or evaluator.
3. The existing `createSupervisedSemanticTaskSession` is the ONLY path for selected calculations. It reuses `createRuntimeFunctionBatchEvaluator`, source parser, OperationSpecs and real `selected-pyodide-worker.js`. It does **not** call the legacy engine.
4. The `DocumentRuntime` constructor still requires an engine-shaped parameter for legacy compatibility; the pilot gives it a fail-closed sentinel that throws if any legacy delegation occurs. Removing that constructor dependency is a *later* migration step, not silently changed here.
5. Supervision owns Worker lifecycle. Explicit restart does not automatically replay calculations. Revisions and document commits remain caller-/DocumentRuntime-owned.
6. DOM output uses `textContent` only; this is not the P0031 production renderer or localized error presentation. The page deliberately shows selected capability/diagnostic status, not complete newCAS UI parity.

## Browser acceptance (real Pyodide)

Run `python -m http.server 8000` from repo root and open:

`http://localhost:8000/tests/browser/p0021-slice-95b-selected-ui-pilot.html`

Click **Kør S95b-browseraccept**. Required assertions:

- Explicitly committed `a:=2; f(t):=t^2+a; f(3)` gives 11 using selected IR and actual Pyodide.
- Draft edit `a:=5` does not change DocumentRuntime source until explicit calculation.
- A new click commits the source, rebinds/downstream-invalidates, gives 14 using the same selected architecture.
- Explicit Worker restart does not mutate block generation; a later run preserves the valid 14 result.

Do NOT describe static Node tests as real-browser verification. Cached HTTP/PWA assets can interfere with manual browser runs; investigate any inconsistent result before claiming PASS.

## Explicitly not completed

- Production `index.html` / `main.js` cutover; E1/P0026 EditingSession and production presentation.
- General operation/capability parity with legacy, durable diagnostics/i18n or release safety.
- Backend Worker's restart and resource pressure across every real symbolic operation.
- Normative P0021–P0025 exit audit and all 53+ frozen stress tests in production UI.
- No changes to frozen architecture, no permissive fallbacks, no deletion of legacy.

## Next migration checks

A measured cutover will require real `index.html` event/DOM analysis, explicit EditingSession ownership, Value/Diagnostic rendering, task/block identity and source revision handling; avoid porting legacy semantics into the new runtime. Migrate only approved supported capabilities and retain a visible unsupported diagnostic otherwise.

## 95b browser pilot correction (2026-10-18)

The first real-browser run failed with `EVALUATOR_ERROR` on `f(3)` while
`a:=2` and `f(t):=t^2+a` succeeded. The browser pilot mistakenly minted
`pilot.scalar.add/multiply/power` evaluator capabilities, but the existing
Pyodide Worker explicitly authorizes `probe.scalar.add/multiply/power`.
The Worker correctly rejected the unrecognized IDs. The repair changes
**only the pilot's OperationSpec evaluator IDs**; it does not broaden the
Worker allowlist, add a fallback, alter mathematics, or change production UI.
A Node contract test now compares all three pilot IDs to the actual Worker
allowlist. Browser acceptance remains required after applying this correction.
