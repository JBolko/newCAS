# S98a / F1a — total analyse af parsebare statement-konverteringer

Informativ implementerings- og verifikationsrapport, 21. oktober 2026.
Baseline: `c6514fba9bae3d0f76a26b8b42b4d52303de9c10`,
branch `architecture-v1-implementation`. GREEN; kildekodereview og browsergate
bestået, afventer checkpointcommit.
FROZEN, accepterede ADR'er, roadmap og parser er ikke ændret.

## Reproduktion og afgrænsning

Den kanoniske grammatik tillader `Conversion.expr` at være en Assignment,
FunctionDefinition, Equation eller Expression. F1a reproduceres med:

```text
a := 5 -> [m]
f(x) := x+1 -> [m]
a := missing+sin(q) -> [m]
f(x) := x+outside+sin(q) -> [m]
```

Bindingsvandringen kastede `unsupported AST node: Assignment` henholdsvis
`unsupported AST node: FunctionDefinition`. `setBlockSource` i en anden task
kunne derfor fejle under capture af dokumentets semantiske analyser. Den ældre
dependency-analyse udledte desuden nested writers og reads fra disse former.

Dette er ikke komplette top-level-definitioner: det yderste AST-node er
Conversion. Den eksisterende writer-etablering udleder allerede ingen writer.
Rettelsen giver dem ingen ny matematisk betydning eller evalueringskapabilitet.
Den harmoniserer bindings-/dependency-projektionerne med denne afgrænsning.

## Mindste rettelse

- `derive-block-source-bindings.js`: Conversion med indlejret Assignment eller
  FunctionDefinition bidrager ikke med partial reads eller callable targets.
  Ingen bred catch, parserheuristik eller ændring af andre node-familier.
- `dependency-analyzer.js`: samme afgrænsning for den ældre graph-projektion;
  ingen nested writes/reads, som kunne skabe utilsigtede bindings/afhængigheder.
- `create-runtime-function-batch-evaluator.js`: de to former returnerer lokal
  failure med eksisterende P0009 `diagnostic('unsupported-operation',
  {operationId:'conversion'})`. Ingen ny kode, backend, Value eller fallback.
  Den eksisterende dispatcher og runtime publicerer diagnosen på blokken.
  Det obligatoriske message-felt indeholder kun koden; lokalisering er UI-ansvar.

Kilden bevares nøjagtigt som dokumentdata. `parseError` forbliver null: en
kapabilitetsfejl udgives ikke som syntaksfejl. Diagnosen skabes ved evaluering;
der introduceres ingen ny autoritativ tilstand i source-analysen. Andre tidligere
ikke-understøttede evaluatorformer beholder deres eksisterende adfærd.

Almindelige Assignment/FunctionDefinition etablerer stadig writers før evaluering.
Et reelt writer med ikke-understøttet RHS skjuler stadig en tidligere writer;
forbrugere får UPSTREAM_FAILED og bruger ikke en tidligere success. En Conversion
etablerer derimod ingen writer, uanset om der findes en tidligere success.
Almindelige Conversion(Expression/Equation/Quantity) beholder eksisterende reads,
writer-fravær og evaluatoradfærd; ingen ny konverteringsevaluering er aktiveret.

## Permanente tests og faktisk evidens

Fil: `tests/js/p0021-slice-98a-total-source-analysis.test.mjs`.

| Trin/kontrol | Total | PASS | FAIL | TODO | SKIP |
| --- | ---: | ---: | ---: | ---: | ---: |
| Oprindelig RED, før produktionsændringer | 33 | 19 | 14 | 0 | 0 |
| YELLOW, analyse-/dependency-rettelse uden diagnose | 33 | 27 | 6 | 0 | 0 |
| Første GREEN | 33 | 33 | 0 | 0 | 0 |
| Endelige målrettede tests, tre ekstra kontroller | 36 | 36 | 0 | 0 | 0 |
| Semantik/runtime/S9x-regressioner | 801 | 800 | 0 | 1 | 0 |
| Fuld Node 24.22.0 | 1545 | 1537 | 0 | 7 | 1 |
| Fuld Python 3.13.16 / SymPy 1.14.0 | 264 | 264 | 0 | 0 | 0 |

Ingen cancellations. Parser-sync `--check` og tracked whitespace-check PASS.
De syv TODO og Windows-symlink SKIP er arvede og tæller ikke som acceptance.
De tre ekstra kontroller viser backend-fravær for begge indlejrede statement-typer
og bevaret binding til en tidligere rigtig callable writer.

AST-matricen dækker Assignment, FunctionDefinition, Equation, BinaryExpression,
UnaryExpression, PowerExpression, FunctionCall, Derivative, Variable, Literal,
Quantity, List, Vector, Access samt Conversion af Expression, Equation og Quantity.
De fire F1a-kilder kontrolleres særskilt for nøjagtig AST-form, ingen utilsigtede
writers/reads/calls, source-bevaring og lokal struktureret failure efterfulgt af
gyldige blokkes faktiske evaluering gennem den eksisterende batch/IR-rute.

Task-testen evaluerer og redigerer B mens A indeholder F1a, redigerer dernæst A
og kontrollerer B's source-identitet og beregningsresultat. Rekonstruktion kopierer
kun id/type/source/taskId via JSON-data og offentlige addBlock/setBlockSource-API'er
til en ny runtime; ingen calculation-state, dokumentmodel eller persistence bygges.
Almindelige funktioners lokale parametre og funktionsanvendelse er også dækket.

Kørte kommandoer:

```text
node --test --test-reporter=tap tests/js/p0021-slice-98a-total-source-analysis.test.mjs
node --test --test-reporter=tap tests/js/p0020-*.test.mjs tests/js/p0021-runtime-*.test.mjs tests/js/p0021-slice-9*.test.mjs tests/js/test-dependency-analyzer.mjs tests/js/test-document-dependency-graph.mjs tests/js/test-document-runtime.mjs
node --test --test-reporter=tap
.venv/Scripts/python.exe -B -m unittest discover -s tests/python -p test_*.py
node tools/build/generate_canonical_parser.mjs --check
git diff --check
```

Python kørte uden sandbox-begrænsningen med PYTHONDONTWRITEBYTECODE=1. Node-tests
anvender en eksplicit add-backend til de gyldige kontrolblokke, ikke real SymPy.

## Åbne gates og uændret scope

Den oprindeligt åbne browsergate er nu kørt og GREEN; se evidens nedenfor.
Acceptancen er test-UI gennem eksisterende runtime/editor/Worker-kontrakter,
ikke fuld elev-UI eller dansk diagnoselokalisering. Offline cold-start og andre
browsermotorer er fortsat ikke testet.

Ingen nye normative beslutningspunkter er fundet. F1b direkte struktur-rollback,
F2 reentrancy, F3 history-recovery, F4 leksikal callable-binding og øvrig
reviewforstærkning er ikke forsøgt løst. Ingen generel editor-, legacy- eller
release-acceptance følger af denne slice.

Implementeringsforløbet ovenfor indeholdt ingen staging, commit, push, reset,
clean eller oprydning. `chromedriver/` og `se-metadata.json` er bevaret.
Efterfølgende godkendt checkpointforberedelse er beskrevet til sidst.

## Browseracceptance på arbejdscomputeren — efter fokuseret kildekodereview

Chrome 156.0.8078.48 og Selenium 4.51.0 var allerede installeret ved denne
kontrol. Ingen pip-/Chrome-installation var nødvendig. Selenium Manager valgte
ChromeDriver 156.0.8078.47 (revision 1d17a2e2ee147bb7d6ae2ab6abdb3a2510c17775).
Runnerens eksisterende SE_CACHE_PATH peger på ignoreret
tools/reports/selenium-cache/; ingen driver er kopieret manuelt til repositoryet.
Runneren rapporterer nu også ChromeDriver-versionen.

Permanent acceptance: tests/browser/p0021-slice-98a-total-source-analysis.html
og den tilhørende .mjs. Production selected-pyodide-worker.js anvendes uændret
med den konfigurerede Pyodide 314.0.7-CDN og rigtig SymPy-matematik.

| Browsergruppe | Før fixture-tilføjelse | Endelig genkørsel |
| --- | ---: | ---: |
| S96b.2 history Enter | 3 PASS | 3 PASS |
| S97a mutation/history | 4 PASS | 4 PASS |
| S97c inkl. c.4 read-only-boundary | 5 PASS | 5 PASS |
| S95f/k/m/p, fire acceptance-knapper | 4 PASS | 4 PASS |
| S83 real Pyodide, to tasks | 1 PASS | 1 PASS |
| S94b/c/e Worker supervision/recovery, tre sider | 3 PASS | 3 PASS |
| Ny S98a, første kørsel og endelig genkørsel | 5 PASS (første kørsel efter tilføjelse) | 5 PASS |

De eksisterende regressioner var 20 PASS før tilføjelsen. Endelig kørsel:
25 PASS / 0 FAIL / 0 TODO / 0 SKIP i ni browser-sider. Antal er runnerens
scenariegrupper/knapforløb, ikke antallet af interne assertions. S94b/c/e bruger
rigtige Workers med testfixtures uden Pyodide; de øvrige 22 grupper bruger den
rigtige Pyodide/SymPy-rute. Ny S98a består også separat ved første kørsel.

S98a's fem grupper efterprøver:

1. Conversion(Assignment): eksakt source/AST, ingen writer/reads/calls/dependencies,
   lokal struktureret unsupported-operation og intet backend-dispatch.
2. Conversion(FunctionDefinition): samme kontroller, samtidig med første form.
3. Efterfølgende gyldige blokke og oprindelige writers: faktiske SymPy 5/6/3.
4. DOM input/keydown gennem eksisterende EditingSession/Enter/Calculate i begge
   tasks: source-identiteter og resultater isoleres; B beregner 16/17, 17/18,
   19/20. Input-events ændrer kun kladden; Enter accepterer og beregner.
5. Source-only rekonstruktion via offentlige addBlock-API'er og nye rigtige
   Worker-sessioner: begge lokale diagnoser og faktiske resultater 6/3/20.

Test-UI viser diagnosernes strukturerede data via textContent. Der er ingen
ny evaluator, produktions-UI, lokalisering, history-owner eller persistence.
De 14 registrerede backend-kald i S98a går udelukkende til gyldige blokke.

Kør den nye acceptance:

```text
.venv/Scripts/python.exe -B tools/dev/run-s96b2-browser.py --page tests/browser/p0021-slice-98a-total-source-analysis.html --result-variable s98aResult
```

Efter browsertilføjelsen er Python igen 264 PASS, parser-sync PASS, og alle 165
projekt-Node-testfiler samlet 1537 PASS / 0 FAIL / 7 TODO / 1 SKIP (1545 tests).
En almindelig node --test fandt desuden den udpakkede testkopi i den tidligere
reviewpakke under tools/reports/s98a-review/package/tests/ og gav en ekstra
ERR_MODULE_NOT_FOUND, fordi kopien ikke er et selvstændigt repository. Dette
er en reviewpakke/test-discovery-fejl, ikke en produktfejl. Pakken er bevaret
uden oprydning; den grønne fulde projektkørsel bruger en eksplicit filliste:

```powershell
$testPaths = @(rg --files tests -g '*.test.mjs' -g 'test-*.mjs' -g '*.test.js' -g '*.test.cjs' -g 'test-*.js' -g 'test-*.cjs')
node --test --test-reporter=tap @testPaths
```

Ingen produktionsfiler er yderligere rettet under browserarbejdet. Nye permanente
filer er kun de to S98a-browserfixtures; runneren får én versionsudskrivning,
og denne informative rapport er opdateret. Normative dokumenter er urørte.

Rå før-/efter-browserlogs, første S98a-kørsel, project-node.tap, full-node.tap
(inkl. den særskilte reviewpakke-fejl) og python.txt findes i ignoreret
tools/reports/s98a-browser/. Alle browserkørsler var headless Chrome med
netforbindelse til den konfigurerede CDN; ingen offline-acceptance påstås.

## Checkpointforberedelse — standard testdiscovery genoprettet

Efter særskilt godkendelse er kun den udpakkede reviewkopi omdøbt fra
tools/reports/s98a-review/package/tests/js/p0021-slice-98a-total-source-analysis.test.mjs
til samme path med suffikset .txt. Indholdet er byteidentisk. Den udpakkede
reviewpakkes manifest forklarer den bevidste navneforskel fra den oprindelige ZIP;
SHA256SUMS er opdateret og verificeret. ZIP'en er urørt med SHA-256
97dd10d8012d3ec512672497b18d1e330b51a8959a3389fc77bc4025fba32baf.

Standardkommandoen node --test er derefter kørt uden eksplicit filliste eller
ændret discovery: 1545 tests, 1537 PASS / 0 FAIL / 7 TODO / 1 SKIP, ingen
cancellations, exitkode 0. Tidligere workaround/fejl ovenfor er historisk evidens.
Log og checksum-verifikation findes i tools/reports/s98a-checkpoint-preparation/.
Ingen produktions-/testkode eller testkonfiguration er ændret ved denne løsning.

Checkpointstaging er særskilt godkendt og omfatter præcis otte permanente
S98a-paths: tre produktionsfiler, Node-testen, de to browserfixtures, runneren
og denne informative rapport. Eksakt allowlist og maskinel staged path-/blob-
kontrol ligger i tools/reports/s98a-checkpoint-preparation/. Reviewmateriale,
logs, caches og de to eksisterende Selenium-artifacts er udelukket. Commit
afventer særskilt godkendelse; ingen push, reset, clean eller øvrig oprydning.
