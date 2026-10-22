# S100k — eksakte frekvensprojektioner fra diskrete hyppighedstabeller

22. oktober 2026. **GREEN.** Informativ implementerings- og acceptancerapport; ingen ændring af FROZEN eller accepterede ADR'er. Basis: `architecture-v1-implementation`, HEAD `c5fd1f78e517860dfc378e0b7bc261ea0bfecb2d` (`feat(s100g-j): exact order statistics and frequency tables`).

## Baseline og kontrakt

Ved start var ingen tracked filer ændret. Kun `chromedriver/`, `se-metadata.json`, `s100-testlog.txt` og `tools/dev/s100ad-checkpoint-allowlist.json` var untracked; de er bevaret. S99, S100g–j, relevante P0005–P0010-/FROZEN-afsnit og accepterede ADR'er er gennemgået; historiske testtal er ikke brugt som nye beviser. Den allerede committed S91a-rettelse er bevaret.

Alle fem eksisterende operationer har nu to komplette P0008-signaturer: `(data:value)` og `(values:value,counts:value)`. Public operation-/evaluator-id'er er uændrede:

- `observation_values` / `probe.statistics.observation_values`.
- `absolute_frequencies` / `probe.statistics.absolute_frequencies`.
- `relative_frequencies` / `probe.statistics.relative_frequencies`.
- `cumulative_absolute_frequencies` / `probe.statistics.cumulative_absolute_frequencies`.
- `cumulative_relative_frequencies` / `probe.statistics.cumulative_relative_frequencies`.

Alle er pure, har tom instruction/options og returnerer almindelige immutable P0005 ListValues gennem eksisterende P0010/Worker-transport. Ingen `weighted_*`-familie, ny Value-kind eller offentlig positionel tabelstruktur. JS vælger/transporterer; den eksisterende komprimerede Python/SymPy-kerne `_DiscreteObservations` beregner alt.

S100j's regler genbruges uændret: observationer er eksakte integer/rational Values; counts er eksakte ikke-negative heltal; lige længder og positiv total kræves. Numerisk ens observationer samles, og nulcounts udelades fra den effektive fordeling. Alle kildeelementer valideres også ved nulcount. Ingen ekspansion til n observationer eller lossy Number-/floatkonvertering. Originale input og tidligere resultater ændres ikke.

Reference X={5,2,3,2}, H={3,1,0,1} giver henholdsvis [2,5], [2,3], [2/5,3/5], [2,5] og [2/5,1]. Frekvenssummen er eksakt 1, sidste kumulerede count er N, og sidste kumulerede frekvens er 1.

## Minimal ændring og diagnoser

Produktionsændringer:

- `src/js/operations/selected-operation-catalog.js`: de fem eksisterende specs får den anden komplette signatur.
- `src/python/evaluator/list_statistics.py`: den tidligere særskilte unary-begrænsning for projektioner fjernes fra signaturvalideringen. Tælling, sortering, matematik, diagnoser og outputbygning er uændrede.

`tests/js/p0021-slice-100i-frequencies.test.mjs` kontrollerer fortsat den oprindelige unary signatur; den nye K-test kontrollerer hele præcise signatursættet og begge providerattestationer. Ingen assertions om rå-resultater er fjernet.

Nye K-filer: `tests/python/test_p0017_frequency_table_projections.py`, `tests/js/p0021-slice-100k-frequency-table-projections.test.mjs`, `tests/helpers/s100k-frequency-table-projection-cases.mjs`, browser `tests/browser/p0021-slice-100k-frequency-table-projections.html` / `.mjs` samt denne rapport.

Samme eksisterende diagnosekontrakt som J: `type-mismatch` med `{operationId,argument,expectedKinds,actualKind}` for `values`/`counts`/ydre kinds/total; `dimension-mismatch` med `{operationId,expectedDimension:{items:n},actualDimension:{items:m}}`. Descriptors er `list`, `nonempty-list-of-exact-rational-expressions`, `list-of-exact-nonnegative-integers` og `absolute-frequencies-with-positive-total`. To tomme lister afvises ved total=0. Forkert aritet på fulde specs giver `wrong-arity`, expected `[1,2]`. Ingen nye diagnosekoder eller sprogafhængige backendtekster.

Ingen ændring af Worker-dispatch, parser/grammatik, DocumentRuntime, IR, gateway, Value-schema, renderer, legacy, persistens eller pakning. Tilbagerulning kan begrænses til de beskrevne K-filer/ændringer; ingen rollback er udført.

## RED → YELLOW → GREEN

Før produktionsændringer: **2 Node FAIL / 0 PASS** på manglende binær signatur og generisk compile. Python kørt med fail-fast gav **1 ERROR** i første udførte test, fordi handleren afviste den nye multisignatur; det er ikke otte udførte matematiktests. YELLOW tilføjede kun signaturen og genåbnede den allerede eksisterende tabelvej. Samme forventninger blev GREEN.

| Kontrol på K-koden | Faktisk resultat |
| --- | --- |
| Fokuseret Node K/J/I/S91a, fire filer | 8 PASS, 0 FAIL/TODO/SKIP |
| Ny K-Python | 8 PASS, 0 FAIL/SKIP |
| I/J-Python-regression | 7 + 9 PASS, 0 FAIL/SKIP |
| Fuld `npm test`, `FORCE_COLOR=1` | 1720 JS PASS, 0 FAIL, 7 TODO, 1 SKIP, 0 cancelled (1728 tests); 326 Python PASS, 0 FAIL/SKIP; exit 0 |
| Rigtig browser K | 4 grupper PASS, 213 requests, 0 FAIL/TODO/SKIP |
| Rigtig browser E–J-regression | 25 grupper PASS, 948 requests, 0 FAIL/TODO/SKIP |
| Parser-sync og `git diff --check` | PASS |

Browser samlet: **29 grupper / 1161 Worker-requests**. Chrome 155.0.8059.85, ChromeDriver 155.0.8059.84, eksisterende supervised module Worker, Pyodide v314.0.7 og SymPy. Node v24.11.0 / Python 3.12.4. Testgrupper og requests er forskellige målinger.

K-browseren verificerer alle fem operationer gennem kildetekst med begge signaturer, sammenlægning af gentagelser, nulcounts, eksakte decimaler/negative rationals, numerisk sortering og singleton. Begge providers X/H og X's variabelprovider redigeres med dirty-invalidering og korrekt genberegning; opgaver er isolerede, gamle input/resultater uændrede, og nye resultater er frosne/roundtrippede ListValues. En efterfølgende `mean(relative_frequencies(X,H))` bruger almindelig Value-transport.

Store kildetal og counts testes med 9007199254740993, counts [18014398509481986,27021597764222979], frekvenser [2/5,3/5] og kumuleret total **45035996273704965**. Python kører samme store-count-scenario for alle fem operationer i en isoleret proces med **8 sekunders grænse** for at afsløre ekspansion. Kun de små test-oracles ekspanderer counts.

Komplette P0009-diagnoser verificeres gennem rigtig Worker og helt frem til DocumentRuntime for begge argumenter, dimensioner og total. Nested observationsfelt med nulcount bliver stadig afvist; tidligere resultater og downstream ryddes ved kilderedigering til ugyldige input og gendannes ved ny gyldig kilde.

```powershell
node --test tests/js/p0021-slice-100k-frequency-table-projections.test.mjs tests/js/p0021-slice-100j-frequency-statistics.test.mjs tests/js/p0021-slice-100i-frequencies.test.mjs tests/js/p0021-slice-91a-parser-packrat.test.mjs
python -m unittest discover -s tests/python -p test_p0017_frequency_table_projections.py
python -m unittest discover -s tests/python -p test_p0017_frequencies.py
python -m unittest discover -s tests/python -p test_p0017_frequency_statistics.py
npm test
node tools/build/generate_canonical_parser.mjs --check
git -c core.safecrlf=false diff --check
```

Browser: eksisterende `tools/dev/run-s96b2-browser.py` med `--page tests/browser/p0021-slice-100k-frequency-table-projections.html --result-variable s100kResult`. Runneren køres i hukommelsen med de hidtil dokumenterede headless-testflags `--no-sandbox` / `--disable-dev-shm-usage`; runnerfilen ændres ikke. Cache/npm-log ligger i TEMP. Ingen fake Worker er eneste integrationsbevis. Ingen offline-accept eller fuld historisk browsermatrix påstås.

## S100l og bevaring

S100l leveres særskilt som INFORMATIVE / PROPOSED i `P0021-slice-100l-grouped-statistics-contract-proposal.md`, inklusive den supplerende danske højrelukkede konvention. Ingen af L's datatyper, metodeforslag eller dokumentstandarder er produktionsimplementeret eller registreret som diagnoser.

Ingen staging, commit, push, reset eller clean. De syv TODO og ene Windows-symlink-SKIP er uændrede. De fire lokale artefakter er urørte. Den hidtidige særskilte UI-gate for ListValue-visning består; ingen backend-/matematikgate for K står åben.

Afsluttende `git status --short`: præcis tre modified tracked filer (de to produktionsfiler og I-katalogtesten), syv nye K/L-filer (fem tests/fixtures og to rapporter) samt de fire oprindelige untracked artefakter. `git diff --stat`: **3 filer, 7 insertions / 6 deletions**, eksklusive untracked filer. Diff-check exit 0; cached diff er tom. HEAD/branch er fortsat `c5fd1f7` / `architecture-v1-implementation`.

SHA-256 er uændret fra start: checkpointmanifest `16572F49C22C9D73BB4E694A634E2666185602E0455E85BE0CAC80B559114BD6`, `s100-testlog.txt` `8D78411222EA9D9E123FD5794DA7E8DAF8133A35A332C5F22C1A2EE2BAFCEA18`, og `se-metadata.json` `66FC5722FD4A8D98ECC160008075D530098C3C5E642C217D1AA942B13CAA6FBD`. `chromedriver/` er ikke rørt. L's åbne beslutningsgates står i det særskilte kontraktforslag; ingen L-produktionsændring er blandet ind i denne diff.
