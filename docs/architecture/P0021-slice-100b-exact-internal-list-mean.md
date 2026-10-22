# S100b — eksakt middelværdi af intern ListValue

22. oktober 2026. Informativ implementerings-/acceptancerapport; ingen ændring af FROZEN eller accepterede ADR'er.
Basis: `architecture-v1-implementation`, HEAD `5455a06cf209da2b358bce2841fcda0fd3653cec`.
S100a-rapporten og de eksisterende untracked `chromedriver/` / `se-metadata.json` er bevaret.

## Kontrakt og resultat

Den af brugeren godkendte interne heltalsmiddelværdi er implementeret gennem eksisterende P0007 Call/Value, P0008 OperationSpec, selected evaluator, supervised Worker og P0011 SymPy-adapter.

- Public operation-id `mean`, evaluator-id `probe.statistics.mean`; én signatur `data:value`, ren/deterministisk, ingen variadic/scoped argumenter.
- Tom `instruction` og tomme `options`. `diagnosticAdapterId` er null efter eksisterende katalogmønster; producenten leverer P0009-diagnoser direkte.
- Input: allerede materialiseret, ikke-tom `ListValue` med kanoniske integer-`ExpressionValue`-elementer. Heltalsværdier er strenge; ingen JavaScript Number- eller floatkonvertering i beregningen.
- Handleren validerer heltalsformen, bruger den eksisterende SymPy-adapter pr. element, summerer eksakt og dividerer med eksakt observationstal. Adapteren returnerer integer eller reduceret rational.
- Input, rækkefølge og gentagelser ændres ikke. Ingen implicit List/Vector-konvertering, legacy-kald, Python-kodegenerering fra matematikkilde eller dokument-/scopeopslag.

## Lille eksplicit diagnoseproducentkontrakt

Eksisterende `_failure` fra `_binary_expression_contract.py` producerer P0009 Diagnostic i P0010 failure. Felter følger de eksisterende unary/binary-handleres og `system_solving.py`'s mønstre; ingen nye fejlkoder eller parallel diagnosemekanisme.

| Tilfælde | Kode | Parametre |
| --- | --- | --- |
| Forkert antal input | `wrong-arity` | `operationId: "mean"`, `expected: [1]`, `actual: antal` |
| Forkert valgt handler/evaluator | `unsupported-operation` | `operationId` fra valgt spec |
| Vector/anden Value-kind | `type-mismatch` | `operationId: "mean"`, `argument: "data"`, `expectedKinds: ["list"]`, `actualKind: input.kind` |
| Tom liste eller element uden for heltalsdomænet | `type-mismatch` | `operationId: "mean"`, `argument: "data"`, `expectedKinds: ["nonempty-list-of-integer-expressions"]`, `actualKind: "list"` |

Sidste descriptor er denne slices afgrænsede inputdomæne, ikke en ny Value-kind. Der tilføjes ingen elementposition eller lokaliseret tekst. En rational med nævner 1 er stadig uden for integer-node-domænet i denne slice. Malformed transportdata, ugyldig signatur, instruktion eller options er integrationsfejl (`ValueError`) efter eksisterende mønster; gyldige Values uden for domænet giver de kontrollerede diagnoser ovenfor.

YELLOW påviste, at `selected_gateway_bridge.py` tabte hele diagnosen efter matematikhandleren. Gatewayen bevarer nu desuden `diagnostic` i failure-svaret, inklusive version, kode og parametre. De eksisterende `blockId/status/code/message` er bevaret, og `message` er kun fejlkoden. Worker-protokollen er uændret; browsertesten kontrollerer de faktisk transporterede diagnosefelter med eksisterende `diagnosticSpec`/`diagnosticFromSpec`. Wire-diagnosen er almindelige klonede data; der påstås ikke en ny automatisk immutable-diagnose-rehydrering i Worker-clienten.

## Ændrede filer

Eksisterende produktionsfiler:

- `src/js/operations/selected-operation-catalog.js`: mean-spec.
- `src/js/evaluation/selected-pyodide-runtime.js`: eksplicit fil-allowlist, import og handler-dispatch for mean.
- `src/python/evaluator/_unary_value_contract.py`: valgfri `expected_kind`, stadig `expression` som default; mean vælger `list`.
- `src/python/evaluator/selected_gateway_bridge.py`: bevar struktureret diagnose i failure-svar.

Ny produktionsfil: `src/python/evaluator/list_mean.py`.

Tests: nye `tests/python/test_p0017_mean.py` og `tests/js/p0021-slice-100b-mean.test.mjs`; eksisterende `tests/js/p0021-selected-pyodide-runtime.test.mjs` og `tests/js/p0021-selected-angle-unit.test.mjs` opdaterer kun deres præcise modullister med den nye fil. Begge kontroller bevarer eksakt allowlist-lighed.

Rigtig browserfixture: `tests/browser/p0021-slice-100b-mean.html` og `.mjs`. Den anvender interne Values og det eksisterende produktions-Worker-entrypoint; ingen parser, DocumentRuntime eller UI-beregning. Denne rapport er den eneste nye S100b-dokumentationsfil.

## RED → YELLOW → GREEN

- RED før produktionsændringer: 2 Node-tests fejlede på manglende mean-spec; Python discovery rapporterede 1 importfejl, fordi handleren endnu ikke fandtes (ikke ni kørte scenarier).
- YELLOW: aritmetikken virkede, men Node-integrationen og én af 9 Python-tests fejlede, fordi gatewayen tabte diagnoseparametrene.
- GREEN efter gatewayrettelsen: alle fokuserede tests og de fem rigtige browsergrupper består.
- Regression fandt først to gamle eksakte modul-allowlists, der skulle udvides med den godkendte handlerfil. Efter den sidste rettelse er fuld `npm test` GREEN. Ingen forventning blev svækket eller gjort til TODO/SKIP.

## Faktiske testbeviser

Node v24.11.0, Python 3.12.4, Selenium 4.35.0.

| Kørsel | Faktisk resultat |
| --- | --- |
| Fokuseret Node, ni filer nedenfor | 151 PASS / 0 FAIL / 0 TODO / 0 SKIP / 0 cancelled |
| Separat rettet angle-unit-testfamilie | 8 PASS / 0 FAIL / 0 TODO / 0 SKIP |
| `test_p0017_mean.py` | 9 PASS / 0 FAIL / 0 SKIP |
| `test_p0021_selected_gateway_bridge.py` | 14 PASS / 0 FAIL / 0 SKIP |
| Afsluttende `npm test` | JS: 1703 PASS / 0 FAIL / 7 TODO / 1 SKIP / 0 cancelled; 1711 tests. Python: 273 PASS / 0 FAIL / 0 SKIP. Exit 0 |
| Kanonisk parser-sync `--check` | PASS, ingen regenerering |
| Rigtig browser | 5 scenariegrupper PASS / 0 FAIL / 0 TODO / 0 SKIP, 12 faktiske selected Worker-requests |

De fokuserede JS-tests inkluderer en desktop-integration, der kører produktionsbootstrappens statiske Python-entry med `python -c`. Pyodide-loader/FS er test-double i den kørsel; matematikhandler og gateway er reelle. Det er **ikke** browserbeviset.

Browserbeviset kom fra Chrome **155.0.8059.85**, ChromeDriver **155.0.8059.84**, den eksisterende supervised module Worker og dens låste Pyodide-URL `v314.0.7/full/` med `loadPackage('sympy')`. Backendversioner blev ikke særskilt udlæst. Der er ingen fake matematikresultater i browserfixturet.

Browsergrupperne verificerede:

1. `[2,4,6,8]` → eksakt integer 5.
2. `[1,2,4]` → rational 7/3 og `[-2,1]` → rational -1/2.
3. `[-2,4,4]` → 2; singleton `9007199254740993` bevares; `[9007199254740993,9007199254740995]` → 9007199254740994; `[-4,4]` → 0. Input er uændret, succes-Values er gyldigt rehydrerede/frosne.
4. VectorValue afvises med den komplette aftalte diagnose.
5. Tom liste, approximate-element, rational-element og nested list afvises med komplette strukturerede diagnoser, og input er uændret.

Første forsøg med den uændrede eksisterende Selenium-runner crashede fanen under navigation, før acceptanceresultat. Genkørslen bestod med `--no-sandbox` og `--disable-dev-shm-usage` føjet til **testprocessens** Chrome-options i hukommelsen. Ingen runner- eller produktionsfil blev ændret til dette. Selenium-cache blev dirigeret til `%TEMP%/newcas-s100b-selenium`. Det er en afgrænset testkonfiguration, ikke en browser-sandbox- eller student-releaseaccept. Offline cold-start og de historiske browsergrupper blev ikke kørt.

Reproducerbare testkommandoer fra repo-roden:

```powershell
node --test --test-reporter=tap tests/js/p0021-slice-100b-mean.test.mjs tests/js/selected-operation-catalog.test.mjs tests/js/p0021-selected-pyodide-runtime.test.mjs tests/js/p0021-worker-evaluation-protocol.test.mjs tests/js/p0021-shared-worker-value-boundary.test.mjs tests/js/p0021-compile-selected-value-call.test.mjs tests/js/evaluation-contract.test.mjs tests/js/value-contract.test.mjs tests/js/diagnostic-contract.test.mjs
node --test tests/js/p0021-selected-angle-unit.test.mjs
python -m unittest discover -s tests/python -p test_p0017_mean.py
python -m unittest discover -s tests/python -p test_p0021_selected_gateway_bridge.py
npm test
node tools/build/generate_canonical_parser.mjs --check
```

Den beståede browserkørsel brugte denne in-memory tilpasning af den eksisterende runner:

```powershell
$env:SE_CACHE_PATH = Join-Path $env:TEMP 'newcas-s100b-selenium'
@'
from pathlib import Path
import sys
path = Path('tools/dev/run-s96b2-browser.py').resolve()
source = path.read_text(encoding='utf-8').replace("options.add_argument('--disable-gpu')", "options.add_argument('--disable-gpu')\noptions.add_argument('--no-sandbox')\noptions.add_argument('--disable-dev-shm-usage')")
sys.argv = [str(path), '--page', 'tests/browser/p0021-slice-100b-mean.html', '--result-variable', 's100bResult']
exec(compile(source, str(path), 'exec'), {'__file__':str(path),'__name__':'__main__'})
'@ | python -
```

De syv eksisterende TODO og real-symlink-SKIP består som åbne dispositioner; denne slice løser ikke F7/F8/F4 eller multi-statement-gaten. Testpopulationerne ovenfor overlapper og skal ikke summeres.

## Til S100c og Git-afgrænsning

Intern mean er accepteret i denne afgrænsning. Kildelister, endelig listestavemåde, AST→IR-konstruktion, dokumentbaseret reaktiv `mean(A)`, decimallexeme, StatisticsValue, UI og plots er ikke implementeret eller accepteret her. Næste anbefalede slice er at beslutte kilde-/konstruktorgrænsen for lister og skrive målrettede RED-tests for listeelementer og providerbinding gennem IR; brug stadig heltalsdata, indtil decimalgaten behandles særskilt.

Ingen ændring af grammar/generated parser, FROZEN, ADR, DocumentRuntime, scope, persistens eller legacy-kode. Ingen staging, commit, push, reset eller clean. `git diff --cached --stat` er tom. `git diff --check` består; Git oplyser kun LF→CRLF-normalisering ved senere Git-skrivning.

`git diff --stat` for de **seks tracked filer**: 15 insertions, 5 deletions. Untracked S100b-filer (handler, to testfiler, to browserfiler og denne rapport) vises ikke i denne statistik. Afsluttende `git status --short` skal derfor læses sammen med statistikken; de tre oprindelige untracked stier er ikke S100b-ændringer.
