# S100h — eksakte kvartiler og femtalsresumé

22. oktober 2026. **GREEN for backend-/Value-slicen**, efter eksplicit brugerbeslutning om n=1. Listepræsentation er en særskilt åben UI-gate. Informativ rapport, ingen ændring af FROZEN eller accepterede ADR'er. Basis: `architecture-v1-implementation`, HEAD `bb0e05b`, med S100g GREEN i worktree.

## Matematisk kontrakt fastlagt før implementering

`quartiles(data)` returnerer almindelig immutable ListValue [Q1,Q2,Q3]. `five_number_summary(data)` returnerer [min,Q1,Q2,Q3,max]. Begge er pure med ét `data:value`-argument og samme ikke-tomme eksakte integer/rational-ListValue-domæne som S100e/g. Tom instruction/options; ingen implicit dokumentkonvention.

Observationerne sorteres numerisk med gentagelser bevaret. Q2 er medianen. Ved n≥4 anvendes median-of-halves: Q1/Q3 er medianerne i hver halvdel, og ved ulige n udelades den centrale observation fra begge halvdele. De eksplicit fastlagte randregler for n=1,2,3 står nedenfor; n=2/3 stemmer også overens med samme halveringsmetode:

| n | Kvartiler | Femtalsresumé |
| --- | --- | --- |
| 0 | Struktureret afvisning, tom liste uden for inputdomænet | Samme afvisning |
| 1 | [a,a,a], **eksplicit godkendt af brugeren** | [a,a,a,a,a], samme beslutning |
| 2, sorterede x1,x2 | [x1,(x1+x2)/2,x2] | [x1,x1,(x1+x2)/2,x2,x2] |
| 3, sorterede x1,x2,x3 | [x1,x2,x3] | [x1,x1,x2,x3,x3] |

Singletonreglen er en navngiven særregel i denne operationskontrakt; den er ikke udledt som medianen af en tom halvdel eller overtaget fra et bibliotek. Den tidligere analyserapport bevares som historik med henvisning til denne afklaring.

## Minimal implementering og diagnoser

Kun tre produktionsfiler udvides oven på G:

- `src/python/evaluator/list_statistics.py`: fælles kvartilhjælper oven på den eksisterende medianhjælper, eksplicit singletonregel og to wrappers. De allerede validerede SymPy-rationals sorteres på en separat liste; resultatets elementer konverteres enkeltvis med eksisterende SymPyValueAdapter til en almindelig P0005 ListValue-envelope.
- `src/js/operations/selected-operation-catalog.js`: unary `quartiles` og `five_number_summary`, evaluator-id'er `probe.statistics.quartiles` og `probe.statistics.five_number_summary`.
- `src/js/evaluation/selected-pyodide-runtime.js`: de to eksplicitte imports/dispatchgrene og capability-allowlist.

Ingen eksisterende selected navne kolliderer; katalogtesten verificerer én registrering pr. public id. Der er heller ingen legacy-registrering med disse to navne. Ingen ny generel adaptertype, Python-strengevaluering, evaluator, JavaScript-statistik, list/vector-konvertering, dokument-/scope- eller UI-ændring. Inputrækkefølge og gentagelser bevares i den oprindelige immutable liste; kun beregningskopien sorteres.

Samme validering og P0009-producentkontrakt som G genbruges. Tom/nested/approx-liste giver `type-mismatch` med `{operationId, argument:"data", expectedKinds:["nonempty-list-of-exact-rational-expressions"], actualKind:"list"}`. Vector giver `expectedKinds:["list"]`, `actualKind:"vector"`. Forkert aritet og capability følger eksisterende `wrong-arity`/`unsupported-operation`. Ingen nye diagnosekoder, descriptors eller Value-kinds.

Nye permanente H-filer:

- `tests/python/test_p0017_quartiles.py` (8 tests).
- `tests/js/p0021-slice-100h-quartiles.test.mjs` (1 test).
- `tests/helpers/s100h-quartiles-cases.mjs`.
- `tests/browser/p0021-slice-100h-quartiles.html` og `.mjs`.
- Denne rapport; den historiske beslutningsrapport er opdateret med afklaring. G-rapporten henviser nu til H's aktuelle slutstatus uden at ændre G-checkpointets testtal.

## Selvstændigt RED → YELLOW → GREEN

Før H-produktionsændringer: **1 Node FAIL / 0 PASS** på manglende `quartiles`-registrering. Python discovery gav én importfejl for de manglende handlers; de otte matematiktests var endnu ikke udført. Rigtig browser med produktions-Worker og indlæst Pyodide/SymPy gav én fejlet kørsel på `quartiles: null`.

YELLOW genbrugte G's validering/sortering/median og tilføjede kun kvartilberegningen, almindelig listetransport og de to eksplicitte registreringer. Samme forventninger blev derefter GREEN; ingen testforventning blev ændret for at få implementeringen til at bestå.

| Faktisk kontrol på H-koden | Resultat |
| --- | --- |
| Node S100e/f/g/h, fire testfiler | 7 PASS, 0 FAIL/TODO/SKIP |
| Python H | 8 PASS, 0 FAIL/SKIP |
| Python E/F/G-regression | 21 PASS (8 + 6 + 7), 0 FAIL/SKIP |
| Fuld `npm test` | 1715 JS PASS, 0 FAIL, 7 TODO, 1 SKIP, 0 cancelled; 1723 tests. 302 Python PASS, 0 FAIL/SKIP. Exit 0 |
| Rigtig browser H | 4 grupper PASS, 0 FAIL/TODO/SKIP, 87 Worker-requests |
| Rigtig browser E/F/G-regression i samme kørsel | 12 grupper PASS, 0 FAIL/TODO/SKIP, 158 requests |
| Parser-sync `--check` og `git diff --check` | PASS; parser ikke ændret eller regenereret |

Node v24.11.0, Python 3.12.4. Chrome 155.0.8059.85 og ChromeDriver 155.0.8059.84, eksisterende supervised module Worker, Pyodide v314.0.7 og SymPy. Samlet browserkørsel: **16 grupper PASS / 245 requests**. Dette er testgrupper, ikke 245 uafhængige tests.

H-browseren verificerer:

1. Separate FormulaBlocks med dokumentprovider `n`, kildeliste `A`, assignments til kvartiler/femtalsresumé og `median(Q)` som efterfølgende consumer. Redigering af provider invaliderer og genberegner begge lister og consumer; en anden opgaves resultat er uændret.
2. Begge referencecases n=7/8, godkendt singleton, n=2/3, n=5 med central observation udeladt, gentagelser/usorteret input, rationale/decimaler, negative og heltal over Number's sikre område. Begge returnerede ListValues kontrolleres for korrekt rækkefølge, P0005-validitet, tabsløs encode/decode og frosne liste-/element-/expression-objekter. Tidligere input/resultater forbliver uændrede.
3. Komplette strukturerede diagnoser for tom, vector, nested og approx gennem rigtig Worker. Tom kildeliste rydder gamle resultater og consumer; ny singletonkilde genopretter gyldige resultater.
4. Resultaterne er almindelige Values gennem rigtig Worker; den uændrede selected renderer viser fortsat `PRESENTATION_UNSUPPORTED_VALUE` for ListValue. Dette er dokumentation af UI-gaten, **ikke** accept af fungerende listevisning.

Reproducerbare kommandoer:

```powershell
node --test tests/js/p0021-slice-100g-order-statistics.test.mjs tests/js/p0021-slice-100h-quartiles.test.mjs tests/js/p0021-slice-100e-statistics.test.mjs tests/js/p0021-slice-100f-sample-statistics.test.mjs
python -m unittest discover -s tests/python -p test_p0017_quartiles.py
python -m unittest discover -s tests/python -p test_p0017_*statistics.py
npm test
node tools/build/generate_canonical_parser.mjs --check
git -c core.safecrlf=false diff --check
```

Browseren bruger `tools/dev/run-s96b2-browser.py` med `--page tests/browser/p0021-slice-100h-quartiles.html --result-variable s100hResult`, samme in-memory testflags som dokumenteret for G (`--no-sandbox`, `--disable-dev-shm-usage`). Runneren er ikke ændret. Cache og npm-log ligger i Windows TEMP. Ingen fake Worker er eneste integrationsbevis; ingen offline cold-start eller fuld historisk browsermatrix påstås.

## Fremtidige grupperede data

Faktiske observerede minimums-/maksimumsværdier kan ikke bestemmes alene fra intervalgrupperede observationer. Klassegrænser må ikke implicit fortolkes som observerede ekstremværdier. Senere operationer uden nødvendige fakta skal give strukturerede, sprog-uafhængige diagnoser; danske tekster og i18n hører til præsentationslaget. Grupperede medianer/kvartiler skal tydeligt markeres som estimater. Ingen af disse fremtidige datatyper, diagnosekoder eller beregninger er tilføjet her.

## Afsluttende Git og åbne gates

S100g-ændringer og alle oprindelige artefakter er bevaret. Branch og HEAD er fortsat `architecture-v1-implementation` / `bb0e05ba105519fbd6fd665dcc50daebd6adde0a`. `git status --short` viser de tre fælles produktionsfiler som modified, tre nye rapporter og ti nye test-/fixturefiler samt de tre oprindelige untracked artefaktstier. Ingen øvrige tracked ændringer.

Samlet G/H `git diff --stat`: **3 tracked filer, 71 insertions / 8 deletions**. De 13 nye filer er untracked og indgår ikke i denne statistik. `git diff --check` exit 0; cached diff er tom. Checkpointmanifestets SHA-256 er fortsat `16572F49C22C9D73BB4E694A634E2666185602E0455E85BE0CAC80B559114BD6`. `chromedriver/` og `se-metadata.json` er urørte. Ingen staging, commit, push, reset eller clean.

Den matematiske n=1-gate er lukket af brugerens beslutning. Ingen åben Value-/Worker-/backendgate for G/H. **Listepræsentation er fortsat åben som separat UI-opgave**; ingen rendererændring foretages i disse slices. De syv eksisterende TODO og ene Windows-symlink-SKIP er bevaret. Elevnotation, offline-pakning og fuld normativ releaseaccept er uændrede særskilte gates.

## Efterfølgende præcisering af n=1/2/3 og n≥4

Brugeren har bekræftet alle tre randregler i tabellen og median-of-halves for n≥4. Dokumentationen siger nu dette direkte. Implementeringen opfyldte allerede reglerne; kun dokumentationen og de eksisterende Python-regressionstests er udvidet. Singletonprøven dækker nu både nul, negativ rational og `9007199254740993`; n=2 dækker desuden usorteret input med negativt, eksakt halvtalsresultat; n=3 dækker usorterede gentagelser. Begge operationer kontrolleres, og den eksisterende test for tom liste verificerer fortsat alle strukturerede diagnosefelter.

Ny fokuseret kørsel efter disse udvidelser: **8 H-Python PASS + 21 E/F/G-Python PASS; 7 Node PASS; 0 FAIL/TODO/SKIP**. Parser-sync og diff-check PASS. De ovenfor opførte fulde npm- og browserkørsler blev udført før denne efterfølgende test-/dokumentationspræcisering på samme produktionskode; de er ikke kørt igen her. Git-checkpoint og de øvrige ændringer er bevaret.
