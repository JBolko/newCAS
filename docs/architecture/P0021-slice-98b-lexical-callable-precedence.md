# S98b / Claude F4 — leksikal binder-prioritet i callable-positioner

Informativ implementerings- og verifikationsrapport, 21. oktober 2026.
Baseline: `390e2e96ff840130435e00ff2d0b40d6bfc706f3`, branch
`architecture-v1-implementation`. GREEN; afventer review, intet staged/committed.

## Kontrakt og faktisk årsag

FROZEN v1.0 §9 kræver leksikal binder før positionel dokument-writer.
§10 bevarer immutable captures og writer-etablering uafhængigt af evalueringssucces.
Review Resolution §2.1 fastholder writer efter unsupported/unresolved RHS og
forbyder success-dependent fallback. Disse kontrakter er ikke ændret.

Claudes reproduktion blev permanent og faktisk RED før produktionsændringer:

```text
f(x) := x^2
g(f) := f(3)
A := g(100)
```

Den gamle rute beregnede faktisk A=9. `deriveBlockSourceBindings` filtrerede
lokale variable-reads, men gemte alle FunctionCall/Derivative-callees som eksterne
navne. `classifyBlockCallTargets` valgte derfor dokumentets f og etablerede en
falsk dependency-edge. Funktionsgatewayen fangede dette f som FunctionValue.
Source-compileren valgte også OperationSpec eller eksplicit dokument-provider
uden først at kontrollere sin eksisterende LexicalIdentityScope.

Uden et tidligere dokument-f blev samme lokale callee blot unresolved. Dermed
afhang både binding og matematisk udfald af en uvedkommende dokument-writer.

## Mindste rettelse ved de eksisterende semantiske grænser

Bindingsvandringen kontrollerer nu sit eksisterende bound-set også for callable-
navne. Lokale callees gemmes separat i det valgfrie, frosne derived felt
lexicalCallTargets. Eksterne callees forbliver i callTargets. Argumenter besøges
fortsat: et reelt y-read i g(f):=f(y) skjules ikke. En lokal callee med samme navn
som en katalogoperation får ikke operationens symbolske argumentroller.

Klassifikationen producerer lokale facts med classification/candidates
lexical-binder og providerId null. En lokal og en ekstern forekomst af samme
navn kan begge bevares, eksempelvis integrate(f(3),f)+f(2); det eksterne f(2)
beholder sin reelle dokumentafhængighed. Dette er derived source-metadata,
ikke en ny IR-node, Value-type, autoritativ tilstand eller resolver-registry.

Begge eksisterende expression-compilere kontrollerer den aktuelle leksikale
identitet før dokument- eller operationsvalg. Attested-compileren afviser også
lokale callable-facts og forsvarer scope-prioriteten, selv hvis en ældre caller
leverer en fejlagtig dokument-callee-attestation. Funktionsgatewayen afviser
lokale callees før materialisering/capture af et dokument-f.

Den fælles strukturelle traversal har en valgfri derivative-callback, så
source-compileren kan diagnosticere lokale f'(3) og f''(3). Uden callback er
den tidligere unsupported-adfærd uændret. Ingen derivative-kapabilitet er åbnet.

Den lille fælles rejectLexicalCallable-helper kaster en typed fejl med eksisterende
P0009 Diagnostic, som den eksisterende dispatcher/outcome-gate publicerer:

```js
diagnostic('unsupported-operation', {operationId:'lexical-call', name:'f'})
```

Der er ingen ny diagnosekode eller UI-oversættelse. OperationId/parametre er
stabile, sproguafhængige data. En lokal callee omfortolkes hverken til dokument-f,
builtin eller implicit multiplikation. Writer g etableres stadig strukturelt;
dens manglende Value blokerer forbrugerne med UPSTREAM_FAILED uden fallback.

## RED → YELLOW → GREEN, faktisk evidens

| Kontrol | Total | PASS | FAIL | TODO | SKIP |
| --- | ---: | ---: | ---: | ---: | ---: |
| Oprindelig RED før produktionsændringer | 28 | 2 | 26 | 0 | 0 |
| YELLOW efter binding/klassifikation, før compiler/diagnose | 28 | 10 | 18 | 0 | 0 |
| Første GREEN efter testkatalog-korrektion | 28 | 28 | 0 | 0 | 0 |
| Endelig suite mod S98a-baseline via isoleret loader | 31 | 3 | 28 | 0 | 0 |
| Endelig målrettet suite mod rettelsen | 31 | 31 | 0 | 0 | 0 |
| Relevante P0019/P0020/P0021-regressioner | 347 | 347 | 0 | 0 | 0 |
| Fuld Node 24.22.0, standard discovery | 1576 | 1568 | 0 | 7 | 1 |
| Python 3.13.16 / SymPy 1.14.0 | 264 | 264 | 0 | 0 | 0 |
| Reel browser, endelig scenariegruppe-kørsel | 20 | 20 | 0 | 0 | 0 |

Ingen cancellations. Parser-sync --check og whitespace-check PASS.
De arvede syv TODO og Windows-symlink SKIP tæller ikke som PASS/acceptance.
Baseline-loaderens 28 FAIL er tilsigtet historisk RED, ikke fejl i rettelsen.

Den oprindelige præcise Claude-test viste actual: '9' i red.tap. Tre supplerende
probes blev under YELLOW korrigeret til det faktisk katalogførte integrate frem
for diff/sin, så operationens binder-/kollisionspolitik testes på et gyldigt
kataloggrundlag. Deres endelige RED er genverificeret mod baseline. De to ekstra
compilerkontroller og en positiv implicit-multiplikationskontrol udvidede til 31.

RED-genafprøvningen bruger seks uændrede source-filer læst fra baseline-commit
via git show i en test-only ESM-loader under tools/reports/s98b/. Importernes
oprindelige URL'er bevares; ingen worktree-kilde erstattes. Ingen reset, checkout,
alternativ produktionspipeline eller ny evaluator er indført. De oprindelige
RED/YELLOW-logs og baseline-sources er bevaret som ignorerede reviewartefakter.

De permanente tests dækker alle ni ønskede kontrolpunkter: tidligere/ingen
dokumentfunktion, f(3), f'(3), f''(3), ingen falsk edge, uafhængighed af senere
f-edits, strukturel writer uden Value og ingen fallback til tidligere succesfuld g.
Derudover testes OperationSpec-skygning, bevarede argument-reads, blandede lokale/
eksterne forekomster og low-level compilerforsvar. Almindelig g(x):=x^2+1 giver 10;
legitim dokumentkomposition med capture giver 7. g(f):=f (3) med argument 100
forbliver multiplikation og giver 300; PEG og parser er uændrede.

## Reel Chrome/Pyodide/SymPy

Chrome 156.0.8078.48, ChromeDriver 156.0.8078.47, eksisterende Selenium 4.51.0.
Driveren håndteres af Selenium Manager i ignoreret cache. Ingen installation.
Production selected-pyodide-worker.js er uændret; den konfigurerede Pyodide
314.0.7-CDN og rigtig SymPy anvendes. Ingen matematiske browserresultater syntetiseres.

| Side / scenariegrupper | PASS |
| --- | ---: |
| Ny S98b (også første separat kørsel: 5 PASS) | 5 |
| S98a total source-analyse | 5 |
| S83 attested IR, komposition og task-isolation | 1 |
| Function derivative | 1 |
| Derived FunctionValue | 1 |
| Symbolic diff | 1 |
| Async captures/generations | 1 |
| S97c inkl. c.4 | 5 |

Antallet er runnerens grupper/knapforløb, ikke antallet af interne assertions.
S98b viser konkret lokal unsupported-operation for g(f):=f(3), aldrig A=9.
En ældre succesfuld g findes bevidst i dokumentet og må heller ikke give A=101.
Uden dokument-f fås den identiske diagnose. Første og anden prime-syntaks har
samme lokale prioritet i begge isolerede tasks. Positive kontrolblokke tvinger
reel Worker-evaluering i begge tasks og giver 5, 10, 7 og eksplicit dokument-f(3)=9.
Efter ændring af dokument-f beregnes kun legitime kald til 103/104; leksikal g
bliver ikke dirty af f-ændringen og forbliver uden Value. Den anden task er urørt.
Regressionsbrowserne bekræfter blandt andet faktiske derivativværdier 4/7/436 og
captures A=13/B=103, derefter A=23 uden publicering af et forsinket gammelt resultat.

## Præcise permanente paths og diff

Seks eksisterende produktionsfiler ændres (samlet +40/-11 i Git-diffen):

- src/js/semantics/derive-block-source-bindings.js — adskilte lokale/externe callees.
- src/js/semantics/classify-call-targets.js — lokal klassifikation uden provider.
- src/js/semantics/compile-selected-source-ast.js — scope før operation/provider.
- src/js/semantics/compile-attested-document-expression-ir.js — facts/scope-forsvar.
- src/js/semantics/create-source-function-definition-task-evaluator.js — lokal diagnose.
- src/js/semantics/lower-source-expression-tree.js — valgfri derivative-callback.

Fem nye permanente filer:

- src/js/semantics/reject-lexical-callable.js — fælles P0009-fejlhelper.
- tests/js/p0021-slice-98b-lexical-callable-precedence.test.mjs — 31 tests.
- tests/browser/p0021-slice-98b-lexical-callable-precedence.html — testside.
- tests/browser/p0021-slice-98b-lexical-callable-precedence.mjs — faktisk acceptance.
- docs/architecture/P0021-slice-98b-lexical-callable-precedence.md — denne rapport.

Komplet Git-genereret tracked/no-index-diff inklusive de fem nye filer eksporteres
til tools/reports/s98b/s98b-complete.diff uden staging. Logs, summary og filhashes
ligger samme sted. Disse reviewartefakter er ignorerede og ikke releaseindhold.

## Kommandoer og afgrænsning

```text
node --test --test-reporter=tap tests/js/p0021-slice-98b-lexical-callable-precedence.test.mjs
node --test --test-reporter=tap
.venv/Scripts/python.exe -B -m unittest discover -s tests/python -p test_*.py
node tools/build/generate_canonical_parser.mjs --check
.venv/Scripts/python.exe -B tools/dev/run-s96b2-browser.py --page tests/browser/p0021-slice-98b-lexical-callable-precedence.html --result-variable s98bResult
git diff --check
```

Ingen uafklaret normativ beslutning er fundet. Slicen beslutter ikke, at en lokal
parameter aldrig kan være en FunctionValue; den afviser alene endnu ikke
understøttet lexical application i den valgte Release-1-rute, som godkendt.
Ingen generel higher-order application, implicit multiplikationsændring, ny
resolver/evaluator, alternativ dokumenttilstand eller backend-fallback er tilføjet.

F1b, F2, F3, F5 og øvrige reviewfund er ikke forsøgt lukket. FROZEN, accepterede
ADR'er, roadmap, PEG/parser og Worker/Python-kode er uændrede. Browserkørslerne er
headless og netværksbaserede; offline cold-start, andre browsermotorer og fuld
elev-UI/dansk diagnoselokalisering er ikke accepttestet.

Ingen staging, commit, push, reset, clean, flytning eller oprydning er udført.
Eksisterende chromedriver/, se-metadata.json, caches og tidligere reviewmateriale
er bevaret. Stop ved GREEN og afvent review.
