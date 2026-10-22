# S100e — eksakt middelværdi og populationsspredning

22. oktober 2026. GREEN inden for den godkendte slice. Informativ rapport; ingen ændring af FROZEN, ADR eller Value/Worker-schema.

## Git-checkpoint før implementering

Ved start var HEAD `5455a06`, med S100a–d som 20 ændrede tracked filer og 18 nye S100-filer. `tools/dev/s100ad-checkpoint-allowlist.json` indeholder de præcise **38 stier**, inklusive regenereret parser, og SHA-256 for deres daværende indhold. `chromedriver/` og `se-metadata.json` er eksplicit udeladt. Kopier blev gemt i den temp-mappe, manifestet angiver, før S100e ændrede fælles filer. Manifestet selv er administrativt og ikke en del af det historiske 38-filers checkpoint.

Efter brugerens afbrydelse var HEAD ændret eksternt til `69c2038840df5a924243ba3b666f29a6103b38f0` (`feat(s100a-d): exact source lists and numeric literals with selected mean`). Read-only kontrol viste præcis lighed mellem commit-filsettet og alle 38 allowlist-stier samt uændret filindhold mod hashes. Denne commit er derfor E/F-basis. Agenten har ikke staged, committed eller pushet.

Foreslået stagingkommando blev vist, men ikke udført:

```powershell
$checkpoint = Get-Content -Raw tools/dev/s100ad-checkpoint-allowlist.json | ConvertFrom-Json
foreach ($entry in $checkpoint.files) {
    if ((Get-FileHash -LiteralPath $entry.path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) {
        throw "Indhold ændret siden S100a–d-checkpoint: $($entry.path)"
    }
}
git add -- @($checkpoint.files.path)
```

Nu er A–D allerede committed. Hashkontrollen vil desuden med vilje afvise nye E/F-versioner af fælles filer; dette er ikke en kommando til at stage den senere worktree som et rent A–D-checkpoint.

## Matematisk kontrakt og repræsentationsgate

`mean`, `variance`, `standard_deviation` er pure, med ét `data:value`-argument, evaluator-id `probe.statistics.<operation>`, tom instruction/options og ingen skjult dokumentkonvention. Input er ikke-tomme ListValues af integer/rational ExpressionValues. Approx, symbolske/algebraiske expression-inputs, nested list og vector er uden for domænet. Output er eksisterende ExpressionValue, eksakt og backend-neutral.

Før spredningsimplementeringen blev sqrt-gaten faktisk kørt: eksisterende SymPy-adapter eksporterede `sqrt(2/3)` som `mul(rational(1,3), pow(integer(6), rational(1,2)))`; P0005 decode/roundtrip og P0010 evaluationSuccess accepterede den. Derefter bestod `?gate-only=1` i rigtig Worker med eksisterende `probe.scalar.power`, uden nye statistik-handlers: **1 PASS, 1 Worker-request**. Ingen ny Value-kind og ingen float-fallback er nødvendig.

Python/SymPy beregner middelværdi og summen af kvadrerede afvigelser. Populationsvarians dividerer med **n**; standardafvigelse er den eksakte ikke-negative kvadratrod. JS vælger/transporterer operationer og viser testassertions; det beregner ikke statistik. Input er uændrede, og store heltal passerer ikke en tabsgivende Number-konvertering.

## Diagnoser og ændringer

Eksisterende `wrong-arity`, `unsupported-operation` og `type-mismatch` med samme parameternøgler som S100b. Forkert ydre kind: expectedKinds `["list"]`, actualKind faktisk kind. Tom/ugyldig liste: `["nonempty-list-of-exact-rational-expressions"]`, actualKind `list`. Dette er en producentdescriptor, ikke en ny Value-type. Malformed rationals, fx nul/numerisk nævner, er integrationsfejl, og konverteres ikke stiltiende. Negative gyldige rationals accepteres.

- Ny `src/python/evaluator/list_statistics.py`: fælles præcis inputvalidering og eksakt beregning for de tre operationer.
- `list_mean.py`: bevarer den eksisterende importvej og henviser til samme handler.
- Selected-katalog og Pyodide-runtime registrerer variance/std og det nye modul; ingen ny evaluator/gateway eller ændring af transport.
- To allowlist-tests er udvidet med den ene nye Python-fil. Tidligere heltalsdomæne-tests er tilpasset den godkendte rationaludvidelse; afvisning af approx/nested/andre expression-typer består.
- Den tidligere S100d negative rational-mean-kontrol er nu en positiv eksakt mean-reference. Gamle rapporter er historiske checkpoints og er ikke omskrevet.
- Nye tests: `tests/js/p0021-slice-100e-statistics.test.mjs`, `tests/python/test_p0017_population_statistics.py`, `tests/helpers/s100e-statistics-cases.mjs`, browser `.html/.mjs` med samme slice-navn.

## RED → YELLOW → GREEN og faktiske resultater

RED: sqrt-gaten PASS, katalogtest FAIL på manglende variance; Python discovery havde én importfejl for den manglende nye handlerfil. Efter fælles handler/dispatch og opdatering af det udvidede inputdomæne: 2 nye Node-tests og 8 nye Python-tests PASS; 9 gamle mean-regressionstests PASS. Matematikken omfatter uafhængige SymPy-referenceforventninger, ingen Float i resultaterne og uændrede requests/specs.

| Check på E-checkpointet, før F-kode | Faktisk resultat |
| --- | --- |
| Fokuseret Node, ni filer | 98 PASS / 0 FAIL / 0 TODO / 0 SKIP / 0 cancelled |
| Population Python + mean-regression | 8 + 9 PASS / 0 FAIL / 0 SKIP |
| Fuld `npm test` | 1710 JS PASS / 0 FAIL / 7 TODO / 1 SKIP / 0 cancelled (1718 tests); 281 Python PASS / 0 FAIL / 0 SKIP; exit 0 |
| Parser-sync `--check` | PASS, ingen parserændring |
| Rigtig browser | 4 grupper PASS / 0 FAIL / 0 TODO / 0 SKIP, 38 statistikfixture-requests samt 1 separat root-control i samme side |

Chrome 155.0.8059.85, ChromeDriver 155.0.8059.84, eksisterende supervised module Worker, Pyodide-URL v314.0.7 og SymPy. S100b-rapportens in-memory Selenium-testflags/cache blev genbrugt. Browserbevis er særskilt fra desktop/loader-tests.

Browseren verificerede de krævede fraction-/decimal-resultater, eksakt irrational populationstd, singleton 0, provider- og datasetændringer med reaktiv genberegning, task-isolation, immutable tidligere observationsliste og komplette diagnoser for alle tre operationer over tom liste, vector, nested og approx. Python dækker desuden negative/gentagne/store tal og forkert aritet/capability/malformed rationals.

```powershell
node --test --test-reporter=tap tests/js/p0021-slice-100e-statistics.test.mjs tests/js/p0021-slice-100b-mean.test.mjs tests/js/p0021-slice-100c-source-lists.test.mjs tests/js/p0021-slice-100d-numeric-source.test.mjs tests/js/p0021-selected-pyodide-runtime.test.mjs tests/js/p0021-selected-angle-unit.test.mjs tests/js/selected-operation-catalog.test.mjs tests/js/value-contract.test.mjs tests/js/evaluation-contract.test.mjs
python -m unittest discover -s tests/python -p test_p0017_population_statistics.py
python -m unittest discover -s tests/python -p test_p0017_mean.py
npm test
node tools/build/generate_canonical_parser.mjs --check
```

Browser: eksisterende runner som dokumenteret i S100b, `--page tests/browser/p0021-slice-100e-statistics.html --result-variable s100eResult`; preflight brugte siden med `?gate-only=1`.

## Gates og fortsættelse

Ingen åben matematisk/Value/transport-gate for den valgte E-slice; alle krævede E-checks er GREEN. Derfor fortsættes automatisk til S100f som autoriseret. Syv TODO og én Windows-symlink-SKIP er uændrede; ingen statusbeslutning om dem. Offline/student-UI/full normative matrix er ikke accepteret her. Ingen FROZEN/ADR/notation/StatisticsValue/grafik/import-ændring, staging eller commit fra agenten.

## Afsluttende kontrol af diagnoser fra kilde til dokument

Slutgennemgangen efter sample-implementeringen fandt et eksisterende transporthul: `evaluate-nested-selected-calls.js` kastede en generisk Error og mistede den strukturerede Worker-diagnose. En ny fokuseret RED-test fejlede på den manglende P0009-diagnose. Den mellemroute rehydrerer nu kun version-1-fakta med matchende blockId/fejlkode og tilstedeværende parameters via eksisterende `diagnostic(...)`, og vedhæfter dem til Error. Den allerede eksisterende dispatch/commit/DocumentRuntime-bridge bevarer dem. Ingen ændring af DocumentRuntime, P0010 eller Worker-protokollen, ingen kodeudledning fra fejltekster; mismatchede/malformed diagnoser forbliver generiske fejl.

Den nye tredje E-Node-test verificerer også afvisning af mismatchet kode, forkert version og manglende parametre. Browserfixturet kontrollerer nu `variance({})` helt frem til `calculation.error.diagnostic`, inklusive parametre. Efter rettelsen: **3 E-Node-tests PASS**; samlet fokuseret regression inkl. F/S94d: **119 PASS / 0 FAIL/TODO/SKIP**. Endelig fuld suite med F: **1712 JS PASS / 0 FAIL / 7 TODO / 1 SKIP**, 1720 tests; **287 Python PASS / 0 FAIL / 0 SKIP**. Parser-sync PASS.

Den endelige E-browsergenkørsel: **4 grupper PASS, 40 fixture-requests plus 1 root-control**, 0 FAIL/TODO/SKIP. S100f-browseren genkørte desuden de fire E-grupper efter den sidste produktionsændring. De tidligere tal i tabellen er det faktiske checkpoint før F; de er ikke blandet sammen med den afsluttende fælles testpopulation. Ingen åben diagnosegate for E-slicen.
