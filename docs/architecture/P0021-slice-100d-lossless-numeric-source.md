# S100d — tabsløs numerisk kildeoversættelse

22. oktober 2026. Informativ slice-rapport. Semantikafklaring skrevet før implementering; testbeviser følger nedenfor.

## Afklaring før ændring

FROZEN kræver eksakte matematiske Values uafhængigt af visningsafrunding. P0005 har allerede integer, rational og eksplicit approx; P0007 bærer disse som valueLiteral. P0011's numeric-transport-decision kræver, at approx bevarer sin egen approximation og precisionBits; den må ikke genfortolkes som et eksakt rational.

Denne slice indfører derfor følgende kildeoversættelse i den valgte motor: et finit punkt-decimalliteral er et eksakt rational (fx 0.1 = 1/10), et heltalsliteral er et eksakt heltal, og minus er fortsat eksisterende UnaryExpression. Decimalliteraler var hidtil afvist af selected lowering, så dette ændrer ikke en tidligere understøttet selected decimalbetydning. Eksisterende approx-Values og deres 53-bit-default/precisionBits ændres ikke. Der indføres ingen ny taltype, approximation-inputsyntaks eller måleusikkerhedsbetydning. Statistikoperationers inputdomæner udvides ikke automatisk.

Peggy AST bevarer nu det eksakte `raw`-lexeme sammen med det gamle numeriske `value`-felt. `raw` er autoritativt for selected numerisk lowering; `value` er alene en kompatibilitetsprojektion for eksisterende parserforbrugere/legacy og kan være afrundet. Ingen selected matematisk værdi må genskabes fra denne projektion, når raw findes. Ældre internt håndbyggede AST'er uden raw beholder kun den hidtidige safe-integer-vej; et allerede afrundet stort Number kan ikke reddes ved at gætte.

Lexeme→integer/rational er en ren kodningskonvertering med BigInt-strenge og positiv potens-af-ti-nævner, normaliseret til reduceret rational/integer. Den introducerer ingen evaluator, kilde-scope eller backend-parser.

Det er en additiv parser-AST-oplysning og ny selected capability inden for eksisterende Value/IR-kontrakter. Ingen ændring af FROZEN/accepted ADR eller nyt P0005-schema er nødvendig. Dette er ikke en `.ncas`-migration eller accept af historisk dokumentgenberegning: fremtidig student/persistens-cutover skal fortsat versionere sprog/motor og respektere Submitted Snapshot efter ADR-0005/S99. Legacy-projektionen og eksisterende approx-payloads bevarer deres hidtidige betydning.

Decimalpunkt, komma/semikolon som argumentseparatorer, liste-/vektornotation, scientific notation og unary/præcedensregler ændres ikke. Quantity får også raw-information, men dens selected evaluator er stadig uden for denne slice.

## Ændringer og RED → GREEN

RED før produktionsændring: **0 PASS / 3 FAIL**, ingen TODO/SKIP, i `tests/js/p0021-slice-100d-numeric-source.test.mjs`. Fejlene var manglende raw, afvist stort heltal og forkert/manglende numerisk dokumentresultat.

YELLOW etablerede raw-information, fælles eksakt lowering og derefter scalar-/FunctionValue-ruten. De tre fokuserede tests blev GREEN. Regressionen afdækkede tests, der havde brugt en parse-valid decimal som eksempel på en unsupported kilde; de bruger nu en fortsat unsupported Quantity. Fejl-/fallback-assertions er bevaret, og den nye reelle backendtest verificerer positiv decimaladfærd. En test for håndbygget fractional Number uden raw er omdøbt for at beskrive den fortsat gældende afvisning korrekt.

Produktionsfiler oven på S100c:

- `docs/Grammatik.pegjs`: raw på Literal/Quantity, numerisk value kun kompatibilitetsprojektion. Accepteret token- og separatorgrammatik er uændret.
- `src/js/parser.mjs`: **udelukkende regenereret** med `node tools/build/generate_canonical_parser.mjs --write`, ingen håndredigering.
- `src/js/semantics/lower-source-expression-tree.js`: sender raw til den fælles literal-lowering.
- `src/js/semantics/lower-selected-arithmetic.js`: eksakt lexeme→integer/rational med BigInt; safe-integer-fallback kun ved ældre AST uden raw.
- `src/js/semantics/create-runtime-function-batch-evaluator.js`: standalone Literal/Unary/Binary/Power følger eksisterende attesterede expression-route.
- `src/js/semantics/evaluate-selected-function-application.js`: eksisterende rational/approx-blade kan passere function-expression-evaluering; øvrige arithmetic-operationer bruger samme selected backend.

Tests: ny Node-fil ovenfor, `tests/helpers/s100d-numeric-source-cases.mjs`, browserfixture `tests/browser/p0021-slice-100d-numeric-source.html` / `.mjs`. Eksisterende parser-shape-test, route-audit, tre negative runtime-fixtures og én intern AST-testtitel er opdateret til det præcise udvidede kontraktomfang. Ingen ændring af Value-schema, adapter, Python-handler, Worker-protokol, mean-domæne, FROZEN eller ADR.

## Testbeviser

Node v24.11.0, Python 3.12.4. Sidste kode-/testændring er dækket af følgende faktiske kørsler:

| Kørsel | Resultat |
| --- | --- |
| Ny numerisk Node-testfil | 3 PASS / 0 FAIL / 0 TODO / 0 SKIP |
| Fokuseret regression, 12 filer nedenfor | 68 PASS / 0 FAIL / 0 TODO / 0 SKIP / 0 cancelled |
| Fuld `npm test` | 1708 JS PASS / 0 FAIL / 7 TODO / 1 SKIP / 0 cancelled (1716 tests); 273 Python PASS / 0 FAIL / 0 SKIP; exit 0 |
| Parser `--check` efter regenerering | PASS |
| Rigtig Chrome/Worker/Pyodide/SymPy | 4 grupper PASS / 0 FAIL / 0 TODO / 0 SKIP; 28 Worker-requests |

Browser: Chrome 155.0.8059.85, ChromeDriver 155.0.8059.84, eksisterende produktions-module Worker, Pyodide-URL v314.0.7 og loadPackage('sympy'). Samme testflags/cache/runner som dokumenteret i S100b. Sidste browserkørsel omfattede også den fulde kildekæde `{9007199254740993,9007199254740995}` → mean = 9007199254740994. Desktopintegration bruger reelle Python-handlers og statisk produktionsbootstrap med test-double for loader/FS; den tælles ikke som browseraccept.

De fire grupper verificerer:

1. Kilde → AST/IR/Value → backend/retur for store positive/negative heltal, 0.1, 0.2, den 29-cifrede decimal, 1/3, 0.1+0.2, stort heltal+1, 0002.500 og -0.1. Hvert assignments resultat anvendes i en `+0`-consumer, så selv et rent literal kontrolleres over den faktiske Worker/SymPy-grænse.
2. Standalone scalarudtryk, blandet liste med alle de krævede taltyper og eksakt stort-heltals-mean gennem kildelister.
3. Decimal-provider, invalidering efter kilderedigering og eksakt genberegning; f(t):=t+0.1 / f(0.2) = 3/10 gennem den eksisterende FunctionValue-route.
4. Mean af en liste med ikke-integer-elementer er stadig afvist før S100e; en eksplicit approx-Value med 53-bit præcision forbliver approx gennem addition i samme backend.

Den eksisterende F8 literaltekst-probe består nu, men dens TODO-markering er **bevaret** efter brugerens instruktion. Syv TODO og én Windows real-symlink-SKIP er stadig synlige i suiteoptællingen. De øvrige kendte TODO er ikke løst her. Ingen offline cold-start, student-UI-accept eller fuld historisk browsermatrix er påstået.

Reproducerbare kommandoer:

```powershell
node --test tests/js/p0021-slice-100d-numeric-source.test.mjs
node --test --test-reporter=tap tests/js/p0021-slice-100d-numeric-source.test.mjs tests/js/p0021-slice-100c-source-lists.test.mjs tests/js/p0018-canonical-decimal-unit.test.mjs tests/js/p0021-slice-88a-canonical-parser-sync.test.mjs tests/js/p0021-slice-91a-parser-packrat.test.mjs tests/js/p0021-slice-93a-shared-arithmetic-lowering.test.mjs tests/js/p0021-slice-93b-shared-expression-traversal.test.mjs tests/js/p0021-runtime-function-batch-integration.test.mjs tests/js/p0021-runtime-variable-function-batch.test.mjs tests/js/p0021-runtime-selective-function-recomputation.test.mjs tests/js/p0011-numeric-precision-value.test.mjs tests/js/p0021-evaluator-route-audit.test.mjs
npm test
node tools/build/generate_canonical_parser.mjs --check
```

Browserkommando: S100b-rapportens in-memory runner med `--page tests/browser/p0021-slice-100d-numeric-source.html --result-variable s100dResult`. Testflags og produktionskode er holdt adskilt. Ingen store testlogs er skrevet til repoet.

## Anbefalet S100e

Én afgrænset statistik-slice: udvid `mean` til ikke-tomme ListValues af **eksakte integer/rational-ExpressionValues**, inklusive S100d's finite decimaler; tilføj `variance` og `standard_deviation` med ét almindeligt value-argument og **populationsdefinitionen med divisor n**. Ingen skjult n-1-konvention eller options/default-ændring.

Brug samme validerede eksakte observationsdata og samme selected Worker/SymPy-vej. Varians er summen af kvadrerede afvigelser divideret med n; standardafvigelse er den eksakte ikke-negative kvadratrod, repræsenteret med eksisterende ExpressionValue-aritmetik/Pow, eventuelt irrationelt. Ingen konvertering til float. Approx/symbolske elementer er uden for denne første udvidelse og får kontrollerede diagnoser; input forbliver immutable, og rækkefølge/gentagelser bevares.

Acceptforslag før GREEN: mean({1/3,2/3})=1/2; {0.1,0.2} giver mean 3/20, populationsvarians 1/400 og standardafvigelse 1/20; {1,2,3} giver varians 2/3 og eksakt sqrt(2/3), ikke stikprøvevarians 1; singleton giver varians/std 0; tomme/vektor/approx-input afvises. Verificér også kildeændring og genberegning i rigtig Worker. Fastlæg konkrete operation-/diagnoseproducenter før RED og bevar de eksisterende P0005/P0007/P0010-former.

## Git og udeståender

S100a/S100b-rapporter og deres eksisterende kode er bevaret. Ingen staging, commit, push, reset eller clean. Endelig status/statistik er kumulativ oven på det ucommittede S100b; nye filer vises ikke i almindelig `git diff --stat`. Endelige `git diff --check`, status, parser-sync og HEAD kontrolleres særskilt ved aflevering.

Afsluttende kontrol: branch `architecture-v1-implementation`, HEAD fortsat `5455a06cf209da2b358bce2841fcda0fd3653cec`; `git diff --check` exit 0, parser-sync PASS, cached diff tom. `git diff --stat`: 20 tracked filer, 82 insertions / 28 deletions. Status viser desuden 20 untracked stier (inklusive de 9, der allerede fandtes ved start); untracked tilføjelser er ikke med i diff-statistikken. Git oplyser kun senere LF→CRLF-normalisering, ingen whitespace-fejl.

Legacy's numeriske AST-projektion kan stadig være lossy og er ikke en ny autoritativ vej. Approximation fra målte data, scientific notation, Quantity-evaluator, endelig elevnotation, persistensversionering/migration, student-release, plots og den generelle normativmatrix er fortsat særskilte gates.
