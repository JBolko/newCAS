# S100g — eksakt median, minimum og maksimum

22. oktober 2026. **GREEN** for denne slice. Informativ rapport; FROZEN, accepterede ADR'er og P0005–P0010 er uændrede.
Basis: `architecture-v1-implementation`, HEAD `bb0e05ba105519fbd6fd665dcc50daebd6adde0a`.

## Start og kontraktkontrol

Ved start var ingen tracked filer ændret. Kun `chromedriver/`, `se-metadata.json` og `tools/dev/s100ad-checkpoint-allowlist.json` var untracked. De er bevaret. S99, S100a–f-rapporterne og relevante Value/IR/OperationSpec/diagnose/transport-kontrakter er undersøgt; historiske statusfelter er ikke brugt som aktuelle testbeviser.

`median`, `min` og `max` fandtes ikke i selected-kataloget eller Worker-dispatch. De findes i legacy `src/python/cas_math/registry.py`, som ikke er brugt eller ændret. Selected-kataloget har fortsat kun én registrering pr. operation-id. Eksisterende callable-politik bevares: operation + synlig dokumentfunktion med samme navn klassificeres som `ambiguous`, og en leksikalsk callee har fortsat prioritet. En anden opgaves dokumentfunktion påvirker ikke klassifikationen. Ingen implicit prioritet eller fallback er indført.

Alle tre nye operationer er pure med én signatur `data:value`, evaluator-id `probe.statistics.<operation>`, tom instruction/options og eksisterende diagnosemønster. Input er ikke-tomme ListValues med integer/rational ExpressionValues. Decimaler følger den allerede accepterede eksakte S100d-kildeoversættelse. Output er integer eller reduceret rational ExpressionValue.

Den eksisterende Python-handler validerer og adapterer observationerne; en ny lokal liste sorteres efter SymPy-tallenes **numeriske** orden. Medianen er den centrale observation eller den eksakte sum af de to centrale divideret med 2. Minimum/maksimum er sorteringens yderpunkter. Ingen JavaScript-statistik, floats, tekst-evaluering, list/vector-konvertering eller inputmutation.

`wrong-arity`, `unsupported-operation` og `type-mismatch` genbruges. Forkert ydre kind giver `expectedKinds:["list"]`. Tom liste eller forkert elementdomæne giver `expectedKinds:["nonempty-list-of-exact-rational-expressions"]`, `actualKind:"list"`; øvrige parametre er `operationId` og `argument:"data"`. Ingen nye diagnosekoder.

## Ændrede filer

Produktionsændringer er begrænset til:

- `src/python/evaluator/list_statistics.py`: numerisk sortering, fælles medianhjælper og tre eksplicitte handlers.
- `src/js/operations/selected-operation-catalog.js`: de tre unary operationer.
- `src/js/evaluation/selected-pyodide-runtime.js`: eksplicit import, dispatch og capability-allowlist.

Nye permanente beviser:

- `tests/python/test_p0017_order_statistics.py` (7 tests).
- `tests/js/p0021-slice-100g-order-statistics.test.mjs` (2 tests).
- `tests/helpers/s100g-order-statistics-cases.mjs`.
- `tests/browser/p0021-slice-100g-order-statistics.html` og `.mjs`.
- Denne rapport. Filsettet og testtallene her beskriver det selvstændige G-checkpoint før H-implementeringen.

Ingen grammar/parser-, renderer-, dokument-, scope-, Value-schema- eller legacy-ændringer. Tilbagerulning kan begrænses til ovenstående S100g-ændringer; ingen tilbagerulning er udført.

## RED → YELLOW → GREEN

Før produktionsændringer: **2 Node FAIL / 0 PASS**, fordi operationerne ikke var registreret og derfor endnu ikke kolliderede med dokumentfunktioner. Python discovery gav én importfejl for de manglende handlers; det er ikke syv udførte matematiktests. Rigtig Chrome med produktions-Worker og indlæst Pyodide/SymPy gav **1 fejlet browserkørsel**, fordi `median` ikke producerede et resultat.

YELLOW tilføjede alene den fælles sortering/median og de eksplicitte registreringer. Derefter blev de samme tests GREEN uden ændring af deres forventninger. S100g-scenarierne omfatter de krævede referencecases, numerisk kontra leksikografisk orden (`{10,2,3}`), rationalsortering, eksakte decimaler, gentagelser, negative tal, singleton og `9007199254740993` samt større og negative store heltal. Requests og specs sammenlignes med uændrede kopier i Python.

| Faktisk kontrol på G-koden | Resultat |
| --- | --- |
| Node S100e/f/g, tre testfiler | 6 PASS, 0 FAIL/TODO/SKIP |
| Python `test_p0017_*statistics.py` | 21 PASS (8 population + 6 sample + 7 order), 0 FAIL/SKIP |
| Fuld `npm test` | 1714 JS PASS, 0 FAIL, 7 TODO, 1 SKIP, 0 cancelled; 1722 tests. 294 Python PASS, 0 FAIL/SKIP. Exit 0 |
| Rigtig browser G | 4 grupper PASS, 0 FAIL/TODO/SKIP; 81 Worker-requests |
| Rigtig browser E/F-regression i samme kørsel | 4 + 4 grupper PASS, 0 FAIL/TODO/SKIP; 40 + 37 requests |
| Parser-sync og `git diff --check` | PASS |

Browseren brugte Chrome 155.0.8059.85, ChromeDriver 155.0.8059.84, den eksisterende supervised module Worker, Pyodide v314.0.7 og SymPy. Alle **12 grupper / 158 requests** bestod. Den verificerede separate FormulaBlocks med kildelister, dokumentprovider `n`, ordnede gentagelser, frosne tidligere resultater, dirty-invalidering, korrekt genberegning, opgaveisolation, komplette P0009-fejl fra rigtig Worker og fra kilde samt nulstilling af gamle resultater ved fejl og recovery efter ny kilde.

Reproducerbare kontroller:

```powershell
node --test tests/js/p0021-slice-100g-order-statistics.test.mjs tests/js/p0021-slice-100e-statistics.test.mjs tests/js/p0021-slice-100f-sample-statistics.test.mjs
python -m unittest discover -s tests/python -p test_p0017_*statistics.py
npm test
node tools/build/generate_canonical_parser.mjs --check
git -c core.safecrlf=false diff --check
```

Browseren bruger `tools/dev/run-s96b2-browser.py` med `--page tests/browser/p0021-slice-100g-order-statistics.html --result-variable s100gResult`. Som i S100b blev runnerens tekst kørt i hukommelsen med ekstra Chrome-testflags `--no-sandbox` og `--disable-dev-shm-usage`; runnerfilen er uændret. Selenium-cache og npm-log blev lagt i Windows TEMP. Dette er netværksbaseret acceptance, ikke offline cold-start eller fuld normativ browsermatrix.

## Afslutning og gates

Ingen åben matematisk eller transportgate for S100g. De syv eksisterende TODO og ene Windows-symlink-SKIP er bevaret. Ingen staging, commit, push, reset eller clean. HEAD er fortsat `bb0e05b`; cached diff er tom. Parseren er synkron uden regenerering.

Kontrollen ved afslutning af G, før H-implementering: `git status --short` viste præcis de tre ændrede produktionsfiler ovenfor, syv nye filer (fem test-/fixturefiler og de to rapporter) og de tre oprindelige untracked artefaktstier. `git diff --stat`: **3 tracked filer, 41 insertions / 8 deletions**; nye untracked filer var ikke medregnet. `git diff --check` var tom/exit 0. Checkpointmanifestets SHA-256 var uændret fra start: `16572F49C22C9D73BB4E694A634E2666185602E0455E85BE0CAC80B559114BD6`. `chromedriver/` og `se-metadata.json` er ikke ændret af arbejdet.

S100h blev først stoppet ved den udtrykkeligt krævede beslutning om n=1; se den historiske `P0021-slice-100h-quartiles-decision-gate.md`. Brugeren godkendte derefter gentagelse af singleton-observationen. H blev implementeret og verificeret særskilt; se `P0021-slice-100h-exact-quartiles.md` for H's GREEN-beviser, G-regression på H-koden og den samlede afsluttende Git-status.
