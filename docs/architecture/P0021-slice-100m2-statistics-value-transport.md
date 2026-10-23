# S100m2 — Value v2 gennem Worker/Pyodide og DocumentRuntime

**Status: GREEN for den afgrænsede M2-transport-/runtimeaccept.**
23. oktober 2026. Branch `architecture-v1-implementation`, checkpoint `8d217e36f4325804ce676323e2156c8467b3caf3` (brugerens S100m1-checkpoint). Ved start var kun chromedriver, testlog, se-metadata og checkpoint-allowlist untracked. Ingen staging, commit, push, reset eller clean er udført.

## Kontrakt og implementering

Den accepterede [P0005 v2-kontrakt](P0005-value-v2-statistics-contract.md) og ADR-0008 anvendes gennem de eksisterende P0010-/selected-grænser. P0010 request/outcome-versioner, Worker-protokol, felter og korrelation er bevaret; statistikmetadata findes alene inde i Value. Der er ingen ny evaluator, grouped-konstruktør, matematisk statistikmetode eller transport-sidecar.

Host/Worker/direct Pyodide validerer de **faktiske** provider-Values og request.inputs, før v2-træer kopieres til JSON. Options/instruction bliver ikke rekursivt fortolket som Values. Worker-protokollen ejer routing/correlation; Python-gatewayen kontrollerer den fulde P0010-request før handleren.

Python-gatewayen genbruger M1-codecen til begge inputfelter og success.value. Immutable Python-records bliver eksplicit encoded og decoded til almindelige JSON-data; de sendes ikke som nye backendobjekter. Den eksisterende selected list vælger v1 for tomme/rent-v1-inputs og v2, når mindst ét direkte input er v2. ListV2-former nedgraderes ikke.

Ukendte velformede metode-id'er transporteres opakt uden opslag/eksekvering. Klassegrænser, endpointflags, nulcounts, store counts, statusakser, assumptions og rekursiv provenance bevares. Shape-valid ugyldig partition transporteres uden en matematisk attest. List/statistik er ikke blevet et SetValue eller scalar.

`list_statistics._exact_list` accepterer nu versionsmærkning 1/2 for samme ListValue-domæne. Numeriske elementer er fortsat v1 integer/rational ExpressionValues. Dette tillader kontrolleret afvisning af ListV2 med statistikwrapper-elementer og bevarer eksisterende beregning for en ListV2 med almindelige eksakte scalars. Ingen payloadprojektion eller anden statistikberegning er tilføjet. SympyValueAdapter er uændret.

## Præcis filafgrænsning

| Produktionsfil | Ændring |
| --- | --- |
| `src/js/evaluation/worker-evaluation-protocol.js` | Delte typed snapshots; host/Worker-inputvalidering, trusted codec-failure og budgetteret response-rehydrering før Value-JSON-kopiering. Eksisterende supervisor og korrelationsværn bevares. |
| `src/js/evaluation/selected-pyodide-runtime.js` | Installerer eksisterende Python-codec fra samme origin; bruger den delte Value-snapshotfunktion før Pyodide-init/dispatch. Handlerallowlist og Python-entry bevares. |
| `src/python/evaluator/selected_gateway_bridge.py` | Typed input/provider/output-grænser, præcise P0010-felter og eksplicit codec-encoding. |
| `src/python/evaluator/container_list.py` | Union-validering og v1/v2-producentvalg; samlet v2-output over budget afvises med eksisterende codecdiagnose. |
| `src/python/evaluator/list_statistics.py` | Én versionsgate ændret til 1/2; elementdomæne og matematik uændret. |
| `src/js/values/value.js` | Generel `rehydrateValue` for materialiseret ingress, som genbruger codecen før ekspanderende JSON. |
| `src/js/values/statistics-value.js` | Eksisterende codec-exception gjort til `ValueCodecError extends TypeError`, så kun trusted codecfejl genkendes; samme P0009-diagnose. |
| `src/python/adapters/statistics_value_adapter.py` | Generel `materialize_value` genbruger den eksisterende snapshot/validator; ingen parallel codec. |

Permanente leverancer: `tests/js/p0005-statistics-value-transport.test.mjs` (11 tests), `tests/js/p0005-statistics-runtime-publication.test.mjs` (2 tests), `tests/python/test_statistics_value_transport.py` (35 tests), `tests/helpers/s100m2-transport-cases.mjs`, `tests/browser/p0005-statistics-value-roundtrip.html` / `.mjs` og denne rapport.

To eksisterende JS-testallowlists er udvidet med præcis codecfilen: `p0021-selected-angle-unit.test.mjs` og `p0021-selected-pyodide-runtime.test.mjs`. I `test_p0021_selected_gateway_bridge.py` er gamle versionløse mock-Values erstattet med gyldige v1-Values. Nonportable provider testes nu som typed codec-failure uden handlerkald; de øvrige gatewaykrav er bevaret. Ingen TODO/SKIP er ændret.

## RED → YELLOW → GREEN

- Før produktion: JS transport **8 tests: 3 PASS/5 FAIL**; runtime **2 tests: 1 PASS/1 FAIL**; Python **32 tests: 3 PASS/1 FAIL/28 ERROR**. Fejlene dokumenterede manglende typed grænser, codec-bootstrap og v2-listesti. Runtimes eksisterende batchværn mod malformed success bestod allerede.
- Reel browser-RED: Pyodide indlæste SymPy og fejlede efter **1 Worker-kald**, fordi den gamle container_list afviste v2. Første Chrome-start havde tab-crash; et nyt lokalt headless-testforløb med `--no-sandbox --disable-dev-shm-usage` kørte. Ingen produktionsbrowserindstillinger er ændret.
- YELLOW: den nye transport og runtime blev grøn. Bred regression viste, at routingvalidering ikke skulle flyttes ind i direct Pyodide-entryens evaluator-/optionskontrakt. Delte helpers validerer typed felter; routing bliver i de eksisterende protokol-/gatewaylag. Desuden opdateredes de to præcise filallowlists og gatewayens gamle mock-Values.
- Endelig GREEN: yderligere negative tests dækker oversized response, arbitrary backend-exceptions, direkte Pyodide-ingress, v2 i v1-containere og et samlet list-output over det accepterede bytebudget.

| Endelig kørsel | Faktisk resultat |
| --- | --- |
| M2 Node-suites | **13 PASS**, ingen FAIL/TODO/SKIP (indgår i regressionerne nedenfor). |
| Selected runtime/evaluator-regression + M2 | **74 PASS**, 0 FAIL. |
| Value/P0010/Worker/DocumentRuntime/M1/M2-grænser | **161 PASS**, 0 FAIL/TODO/SKIP. |
| Python M2-transport | **35 PASS**. |
| Eksisterende Python-gatewayregression | **14 PASS**. |
| Parser-sync | **5 PASS**, ingen parserregenerering. |
| Fuld `npm test`, Node 24.11.0 | **1794 tests: 1786 PASS, 0 FAIL, 7 TODO, 1 SKIP, 0 cancelled**. |
| Fuld `npm test`, Python 3.12.4 | **400 PASS**, 0 FAIL/SKIP. Kommandoen exit 0. |

Fuld GREEN-log i systemets tempmappe: `newcas-s100m2-full-green-18035fd9-fa25-4249-a87e-29eb118c9f28.txt`. Brugerens `s100-testlog.txt` er bevaret.

## Rigtig browser / Worker / Pyodide / SymPy

Chrome **155.0.8059.85**, ChromeDriver **155.0.8059.84**, produktions-module-Worker `selected-pyodide-worker.js`, eksisterende CDN-Pyodide **v314.0.7** og den faktisk indlæste SymPy-pakke. Testklienten bruger samme eksisterende supervision som S100k: timeout 180000 ms, maxPending 1. Dette er netværksunderstøttet accept, ikke offline cold-start eller en fuld browsermatrix.

Ny M2-side: **30 grupper PASS, 0 FAIL, 106 Worker-kald**:

- **23 fixturegrupper / 46 list-kald:** hver Value ud/retur og den returnerede Value som næste input. Omfatter begge statistikvarianter, alle ListV2-former, alle statuskombinationer, canonical bytes/deep freeze, komplette tidligere resultater/typed parametre, ukendt metode, danske flag/eksplicit første [0;10], nulcounts og counts >2^53. Også alle eksisterende v1-payloadfamilier og Unicode/dimensionsmetadata roundtripper.
- **2** yderligere v1-only/empty list-kald og **1** transport af shape-valid ugyldig partition.
- **48** kontrollerede afvisninger: scalar-addition og alle 15 eksisterende diskrete statistikoperationer på grouped-data, statistical-result og en liste af resultater. Ingen unwraps; eksisterende type-mismatch/actualKind bevares.
- **1 egentlig SymPy-beregning:** eksisterende selected power beregner `sqrt(409/4)` og returnerer præcis `sqrt(409)/2`, sammenlignet med eksisterende ExpressionValue-encoding. Dette er adskilt fra fixturetransporten.
- **8** list-kald i runtimeforløbet nedenfor, grupperet i 3 runtimebeviser.

Endelig M2-browserlog i temp: `newcas-s100m2-browser-green-f920918d-eb02-47a2-a682-74bb44a2f1b9.txt`.

Den eksisterende samlede **S100e–k**-browserside bestod desuden **29 grupper / 1161 Worker-kald**, 0 FAIL/TODO/SKIP. Fordeling: E 4/40, F 4/37, G 4/81, H 4/87, I 4/93, J 5/610, K 4/213 (grupper/kald). Den dækker reel matematik, eksakte rødder/rationaler/store counts, failurediagnoser og kildegenberegning. S100h's allerede kendte ListValue-præsentationsgate er stadig `PRESENTATION_UNSUPPORTED_VALUE`; renderer er ikke ændret.

Browserforløbene bruger eksisterende `tools/dev/run-s96b2-browser.py` med `--page`/`--result-variable`, eksisterende driver angivet gennem `SE_CHROMEDRIVER`, og Selenium-cache i temp. De to lokale Chrome-testflags blev tilføjet via en midlertidig runpy-wrapper; runner, driver og se-metadata er ikke ændret. Ingen fake Worker bruges som eneste integrationsbevis.

## DocumentRuntime-beviser uden særregler

Den eksisterende `createValueEvaluator` bygger envelopes med runtime-ejede providerbindings og eksplicitte revisioner. Rootdata er **allerede materialiserede testfixtures**, ikke en ny elevkonstruktør eller en fortolkning af kildetal som grouped-data. En transient map inden for den aktuelle batch leverer de samme provider-outcomes som den eksisterende gateway; DocumentRuntime er fortsat eneste autoritet/cache.

Forløbet publicerer en fuld standalone StatisticsValue som writer A, sender den via providerbinding til selected list og genbruger resultatet downstream i endnu et list-kald. Efter redigering ryddes downstream-resultater, dirty-status og øget calculation generation kontrolleres, og nye fixturedata beregnes gennem Worker. Tidligere immutable snapshots samt en anden task med sit eget A forbliver uændrede.

En faktisk Worker-respons holdes tilbage på hosten, mens kilden ændres igen. Runtime afviser hele det gamle forløb med **kind `stale`**, selv om backendresultatet var succesfuldt; ingen gammel delbatch publiceres. Næste generation beregnes korrekt. Derudover afviser den permanente Node-test et helt malformed success-batch, før noget publiceres. DocumentRuntime-koden er uændret.

## Transport-/ressourceaudit og åbne gates

De accepterede v2-budgetter **128 / 100.000 / 8 MiB** og P0009-parametre er bevaret. Object-ingress kontrolleres før ekspanderende v2-JSON-kopiering; Worker-hostens responsegrænse rehydrerer før Value-snapshot. Python-containerens samlede ListV2-output er også budgetteret. Top-level v1 bevarer sin gamle kontrakt/budgetundtagelse.

Trusted inputfejl genkendes ved codec-exceptiontypen, ikke fejltekst. De går gennem almindelig failure/Diagnostic. Vilkårlige backend-exceptions bliver ikke omklassificeret til codecfejl. En dårlig Python-handler-success afvises som intern GatewayContractError; en dårlig/ukendt **encoded Worker-response-Value** afvises på hosten med eksisterende **INVALID_WORKER_VALUE og nul parametre**, uden publicering. Ukendt velformet metode er ingen transportfejl.

**OPEN generel ingress-/releasegate:** browserens structured-clone/message-allokering sker før modtagerens Value-check. Flere individuelt gyldige Values og vilkårlig transport-safe options/metadata har ikke et samlet message-/JSON-bytebudget. Python-entryens JSON-parse af den samlede payload er heller ikke erstattet med en ny messageparser. Eksisterende maxPending og Worker-timeout begrænser samtidighed/levetid, ikke allerede allokeret hovedtråds-RAM. Codecgrænser kan derfor ikke bruges som bevis for sikker modtagelse af vilkårligt store beskeder. En eventuel ny generel ingress-/aggregate-politik kræver målinger, producentkontrakt og særskilt accept; der er **ikke** valgt et nyt tal eller indført schemafelter her. Dette er en særskilt kapacitets-/releasegate, ikke en skjult Value-version eller en påstået lukning af v1's gamle ressourcerisiko.

Ingen ny normativ konflikt blev nødvendig for selve den accepterede typed transport. Matematiske grouped-producenter, dokumentprofil/syntax/persistens, yderklasser og renderer forbliver separate gates.

## Git og næste lille slice

`git status --short`, `git diff --check` og `git diff --stat` kontrolleres ved aflevering. Tracked diff omfatter kun de 8 produktionsfiler og 3 eksisterende testfiler ovenfor; nye test-/browser-/helperfiler og denne rapport er untracked og kontrolleres separat. Ingen FROZEN-, ADR-, parser-, P0005/P0010-, SymPy-adapter- eller DocumentRuntime-ændring. S100m1-rapporten er bevaret. SHA-256 for chromedriver, se-metadata, brugerens testlog og checkpoint-allowlist er uændret.

**Anbefalet næste udviklingsslice: S100n1, grouped-data-producentkontrakt.** Fastlæg den eksplicitte selected konstruktørs signatur/typed klasseinput, finite-rational-domæne, partition/width/overlap/gap/shared-endpoint-regler og konkrete eksisterende/nødvendige P0009-producenter. RED bør dække total=0, lower>=upper, nulklasser, usorterede men parrede records, store counts uden ekspansion og ingen falske faktiske extrema. Først efter accept implementeres den autoritative matematiske validering i eksisterende Python/SymPy-vej; metode A kommer i en efterfølgende afgrænset slice. Ingen parser, profil eller UI nødvendig. Generel Worker-ingresspolitik skal lukkes særskilt før releasepåstande.
