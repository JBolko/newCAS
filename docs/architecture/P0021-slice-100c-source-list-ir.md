# S100c — kildelister gennem selected Semantic IR

22. oktober 2026. GREEN for den beskrevne slice; informativ rapport, ingen ny normativ kontrakt.
Branch `architecture-v1-implementation`, HEAD `5455a06`. S100a/S100b og alle eksisterende ændringer er bevaret, intet staged/committed.

## Afgrænset konstruktionskontrakt

Eksisterende PEG `{…}` er testnotation i denne slice, ikke en beslutning om fremtidig elevnotation. FROZEN §15 tillader fortsat grammatisk stavemådevalg og kræver eksplicit List/Vector-adskillelse. P0007 afsnittet Canonical calls tillader containerkonstruktion gennem almindelig `call(operationReference(...), args)`; P0008 understøtter variadic `value`-argumenter. P0005 ListValue indeholder ordnede immutable Values. Ingen ny node, Value-kind, scope-regel eller ændring af FROZEN/ADR er nødvendig.

- `List` AST → almindeligt operation-reference-kald `list`; elementerne gennemløber samme compiler/resolver som øvrige udtryk.
- Selected konstruktør: operation-id `list`, evaluator-id `probe.container.list`, pure, `item:value` variadic (0 eller flere), tom instruction/options. Ingen talfortolkning, sortering, konvertering eller navneopslag i konstruktøren.
- Alle elementudtryk evalueres gennem eksisterende selected-operationer. Konstruktøren pakker deres materialiserede Values i en ListValue via den samme Worker-gateway. Den er en handler i eksisterende dispatch, ikke en parallel evaluator.
- Eksisterende attesterede provider-reference-identiteter beholdes, også når samme provider forekommer flere gange. Literalens konstruktion udfører ikke lookup af et dokumentnavn `list`; et eksplicit funktionskald følger fortsat eksisterende call-classification.
- Mean-kontrakten fra S100b er uændret og accepterer stadig kun integer-node-elementer. ListValue-konstruktion i sig selv begrænser ikke Value-familien; representability er ikke operability (FROZEN §14.1).
- Vector AST er fortsat unsupported i denne compiler; den bliver aldrig konverteret til liste. Tom liste kan konstrueres, men mean afviser den som hidtil.

## Produktionsændringer oven på S100b

- `lower-source-expression-tree.js`: eksplicit liste-callback; traversalen løser stadig ikke navne eller vælger operationer.
- `compile-selected-source-ast.js` og `compile-attested-document-expression-ir.js`: liste-lowering til standard Call; sidstnævnte bruger eksisterende arity-planlægning og kræver kun symbolsk identitetssupplier for faktiske symbolske roller. Almindelig mean/list kræver ingen symbolsk scope.
- `create-runtime-function-batch-evaluator.js`: også en selvstændig List-expression føres ind i den eksisterende attesterede route.
- Selected-katalog og Pyodide-runtime: eksplicit list-spec/modul/import/dispatch.
- Ny `src/python/evaluator/container_list.py`: ren konstruktør over allerede materialiserede Values; gateway kloner transport, og eksisterende Value-decoder validerer/rehydrerer resultatet.
- To eksisterende modulliste-tests og evaluator-route-audit er udvidet med den præcise nye fil/AST-familie; gamle kontroller er bevaret.

Permanente tests: `tests/js/p0021-slice-100c-source-lists.test.mjs`, delt scenariefamilie `tests/helpers/s100c-source-list-cases.mjs`, browserfixture `tests/browser/p0021-slice-100c-source-lists.html` / `.mjs`. Ingen ændring af grammar/parser, Value-adapter, DocumentRuntime eller legacy.

## RED, YELLOW og GREEN

RED: begge nye Node-tests fejlede før produktionsændringer: unsupported List-node og manglende source-list-resultat. YELLOW etablerede først compiler/konstruktør/value-role-ruten; den fokuserede integration og dernæst browseren demonstrerede GREEN. Fuld regression fandt en statisk route-test, der stadig forventede den gamle AST-familieliste; den er udvidet med List uden at svække route-/legacy-kontrollerne.

Faktiske checks på S100c-checkpointet, før S100d:

| Kørsel | Resultat |
| --- | --- |
| Ny fokuseret Node-fil | 2 PASS / 0 FAIL / 0 TODO / 0 SKIP |
| Fokuseret regression, otte filer | 51 PASS / 0 FAIL / 0 TODO / 0 SKIP |
| Rettet evaluator-route-audit | 4 PASS / 0 FAIL / 0 TODO / 0 SKIP |
| Fuld `npm test` | 1705 JS PASS / 0 FAIL / 7 TODO / 1 SKIP / 0 cancelled (1713 tests); 273 Python PASS / 0 FAIL / 0 SKIP; exit 0 |
| `node tools/build/generate_canonical_parser.mjs --check` | PASS, ingen regenerering |
| Rigtig browser/Worker/Pyodide/SymPy | 5 grupper PASS / 0 FAIL / 0 TODO / 0 SKIP; 20 Worker-requests |

Browseren brugte Chrome 155.0.8059.85, ChromeDriver 155.0.8059.84, produktions-Worker og låst Pyodide v314.0.7 med SymPy. Samme Selenium-runner og in-memory testflags/cache som dokumenteret i S100b, men med `--page tests/browser/p0021-slice-100c-source-lists.html --result-variable s100cResult`. Ingen runnerændring eller browserfikser i produktionskode. Desktopintegrationen bruger statisk bootstrap og reelle Python-handlers, men tælles særskilt fra browserbeviset.

De fem scenariegrupper dækker kildeeksemplet → 5; kildelisteændring → eksakt 7/3; `n:=2` / `{n,4,n}` → ordnet `[2,4,2]` og 8/3; ændret n → genberegnet 4; elementudtryk `{n+2,n*3,-n}`; efterfølgende n-omdefinition uden bagudbinding; task-isolation med en faktisk gyldig n i en anden opgave; fejlet provider uden tidligere-resultat-fallback; Vector-afvisning og tom-liste/mean-fejl.

Reproducerbare kommandoer:

```powershell
node --test tests/js/p0021-slice-100c-source-lists.test.mjs
node --test --test-reporter=tap tests/js/p0021-slice-100c-source-lists.test.mjs tests/js/p0021-slice-93a-shared-arithmetic-lowering.test.mjs tests/js/p0021-slice-93b-shared-expression-traversal.test.mjs tests/js/selected-operation-catalog.test.mjs tests/js/p0019-operation-argument-plan.test.mjs tests/js/p0021-slice-93f-symbolic-source-roles.test.mjs tests/js/p0021-selected-pyodide-runtime.test.mjs tests/js/p0021-selected-angle-unit.test.mjs
node --test tests/js/p0021-evaluator-route-audit.test.mjs
npm test
node tools/build/generate_canonical_parser.mjs --check
```

## Udeståender

S100d skal behandle literalens tabte cifre. S100e kræver en eksplicit udvidelse af mean-inputdomænet før rational-/decimaldata kan accepteres. Listefunktioners generelle FunctionValue-retur/capture, vektoroperationer, UI, offline cold-start og komplet normativ browsermatrix er ikke accepteret her. Eksisterende TODO/SKIP er bevaret.
