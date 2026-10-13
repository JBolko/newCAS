# P0021 Slice 14 — Indlejrede, eksplicit valgte Value-kald

## Kontrakt

En *allerede valgt* Semantic IR-call med indlejrede value-role-calls beregnes i postorder. Hvert delkald kompileres af den **eksisterende** `compileSelectedValueCall` (Slice 9), og sendes via samme udskiftelige `evaluate`-callback som Slice 11. Resultatets offentlige Value indsættes som immutable `valueLiteral` i det omgivende kald. Ingen reparse af kildetekst, operation selection eller opslag i Python-task-scope.

- `specs: Map<operationId, OperationSpec>` skal leveres eksplicit; manglende valg fejler lukket.
- Hvert delkald får kun de *direkte anvendte* provider-attestationer. Provider-identiteter transporteres uændret.
- Fejl i et delkald stopper efterfølgende dispatch. En ugyldig `blockId` i et resultat afvises.
- Evaluering er sekventiel, ingen ekstra graf eller cache.
- Første end-to-end demonstrerede capability er `add` / `probe.scalar.add`. Multiplikation, symbolske/scoped roller og generel AST-lowering er ikke inkluderet i denne slice.
- `evaluateNestedSelectedCalls` returnerer den sidste **Value**, ikke P0021-resultatstatus. Den fremtidige DocumentRuntime-integrator ejer status og revisionscommits.

## Afprøvning

`node --test tests/js/p0021-nested-selected-calls.test.mjs`

Samlet regression: `node --test`

Browser: `python -m http.server 8000` og åbn `http://localhost:8000/tests/browser/p0021-nested-worker-smoke.html`. Kræver netforbindelse til Pyodide/SymPy; testen er **ikke** udført lokalt og skal verificeres i browseren.

Eksempel: `b := 2+(3+4)` bør producere eksakt 9; `b := 2+(a+3)` med den attesterede provider `a=5` bør producere 10.

**Ikke en integration med Peggy-parser, DocumentRuntime eller Python multiplicative handler.**
