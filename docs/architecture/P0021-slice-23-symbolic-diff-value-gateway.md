# P0021 Slice 23 — Symbolic differentiation Value gateway (GREEN)

Dato: 13. oktober 2026.

## Kontrakt og leverance

Ny afgrænset `compileSelectedSymbolicDiff(envelope, ir, spec)` omsætter en **allerede valgt**
P0008 `value,symbolic`-operation med `evaluatorId = probe.symbolic.diff` fra P0021 Semantic IR

til P0010 `inputs: Value[]`. Kildetekst parses aldrig igen, og Python tildeles ikke
et variabelnavn til opslag. Identiteter forbliver fra dokumentets IR og P0005 `symbolRef`.

- Operationens første operand materialiseres som P0005 `ExpressionValue` ud fra udtryks-IR.
- Anden operand skal være en eksplicit `semantic-reference`, der bliver til `symbolRef`.
- `value`-literals forbliver Values; providers materialiseres **kun** fra attesteret `providerId`.
- Kun allerede kendte og understøttede matematiske træformer mappes: add, multiply, power,
  sin, cos, exp og log. Ingen generel kald-dispatch eller ny registry.
- En materaliseret provider-Value omskrives ikke, heller ikke hvis den indeholder
  et symbol med samme visningsnavn som differentieringsmålet.
- Manglende/overflødige providers, forkerte roller, uvalgte operationer og ukendte
  indlejrede kald fejler lukket.
- Den eksisterende `compileSelectedValueCall` (value-only) er **ikke ændret**.
- Python-handleren `evaluate_diff_request` og `evaluate_selected_gateway` er **ikke ændret**.

## Prøvet kontrakt

`x := 17; diff(x^2,x)` kompileres med samme operation-local x i både potensens
base og differentieringsmålet. Intet opslag af `x := 17` sker under kompileringen.
En konkret P0010-request blev lokalt sendt direkte gennem den eksisterende
Python `evaluate_selected_gateway(..., evaluate_diff_request)` med SymPy 1.14:

```json
{"blockId":"b1","status":"success","value":{"valueVersion":1,"kind":"expression","data":{"expr":{"op":"mul","args":[{"op":"integer","value":"2"},{"op":"symbolRef","identity":{"identityVersion":1,"kind":"operation-local","id":"local-x","displayName":"x"}}]}}}}
```

`diff(A,x)` bevarer en allerede materialiseret A (også hvis A har et
andet x-symbol med samme visningsnavn). Hvis A er materialiseret til et tal,
vil resultatet af Python-differentieringen dermed være 0.

## RED / GREEN

Før den nye modulfil fandtes: nyt JS-testmodul **FAIL** (manglende eksport/modul).
Efter implementering: **6/6 PASS**. De øvrige lokalt rekonstruerede, kørbare
JS-tests: **474/474 PASS**, inklusive Slice 23. Python: **14/14 PASS**.
Lokalt miljø: Node 22, ikke projektets Node 24; de fem ikke-kørbare testfiler
kræver materialer, som Repomix ikke indeholder. Brugerens senest bekræftede
fulde checkout-baseline før denne slice er **616/616 JS**.

## Uafsluttede grænser

Denne slice tilbyder en separat, eksplicit compiler for symbolsk diff. Den er
**ikke** endnu koblet til `evaluateNestedSelectedCalls`, Worker-allowlist eller
browser-smoke. Den demonstrerede end-to-end-kørsel er Node-genereret payload
→ Python gateway direkte, **ikke** faktisk Pyodide Worker. Regler for
samlede kald med symbolske og numeriske mellemresultater kræver særskilt
udvidelse af evaluator-flowet. `scoped`, integraler, funktionsparametre,
DocumentRuntime-commit og browsercache-regressioner er fortsat udestående.

## Filer og kommandoer

```
src/js/semantics/compile-selected-symbolic-diff.js
tests/js/p0021-symbolic-diff-gateway.test.mjs
docs/architecture/P0021-slice-23-symbolic-diff-value-gateway.md
```

```powershell
Expand-Archive -LiteralPath '.\P0021-slice-23-symbolic-diff-value-gateway-GREEN.zip' -DestinationPath '.' -Force
node --test tests/js/p0021-symbolic-diff-gateway.test.mjs
node --test
```

Forventet antal i brugerens fulde checkout, hvis der ikke er andre ændringer:
**622 tests** (616 tidligere plus 6 nye). Dette er et **estimat**, ikke en
udført fuld checkout-test.
