# S100f — korrigeret eksakt stikprøvespredning

22. oktober 2026. GREEN inden for den godkendte slice; separat afslutningsrapport. Basis `69c2038840df5a924243ba3b666f29a6103b38f0` på `architecture-v1-implementation`, oven på ucommittet S100e.

## Betingelsen for automatisk fortsættelse

S100e blev før F-kode verificeret med 98 fokuserede Node PASS, 17 fokuserede Python PASS, 1710 JS/281 Python PASS i fuld suite og fire rigtige browsergrupper. Kvadratrodsgaten var afklaret med eksisterende adapter/Value/P0010 og en rigtig Worker før matematikimplementering. Ingen ny kontraktbeslutning var nødvendig; F blev derfor udført efter brugerens betingede autorisation.

## Eksakt matematisk kontrakt

- Separate pure operationer `sample_variance(data)` og `sample_standard_deviation(data)`; evaluator-id'er `probe.statistics.sample_variance` og `probe.statistics.sample_standard_deviation`.
- Ét `data:value`-argument, tom instruction/options, ingen skjult dokumentindstilling eller offentligt correction-argument.
- Samme integer/rational-ListValue-domæne som S100e, men **mindst to observationer**.
- Samme fælles Python/SymPy-validering, middelværdi og sum af kvadrerede afvigelser. Kun sample-wrapperne vælger privat correction=1 og divisor **n−1**. Population-wrapperne beholder correction=0 og divisor n.
- Eksakt ikke-negativ kvadratrod gennem eksisterende SymPy-adapter til ExpressionValue. Ingen floatkonvertering, ny Value-kind, JS-statistikberegning, scope eller parallel evaluator.

Tom/singleton/ugyldig sample-liste giver eksisterende `type-mismatch` med `{operationId, argument:"data", expectedKinds:["list-of-at-least-two-exact-rational-expressions"], actualKind:"list"}`. Vector giver expectedKinds `["list"]`, actualKind `"vector"`. Forkert aritet/capability følger de eksisterende koder. Singleton afvises før division; der genereres ikke NaN, infinity eller et opdigtet nul. Den tilsvarende populationsvarians/std for singleton er fortsat 0.

## Filer og RED → GREEN

F udvider alene `list_statistics.py` med correction/minimum og to eksplicitte wrappers samt selected-katalog/Worker-dispatch. Alle andre fælles E-egenskaber er genbrugt. Nye F-filer:

- `tests/python/test_p0017_sample_statistics.py`
- `tests/js/p0021-slice-100f-sample-statistics.test.mjs`
- `tests/helpers/s100f-sample-statistics-cases.mjs`
- `tests/browser/p0021-slice-100f-sample-statistics.html` og `.mjs`
- Denne rapport.

RED: 0 PASS / 1 FAIL i ny Node-test (sample_variance manglede); Python discovery havde én importfejl for de manglende sample-funktioner. Efter implementering: 1 sample-Node-test PASS og 6 sample-Python-tests PASS; populationens 8 Python-tests forblev GREEN.

Slutkontrollen tilføjede også en afgrænset fælles diagnosebevarelse i `evaluate-nested-selected-calls.js`, via P0009 og den eksisterende dokument-dispatch. Se S100e-rapportens sidste afsnit for dens separate RED-test og korrelations-/versionskontrol. Dette lukker source→DocumentRuntime-fakta for singleton-sampleafvisning; ingen ny diagnosemekanisme eller normativ kontrakt. Begge slices blev derefter genverificeret.

## Faktiske testresultater

Node v24.11.0, Python 3.12.4; de sidste produktionsændringer er dækket af nedenstående checks.

| Check | Resultat |
| --- | --- |
| Egne sample Python-tests | 6 PASS / 0 FAIL / 0 SKIP |
| Population Python-regression | 8 PASS / 0 FAIL / 0 SKIP |
| Sample/E/S94d målrettet diagnosecheck | 23 PASS / 0 FAIL / 0 TODO / 0 SKIP |
| Samlet fokuseret Node-regression, 11 filer | 119 PASS / 0 FAIL / 0 TODO / 0 SKIP / 0 cancelled |
| Endelig `npm test` | 1712 JS PASS / 0 FAIL / 7 TODO / 1 SKIP / 0 cancelled, 1720 tests; 287 Python PASS / 0 FAIL / 0 SKIP; exit 0 |
| Parser-sync `--check` | PASS, parser/grammar uændret i E/F |
| Egne rigtige browsergrupper | 4 PASS / 0 FAIL / 0 TODO / 0 SKIP, 37 Worker-requests |
| Population i samme F-browserkørsel | 4 PASS / 0 FAIL / 0 TODO / 0 SKIP, 40 Worker-requests |

F-browseren har således otte faktisk kørte grupper og 77 requests. E's særskilte sidste browserkørsel har fire grupper og 40 fixture-requests plus root-control. Populationerne overlapper og skal ikke summeres som unikke testcases.

Chrome 155.0.8059.85 og ChromeDriver 155.0.8059.84; eksisterende produktions-Worker, Pyodide-URL v314.0.7 og loadPackage('sympy'). In-memory Selenium-testflags `--no-sandbox`/`--disable-dev-shm-usage` og temp-cache som dokumenteret i S100b; ingen ændring af runner, browser-sikkerhed i produktionskode eller lokal chromedriver-mappe. Backendversionsnumre blev ikke særskilt udlæst.

Browseren verificerede alle brugerens referenceværdier, store heltal, kilde-/providerredigering, invalidering og eksakt genberegning, uændrede tidligere input-Values, singleton-afvisning uden gammel resultatrest samt fulde P0009-fakta i DocumentRuntime. Derudover direkte Worker-diagnoser for tom/singleton/vector/nested/approx-inputs. Python beviser også konstant datasæt → 0, gentagelser, negative værdier, eksakt ikke-negativ rod, ingen SymPy Float, ingen inputmutation og afvisning af et forsøgt offentligt correction-option.

Reproducerbare kommandoer:

```powershell
python -m unittest discover -s tests/python -p test_p0017_sample_statistics.py
python -m unittest discover -s tests/python -p test_p0017_population_statistics.py
node --test --test-reporter=tap tests/js/p0021-slice-100f-sample-statistics.test.mjs tests/js/p0021-slice-100e-statistics.test.mjs tests/js/p0021-slice-94d-worker-diagnostic-bridge.test.mjs tests/js/p0021-slice-100b-mean.test.mjs tests/js/p0021-slice-100c-source-lists.test.mjs tests/js/p0021-slice-100d-numeric-source.test.mjs tests/js/p0021-selected-pyodide-runtime.test.mjs tests/js/p0021-selected-angle-unit.test.mjs tests/js/selected-operation-catalog.test.mjs tests/js/value-contract.test.mjs tests/js/evaluation-contract.test.mjs
npm test
node tools/build/generate_canonical_parser.mjs --check
```

Browser: S100b-rapportens in-memory runner, `--page tests/browser/p0021-slice-100f-sample-statistics.html --result-variable s100fResult`. Siden kører selv population-regressionen først.

## Afgrænsning og gates

Ingen åben matematisk, kvadratrods-, Value-, transport- eller diagnosegate for E/F's præcise domæne. De syv eksisterende TODO og ene Windows-symlink-SKIP er bevaret uændret; dette er ikke en separat statusbeslutning om dem. Approx/algebraiske input, statistik med vægte/hyppigheder, UI, offline cold-start og den fulde normativmatrix er fortsat uden for accepten. Ingen ændring af notation, StatisticsValue, grafik, Excel, FROZEN eller accepterede ADR'er.

Ingen staging, commit, push, reset eller clean udført af agenten. A–D-checkpointet og dets allowlist er dokumenteret i E-rapporten. Endelig Git-diff er oven på `69c2038`; nye filer indgår ikke i almindelig diff-statistik. De to lokale udviklerartefakter er bevaret.

Afsluttende kontrol: HEAD fortsat `69c2038`, cached diff tom, `git diff --check` exit 0. Tracked diff: **9 filer, 42 insertions / 76 deletions**. Derudover **14 nye opgavestier** (inklusive rapporter, tests, fælles statistikmodul og checkpoint-manifest); de to eksisterende lokale artefakter er særskilt untracked og urørte. Alle 38 snapshot-filers SHA-256 matcher stadig manifestet, og A–D-commit-filsettet er præcis lig manifestets allowlist.
