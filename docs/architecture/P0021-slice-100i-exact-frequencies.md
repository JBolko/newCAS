# S100i — eksakte diskrete hyppigheder og frekvenser

22. oktober 2026. **GREEN før S100j påbegyndes.** Informativ rapport; FROZEN, accepterede ADR'er og P0005–P0010 er uændrede. Basis: `architecture-v1-implementation`, HEAD `bb0e05ba105519fbd6fd665dcc50daebd6adde0a`, med bevarede G/H- og S91a-ændringer i worktree.

## Kontrakt og API

S99 og rapporterne S100e–h er gennemgået sammen med relevante Value/identitet/IR/OperationSpec/diagnose/transport-kontrakter. Fem navne uden eksisterende selected-/legacy-kollisioner er valgt inden for brugerens autorisation til separate projektioner:

| Operation-id | Resultat i stigende numerisk observationsorden |
| --- | --- |
| `observation_values(data)` | Forskellige observationsværdier |
| `absolute_frequencies(data)` | Absolutte hyppigheder |
| `relative_frequencies(data)` | Eksakte relative frekvenser |
| `cumulative_absolute_frequencies(data)` | Kumulerede absolutte hyppigheder |
| `cumulative_relative_frequencies(data)` | Eksakte kumulerede frekvenser |

Hver operation er pure, har én P0008-signatur `data:value`, evaluator-id `probe.statistics.<operation>`, tom instruction/options og returnerer en almindelig immutable ListValue. Ingen offentlig positionel tabelstruktur eller ny Value-kind. Listen med observationer har samme ikke-tomme integer/rational-domæne som E/H; eksakte kilde-decimaler accepteres. Numerisk ens rationals samles, også ved forskellige oprindelige udtryk. Frekvenssum er præcis 1; sidste kumulerede frekvens er præcis 1.

En privat Python-kerne `_DiscreteObservations` samler observationerne i eksakte tællinger og ordnede tuples. Den repræsenterer faktiske diskrete observationer, ikke klassemidtpunkter/estimater. Alle beregninger sker i Python/SymPy. JS vælger, transporterer og tester; intet regnes som statistik i JS. Input ændres ikke.

## Diagnoser og filer

Eksisterende `type-mismatch` anvendes: forkert ydre kind forventer `list`; tom/nested/approx-liste forventer `nonempty-list-of-exact-rational-expressions`. Parametrene er `{operationId, argument:"data", expectedKinds, actualKind}`. `wrong-arity`/`unsupported-operation` og malformed-payload-integrationsfejl bevares. Ingen nye diagnosekoder.

Kun tre produktionsfiler ændres oven på G/H: `src/python/evaluator/list_statistics.py`, `src/js/operations/selected-operation-catalog.js` og `src/js/evaluation/selected-pyodide-runtime.js`. ListValue-resultatbygning genbruges også af H; H's matematik er uændret. Ingen parser-, DocumentRuntime-, Value-schema-, gateway-, renderer- eller legacy-ændringer.

Nye tests: `tests/python/test_p0017_frequencies.py`, `tests/js/p0021-slice-100i-frequencies.test.mjs`, `tests/helpers/s100i-frequency-cases.mjs` og browser `tests/browser/p0021-slice-100i-frequencies.html` / `.mjs`. Denne rapport er selvstændig. Før ændringer blev kopier af de tre fælles produktionsfiler bevaret i TEMP (`newcas-before-s100i-9voz1il1`); ingen rollback er udført.

## RED → YELLOW → GREEN og testbeviser

RED før produktionsændringer: 1 Node FAIL på manglende `observation_values`; Python discovery gav én importfejl for manglende handler, ikke syv udførte matematiktests. YELLOW tilføjede fælles tælling og de fem eksplicitte dispatchveje. De samme forventninger blev GREEN.

| Kontrol før J-kode | Resultat |
| --- | --- |
| Ny Node-test + G/H og S91a-regression | 7 PASS, 0 FAIL/TODO/SKIP |
| Ny Python | 7 PASS, 0 FAIL/SKIP |
| Python E/F/G/H-regression | 29 PASS, 0 FAIL/SKIP |
| Fuld npm med `FORCE_COLOR=1` | 1716 JS PASS, 0 FAIL, 7 TODO, 1 SKIP, 0 cancelled (1724 tests); 309 Python PASS, 0 FAIL/SKIP; exit 0 |
| Rigtig browser I | 4 grupper PASS, 93 Worker-requests, 0 FAIL/TODO/SKIP |
| Rigtig browser E/F/G/H-regression | 16 grupper PASS, 245 requests, 0 FAIL/TODO/SKIP |
| Parser-sync og diff-check | PASS |

Browser samlet: **20 grupper / 338 requests**. Chrome 155.0.8059.85, ChromeDriver 155.0.8059.84, produktions-module Worker, Pyodide v314.0.7 og SymPy. Node v24.11.0 / Python 3.12.4. Testgrupper og antal requests er forskellige målinger.

Den rigtige kildevej verificerer reference `{5,2,5,3,2,5}`, alle fem eksakte outputlister, providerbinding/redigering, dirty-invalidering og genberegning, efterfølgende `mean(relative_frequencies(A))`, opgaveisolation, uændrede tidligere input/resultater og frosne/roundtrippede Values. Rational/decimal-lighed, numerisk kontra tekstsortering, negative/nul/store heltal, singleton og kontrollerede fejl med recovery er dækket. Python kontrollerer hele frekvenssummen eksakt samt request/spec-immutability, aritet, capability og options.

```powershell
node --test tests/js/p0021-slice-100i-frequencies.test.mjs tests/js/p0021-slice-100h-quartiles.test.mjs tests/js/p0021-slice-100g-order-statistics.test.mjs tests/js/p0021-slice-91a-parser-packrat.test.mjs
python -m unittest discover -s tests/python -p test_p0017_frequencies.py
python -m unittest discover -s tests/python -p test_p0017_*statistics.py
python -m unittest discover -s tests/python -p test_p0017_quartiles.py
npm test
node tools/build/generate_canonical_parser.mjs --check
git -c core.safecrlf=false diff --check
```

Browser: eksisterende `tools/dev/run-s96b2-browser.py`, `--page tests/browser/p0021-slice-100i-frequencies.html --result-variable s100iResult`. Runneren køres i hukommelsen med de tidligere dokumenterede headless-testflags `--no-sandbox` / `--disable-dev-shm-usage`; runnerfilen ændres ikke. Cache/log ligger i TEMP. Ingen offline-accept eller fuld historisk browsermatrix påstås.

## Sikkerhed og fortsættelse

Den permanente S91a-test-only-rettelse er til stede: child-processen får `FORCE_COLOR=0`, med uændret input/assertions/4000 ms-grænse; fuld suite bestod med farver tvunget på i forældremiljøet. Ingen TODO/SKIP-status ændret.

G/H-rapporter, S91a-rettelse, `s100-testlog.txt`, `chromedriver/`, `se-metadata.json` og checkpointmanifestet bevares. Ingen staging, commit, push, reset eller clean. Den shared matematiske kerne indeholder ingen dokumentautoritet. S100i har ingen åben backend-/matematikgate, så S100j fortsættes efter den autoriserede kontraktkontrol. Den eksisterende UI-gate for listevisning består uden rendererændring.

Efterfølgende S100j er også GREEN. Dets separate rapport `P0021-slice-100j-exact-frequency-statistics.md` indeholder den samlede endelige Git-status, I-regression på J-koden og anbefalingen til intervalgrupperede data. Tallene ovenfor bevarer det selvstændige I-checkpoint før J-koden.
