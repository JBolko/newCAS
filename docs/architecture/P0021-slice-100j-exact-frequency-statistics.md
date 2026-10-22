# S100j — eksakt statistik fra absolutte hyppigheder

22. oktober 2026. **GREEN for den valgte backend-/Value-slice**, efter selvstændigt GREEN S100i. Informativ rapport, ingen ændring af FROZEN eller accepterede ADR'er. Branch `architecture-v1-implementation`, HEAD `bb0e05b`, med bevarede G/H/I-ændringer og S91a-rettelse. Den tidligere dokumenterede UI-gate for ListValue-visning består særskilt.

## Kontrakt fastlagt før implementering

De ti operationer `mean`, `variance`, `standard_deviation`, `sample_variance`, `sample_standard_deviation`, `median`, `min`, `max`, `quartiles` og `five_number_summary` får to eksplicitte P0008-signaturer under samme public operation/evaluator-id:

- `(data:value)` — rå observationer, eksisterende betydning.
- `(values:value, counts:value)` — diskrete faktiske observationsværdier med absolutte hyppigheder.

`planOperationArguments`, attesteret source-compiler, selected-call-compiler og nested evaluator vælger allerede generisk efter aritet og `value`-roller. Der er ingen behov for ny DocumentRuntime-regel, alternativ evaluator, skjult option eller `weighted_*`-familie. I's fem frekvensprojektioner bevarer deres unary signatur; binær udvidelse af dem er ikke denne opgave.

Begge lister skal være lige lange. Observationer er eksakte integer/rational Values. Counts er eksakte ikke-negative heltal (en eksakt rationalrepræsentation, der matematisk er et heltal, normaliseres af den eksisterende adapter og er også et heltal). Alle observationsfelter valideres, også ved count=0. Nulhyppigheder fjernes fra beregningsgrundlaget, og ens observationsværdier sammenlægges uden inputmutation. Den samlede hyppighed skal være positiv; sample-varianterne kræver mindst 2. Negative, fractional og approx counts afvises. Store counts bliver aldrig JavaScript Numbers.

Begge inputformer skal anvende én komprimeret diskret Python/SymPy-kerne. Mean/variance bruger eksakte vægtede summer og n eller n−1. Median/kvartiler bruger heltallige rangplaceringer i kumulerede counts; ingen ekspansion til n rå elementer. Kvartiler følger H inklusive eksplicit singletonregel [a,a,a], femtalsresumé [a,a,a,a,a], samt n=2/3 og udeladt central observation ved ulige n≥5. Minimum/maksimum er faktiske værdier med positiv hyppighed.

## Små eksplicitte diagnoseproducentkontrakter

Eksisterende P0009-koder og parameternøgler genbruges. Ydre Vector giver `type-mismatch`, argument `values` eller `counts`, expectedKinds `["list"]`. Forkert observationsdomæne bruger eksisterende `nonempty-list-of-exact-rational-expressions`-descriptor. Forkerte counts bruger `list-of-exact-nonnegative-integers`; total=0 bruger `absolute-frequencies-with-positive-total`; sample total=1 bruger `absolute-frequencies-with-total-at-least-two`. Alle er descriptors i `expectedKinds`, ikke nye Value-kinds eller diagnosekoder. Parametrene er `{operationId,argument,expectedKinds,actualKind}`.

Ulige længder giver eksisterende `dimension-mismatch` med `{operationId, expectedDimension:{items:values.length}, actualDimension:{items:counts.length}}`, i samme parameterform som P0009's pressure-test. Forkert aritet giver `wrong-arity` med expected `[1,2]` på de nye fulde specs; tidligere unary-only interne test-specs bevarer `[1]`. Malformed integration/payload er fortsat en integrationsfejl. Ingen sprogafhængig backendtekst produceres.

Ved flere samtidige fejl valideres kontrakt/arity og ydre kinds først, derefter observationsdomæne og count-domæne, længder og til sidst samlet hyppighed. To tomme lister afvises ved total=0; nulhyppigheder gør ikke ugyldige observationsfelter gyldige. Sample-total=0 kræver først positiv total; total=1 får sample-descriptoren.

## Én beregningsvej og komprimerede rangopslag

`_DiscreteObservations` fra I modtager nu enten rå observationer med implicit count=1 eller de to validerede lister. Ens SymPy-rationals samles, nulcounts fjernes, og tuples med sorterede faktiske værdier, counts og kumulerede counts dannes. Den tidligere rå sorterings-/median-/kvartilimplementering er erstattet af den fælles rangvej; der findes ikke en konkurrerende vægtet kvartilalgoritme.

Ved nulbaseret rang r vælges den første kumulerede count, der er **større end r**, med `bisect_right`. En virtuel delmængdes median bruger én eller to sådanne rangplaceringer. Kvartiler bruger de to virtuelle halvdele med størrelse floor(n/2), og øvre halvdel starter ved floor(n/2)+n%2. Singletonreglen har sin eksplicitte gren. Alle n og rangplaceringer forbliver Python/SymPy-heltal.

Mean er Σ(h·x)/n. Varians er Σ(h·(x−mean)²)/(n−correction); den samme metode anvendes for rå og tabeller. Sample-wrapperne vælger stadig privat correction=1, population correction=0. Kvadratroden er fortsat SymPy's eksakte ikke-negative rod og den eksisterende ExpressionValue-repræsentation.

Arbejde/hukommelse følger inputrækkerne, de distinkte værdier og heltallenes bitlængde, ikke n ekspanderede elementer. Rangopslag er binære i antal forskellige værdier; ingen produktionskode ekspanderer counts eller løber n gange. Den lille ekspansion i testene er udelukkende en begrænset referenceoracle for sammenligning med rå observationskilder.

## Ændrede filer

Produktionsfiler i J:

- `src/python/evaluator/list_statistics.py`: fælles rå/tabel-kerne, eksakt ranglogik, validering af de to explicite signaturformer og strukturerede count-/længdediagnoser.
- `src/js/operations/selected-operation-catalog.js`: de ti OperationSpecs har nu to komplette signaturer. Evaluator-id'erne og unary betydning bevares.

Worker-dispatch fra I anvendes uændret i J; samme eksisterende gateway sender materialiserede inputs til samme handler. Ingen ændring af DocumentRuntime, compiler, parser/grammatik, gateway, Value-schema, renderer, persistens eller legacy. Ingen `weighted_*`-operationer.

Gamle katalogtests i S100b/e/f/g/h verificerer fortsat den oprindelige unary signatur, men forventer ikke længere, at den er den eneste. Deres andre assertions bevares. Den nye J-test verificerer det **fulde** præcise sæt med begge signaturer, ingen tredje form. Det er den godkendte API-udvidelse, ikke fjernede regressionskrav.

Nye J-beviser: `tests/python/test_p0017_frequency_statistics.py`, `tests/js/p0021-slice-100j-frequency-statistics.test.mjs`, `tests/helpers/s100j-frequency-statistics-cases.mjs`, browser `tests/browser/p0021-slice-100j-frequency-statistics.html` / `.mjs` og denne rapport. Kopier af de tre fælles produktionsfiler og de fem berørte katalogtests er bevaret i TEMP (`newcas-before-s100j-5mm78i2d`) fra GREEN I-checkpointet. Ingen rollback er udført.

## Eget RED → YELLOW → GREEN

Efter I's fulde GREEN og før J-produktionsændringer: **2 Node FAIL / 0 PASS** på manglende binær signatur og derfor afvist generisk compile. De ni nye Python-testmetoder kunne ikke passere den eksisterende unary-only handlerkontrakt (1 failure og 166 error-subcases i discovery). Dette er RED for den nye signatur, ikke bevis på en brudt rå-statistikvej.

YELLOW indførte den fælles kerne og to signaturer. To resterende fejl-subcases skyldtes, at testens tabel/rå-sammenligning krævede identiske sample-singleton-diagnoser: argumenterne er med vilje henholdsvis `counts` og `data`. Testen blev præciseret til at sammenligne alle success-Values fuldstændigt og kontrollere begge failure-kontrakter fuldstændigt. De nye producentkontrakter ovenfor blev bevaret.

Afsluttende udvidelse til store kvartilrande afdækkede desuden en recovery-fixture, hvor X var ændret til et nyt referencesæt, mens forventningen stadig brugte det gamle. Recovery-trinnet opstiller nu både X og H eksplicit igen. Ingen produktionsændring var nødvendig. Sidste browserkørsel med den ekstra regression er GREEN.

| Kontrol på endelig J-kode | Faktisk resultat |
| --- | --- |
| Fokuseret Node B/E/F/G/H/I/J, syv filer | 12 PASS, 0 FAIL/TODO/SKIP |
| Ny J-Python | 9 PASS, 0 FAIL/SKIP |
| Python E/F/G/H/I-regression | 36 PASS, 0 FAIL/SKIP |
| Fuld npm med `FORCE_COLOR=1` | 1718 JS PASS, 0 FAIL, 7 TODO, 1 SKIP, 0 cancelled (1726 tests); 318 Python PASS, 0 FAIL/SKIP; exit 0 |
| Rigtig browser J | 5 grupper PASS, 610 requests, 0 FAIL/TODO/SKIP |
| Rigtig browser E/F/G/H/I-regression | 20 grupper PASS, 338 requests, 0 FAIL/TODO/SKIP |
| Parser-sync og `git diff --check` | PASS |

Samlet browser: **25 grupper / 948 Worker-requests** på Chrome 155.0.8059.85, ChromeDriver 155.0.8059.84, eksisterende supervised module Worker, Pyodide v314.0.7 og SymPy. Node v24.11.0 / Python 3.12.4. Sidste fulde npm-kørsel omfatter den nye store-rang Python-regression; derefter blev kun browserens recovery-kildeopsætning rettet og browseren gentaget. Ingen produktionskode ændret siden fuld suite.

## Hvad de faktiske prøver beviser

- Tabellen X={2,3,5}, H={2,1,3} giver mean=11/3, populationsvarians=17/9, sample-varians=34/15, median=4, kvartiler [2,4,5] og femtalsresumé [2,2,4,5,5]. Eksakte rødder og tilbageleverede liste-Values gennem eksisterende transport består.
- Alle ti operationer sammenlignes med den tilsvarende rå liste for små, ekspanderbare eksempler. Browseren dækker n=1..9, de kendte n=7/8-referencecases, gentagne/usorterede værdier, nulcounts, eksakte decimaler/rationals, negative og store heltal. For singleton afvises sample stadig struktureret; øvrige singletonmål følger H.
- Samme navne X/H i andre opgaver forbliver isolerede. Redigering af både X's dokumentprovider og H invaliderer/genberegner de rigtige consumers. Tidligere X/H/resultat-Values er uændrede, og ListValue-elementer er frosne/roundtrippede. `median(quartiles(X,H))` beviser almindelig Value-genbrug.
- Counts **9007199254740993** pr. værdi fungerer gennem kildetekst/Worker. X={0,2} med H={h,h} giver mean=variance=standard_deviation=median=1 og sample-varians 18014398509481986/18014398509481985. Den eksakte sample-rod kvadreres gennem samme source/Worker-scalarvej og giver præcis sample-variansen.
- Huge ulige n: X={20,10,0}, H={h,1,h} giver median 10 og kvartiler [0,10,20]. Huge n deleligt med fire: X={0,2,4}, H={h,h,2h} giver kvartiler [1,3,4], hvor Q1/Q2 hver gennemsnitsdanner over en kumuleret rand. Ingen rang passerer en lossy Number-konvertering.
- Python kører alle ti operationer på enorme counts i en isoleret proces med **8 sekunders grænse**, så en ekspansionsimplementering fejler kontrolleret. Testen bestod også i den fulde suite.
- Negative/fractional/approx/nested/vector counts, tom/zero-total tabel, ugyldige observationer selv ved count=0, forskellige længder og sample-total<2 giver kontrollerede strukturerede diagnoser. Fejl efter H-kilderedigering rydder tidligere resultater og downstream, og en efterfølgende gyldig singletonkilde genopretter resultaterne.

```powershell
node --test tests/js/p0021-slice-100b-mean.test.mjs tests/js/p0021-slice-100e-statistics.test.mjs tests/js/p0021-slice-100f-sample-statistics.test.mjs tests/js/p0021-slice-100g-order-statistics.test.mjs tests/js/p0021-slice-100h-quartiles.test.mjs tests/js/p0021-slice-100i-frequencies.test.mjs tests/js/p0021-slice-100j-frequency-statistics.test.mjs
python -m unittest discover -s tests/python -p test_p0017_frequency_statistics.py
python -m unittest discover -s tests/python -p test_p0017_*statistics.py
python -m unittest discover -s tests/python -p test_p0017_quartiles.py
python -m unittest discover -s tests/python -p test_p0017_frequencies.py
npm test
node tools/build/generate_canonical_parser.mjs --check
git -c core.safecrlf=false diff --check
```

Python globben `test_p0017_*statistics.py` inkluderer også J's ni tests; de er ikke ni ekstra unikke tests oven i tabellen. Unique fokuseret Python-omfang er 45 tests. Browser: eksisterende runner med `--page tests/browser/p0021-slice-100j-frequency-statistics.html --result-variable s100jResult`, samme in-memory headless-testflags og TEMP-cache som I. Ingen fake Worker er eneste integrationsbevis. Ingen offline-accept eller komplet historisk browsermatrix påstås.

## Samlet Git-status og bevaring

Ingen staging, commit, push, reset eller clean. HEAD/branch er fortsat `bb0e05b` / `architecture-v1-implementation`; cached diff er tom. Slutstatus viser 7 modified tracked filer: de tre fælles produktionsfiler, B/E/F-katalogtests og den allerede eksisterende S91a-rettelse. Alle nye G/H/I/J-rapporter og fixtures er untracked; intet er staged.

`git diff --stat` mod HEAD (inklusive de bevarede G/H/S91a-ændringer): **7 tracked filer, 238 insertions / 41 deletions**. Untracked filer er ikke medregnet. Nye filer fra denne I/J-kørsel er præcis to rapporter og ti test-/fixturefiler. G/H-filer og rapporter er bevaret; G/H-katalogtests har den beskrevne tilladte signaturudvidelse.

`s100-testlog.txt` er urørt og har samme SHA-256 som ved start: `8D78411222EA9D9E123FD5794DA7E8DAF8133A35A332C5F22C1A2EE2BAFCEA18`. Checkpointmanifestet er uændret: `16572F49C22C9D73BB4E694A634E2666185602E0455E85BE0CAC80B559114BD6`. `chromedriver/` og `se-metadata.json` er ikke rørt. Syv eksisterende TODO og én Windows-symlink-SKIP består med uændret status. Parseren er synkron og er ikke ændret/regenereret.

## Anbefalet næste fase: kontrakt for intervalgrupperede data

Før en ny implementeringsslice bør en lille eksplicit kontrakt skelne **rå observationer**, **diskrete faktiske værdier med counts** og **intervalgrupperede observationer**. Beslut intervalrepræsentation/lukkede-åbne grænser, counts, eventuelle repræsentative værdier, metodeidentitet og estimatstatus. Klassemidtpunkter må ikke implicit blive til faktisk observerede værdier eller extrema.

Den vægtede aritmetik kan genbruges privat til momentestimater, men datagrundlag/metode skal følge resultatet. Eksakt rational aritmetik gør ikke et midpoint-estimat til en eksakt observeret statistisk sandhed. Grupperet median/kvartiler kræver en særskilt godkendt interpolationsmetode med rand-/degenerationsregler; den diskrete rangværdi må ikke stiltiende bruges som grupperet estimat.

Faktisk observeret min/max er ukendt alene ud fra klasseintervaller. Forsøg skal senere give strukturerede sprog-uafhængige diagnoser; danske tekster/i18n tilhører præsentationen. Grupperede medianer/kvartiler skal tydeligt mærkes som estimater. En fremtidig StatisticsValue kan bære datagrundlag, metode og eksakthed, men typen/versionen skal kontraktfastlægges separat; den indføres ikke her. Ingen grafik, Plotly, histogrammer eller sumkurver er implementeret.

Ingen åben backend-/matematikgate for S100i/j. Den særskilte UI-gate for ListValue-visning består. Intervalgrupperet statistik, elev-UI, offline-pakning og normativ releaseaccept er fremtidige opgaver.
