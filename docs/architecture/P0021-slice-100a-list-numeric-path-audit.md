# S100a — audit af liste- og talvejen

Dato: 22. oktober 2026. Informativ audit, ikke ADR, implementeringsordre eller releaseaccept.
Basis: branch `architecture-v1-implementation`, HEAD `5455a06cf209da2b358bce2841fcda0fd3653cec`.
`git merge-base --is-ancestor 5455a06 HEAD` returnerede 0. Ingen tracked eller staged ændringer før auditten; kun de urørte `chromedriver/` og `se-metadata.json` var untracked.

## Konklusion

**Delvist:** Eksisterende P0005/P0007/P0010 kan repræsentere og transportere en `ListValue` og et eksakt middelværdiresultat som almindelig `ExpressionValue`. En ny Value-kind/version eller ændring af FROZEN er ikke påvist nødvendig for en intern, heltalsafgrænset `mean`.

Den samlede elevvej virker derimod ikke: AST-listen bliver ikke oversat til selected IR; `mean` er ikke valgt/registreret i den undersøgte motor; Worker har ingen mean-handler; den semantiske renderer viser ikke lister. Før implementering skal en konkret P0008-operation/signatur og dens input-/diagnosekontrakt besluttes. S99 er et designmål og leverer ikke denne godkendelse. Der er derfor **ingen ny RED-testfil og ingen GREEN-implementering** i S100a.

## Autoritet og kontraktfund

Læsning omfattede S99_KONTRAKTUDKAST r2, S99_CLAUDE_REVIEW_DISPOSITION, ROADMAP_AKTUEL, P0005/P0007/P0008/P0009/P0010 og de relevante FROZEN-afsnit, stress-test 49 og review-resolution §2.10. Accepted ADR-0004/-0006 styrer dokumentejerskab, positionel binding og invalidering; ingen ny dokumentsemantik foreslås.

- FROZEN §15 viser `[1,2] -> ListValue`, men siger ved linje 636, at endelig stavemåde er et grammatikvalg indtil grammatikfrysning. Review-resolution linje 261 siger tilsvarende. Den aktuelle PEG siger `{…}` liste og `[…]` vektor. Forskellen er reel, men er **ikke alene bevis på et normativt semantikbrud**. Elevstavemåde skal afklares før en kildebaseret statistik-slice; ingen automatisk omlægning eller List→Vector-konvertering.
- P0005 §9 kræver ordnede Values og skelner List/Vector/Matrix. P0007 tillader containerkonstruktion via almindelig `call` og allerede materialiseret liste via `valueLiteral`; et særligt liste-IR-nodeformat er ikke nødvendigt.
- P0008 kan udtrykke ét almindeligt `value`-argument. En konkret `mean`-spec findes ikke i selected-kataloget. At schemaet kan beskrive en operation er ikke en godkendt operation eller implementeret capability.
- P0009 kræver strukturerede, locale-uafhængige diagnoser; præcis producentkontrakt skal vælges før negative mean-tests. S100a opfinder ingen koder.
- P0010 kan bære listen som input og skalarresultatet som output uden dokumentautoritet. Ingen `StatisticsValue` er nødvendig for denne første operation; S99's ønske om senere rige statistikresultater består.
- Roadmap/handover indeholder historiske statusfelter; deres checkpointdato/HEAD og browserantal er ikke brugt som nye kørselsbeviser.

## Evidenstabel

Testhenvisninger nedenfor blev kørt i auditten. Ad hoc-prober blev kørt via PowerShell here-string til `node --input-type=module`; de er observationer, ikke permanente testcases eller browseraccept.

| Led | Status | Kilde og faktisk evidens | Manglende arbejde |
| --- | --- | --- | --- |
| Source → Peggy AST | DELVIST | `docs/Grammatik.pegjs:101,115–127`; genereret `src/js/parser.mjs:271,1873,1926`. Kørt `p0018-canonical-decimal-unit` og `p0021-slice-88a-canonical-parser-sync`. Prober: `{}` er tom List; `[]` tom Vector; både `{2,4}` og `{2;4}` er List. | Beslut fremtidig kanonisk elevstavemåde og præcisionspolitik; ingen grammatikændring udført. |
| Tal/fortegn i AST | DELVIST | PEG Unary/Number; probe `{-2,-4}` giver UnaryExpression, `{+2}` afvises. `0.12345678901234567890123456789` bliver `0.12345678901234568`; `9007199254740993` bliver `9007199254740992`. `{0,1}` er to elementer; `{1e3}` bliver `1*e3`. | Lexeme mangler. Punktdecimal accepteres syntaktisk, men giver ikke eksakt decimalrepræsentation. Dansk komma/scientific notation er åbne gates. |
| AST → kilde-/scopeanalyse | VERIFICERET for undersøgte tilfælde | `derive-block-source-bindings.js:47` besøger hvert listeelement; `analyze-source-blocks.js` / `derive-source-semantic-snapshot.js` etablerer writers og bindinger. Kørt `p0020-peg-parser-writers`, `p0020-derived-semantic-snapshot`, S98a total-source-analysis. Probe med `n:=2`, `A:={n,4,n}`, `B:=A`: A binder n's writer, B binder A's writer; anden opgave får frit symbol, ikke provider fra første opgave. | Dette analyserer referencer; det beregner endnu ikke elementernes matematiske Values. |
| AST → selected Semantic IR | MANGLER for listekonstruktion | `lower-source-expression-tree.js` har ingen List/Vector-case; begge compilerveje bruger traversalen. `compile-attested-document-expression-ir.js` afviser den attesterede A med `unsupported node type List`. Kørt S93a/S93b shared lowering/traversal. | Oversæt elementudtryk og konstruér eksplicit ListValue gennem valgt operation. Intern `valueLiteral(list(...))` virker allerede, men er ikke kildekompilering. |
| ListValue/eksakte tal internt | VERIFICERET ved Value-grænsen | `values/value.js:240,318,337,344`; kørt `value-contract`, `p0011-numeric-precision-value`. Probe bevarer `[4,2,4,7/3,9007199254740993]` gennem encode/decode med frosne elementer og eksplicit listekind, forskellig fra vector. | Value-konstruktøren evaluerer ikke AST-udtryk. Kildens allerede tabte cifre kan ikke genskabes her. |
| Operation/selected evaluator | MANGLER; konkret mean-kontrakt KONTRAKTBLOKERET før RED | `operations/selected-operation-catalog.js` har ingen mean; `findSelectedOperationSpec('mean')` er null. `compileSelectedSourceAst(parse('mean(2)'), {specs:new Map()})` afvises som unselected. `selected-pyodide-runtime.js` vælger scalar/diff-handlers, ingen lister/statistik. | Beslut og tilføj konkret spec, handler og dispatch. Legacy `cas_math/registry.py:76` og `statistics.py:21` er ikke selected evidens og må ikke være fallback. |
| Andre listeoperationer i Python | DELVIST | `evaluator/system_solving.py:13` modtager ListValues med ligninger/targets; `test_p0012_system_solving_red.py`: 10 PASS. `sympy_value_adapter.py:55` accepterer kun ExpressionValue direkte. | Solve-system er en isoleret handler, ikke indlæst i den aktuelle Worker-allowlist. Det viser ikke en generel kilde→liste- eller statistikvej. ListValue må ikke sendes direkte til scalar-adapteren som om det var en expression. |
| P0010/Worker/rehydrering | DELVIST | `evaluator/evaluation-contract.js`, `evaluation/worker-evaluation-protocol.js`; kørt evaluation-contract, worker-protocol, worker-value-rehydration, shared-worker-value-boundary. Probe accepterer ListValue i P0010 input/output og IR valueLiteral; simuleret structuredClone-resultat gennem faktisk Worker-client rehydreres til frossen ListValue. | Transportproben bruger fake Worker. Ingen virkelig Worker/Pyodide/SymPy-liste/mean-browserkørsel i S100a. |
| Resultat → DocumentRuntime/reactivitet | DELVIST | Kørt runtime-semantic-reactive-invalidation. Probe gennem `createRuntimeFunctionBatchEvaluator` og semantic DocumentRuntime: n lykkes, A fejler ved List-node, B/mean får UPSTREAM_FAILED; 0 backendkald. Efter kildeændring A er B/mean dirty, generation øget. | Ingen vellykket listemiddelværdi at genberegne. Invalidering er ikke bevis på fungerende genberegning. Den observerede List-fejl er EVALUATOR_ERROR med intern tekst; fremtidig capability-fejl skal have kontrolleret diagnose. |
| Test-UI/præsentation | MANGLER for listevisning | `tests/browser/p0021-slice-95f-dynamic-document.mjs:32` vælger add/multiply/power; `renderer.js:74` afviser ikke-expression/function. Probe med gyldig liste giver PRESENTATION_UNSUPPORTED_VALUE. Kørt S95g renderer-projektionstests. | Ingen listevisning eller mean-UI-browseraccept. Renderer kan allerede vise heltal og rationalskalar, når resultatet findes. |
| Grundlag for senere grafer | DELVIST | Ordnet AST og Value-items bevarer rækkefølge/gentagelser i proberne; Value bevarer eksakte heltal/brøker. Ingen sortering/aggregering i list-konstruktør. | End-to-end data og decimallexeme mangler. Klassegrænser, hyppighedsbetydning og estimatmetadata er fremtidige kontrakter. Ingen plots implementeret. |

## Anbefalet S100b — én GREEN-milepæl

**Intern, eksakt heltalsmiddelværdi: en allerede materialiseret, ikke-tom ListValue af integer-ExpressionValues gennem den eksisterende selected evaluator/Worker til integer/rational ExpressionValue.** Ingen parser-, kildebindings-, dokument-, UI- eller plotimplementering i denne milepæl.

Beslut først en lille operationskontrakt: public operation-id `mean`, ét `value`-argument, ren operation, konkret evaluator-id/diagnoseadapter og tom instruction/options; inputdomæne er eksplicit heltal i første slice. Resultatet er eksakt og reduceret, aldrig en afrundet facitstreng. Tom liste, VectorValue og elementer uden for det valgte domæne skal have en aftalt eksisterende struktureret diagnose med præcise parametre. Dette er et **forslag til beslutning**, ikke vedtaget af auditten. Ingen P0005/P0010-versionsændring er påvist nødvendig; eventuelle nye krav skal genvurderes før kode.

Højst fem acceptscenarier, først RED og derefter GREEN efter beslutningen:

1. Intern ListValue `[2,4,6,8]` gennem rigtig Worker/Pyodide/SymPy giver eksakt integer 5.
2. `[1,2,4]` giver rational 7/3; ikke et tilnærmet tal.
3. Gentagelser, fortegn og store integer-strenge bevares; fx `[-2,4,4]` giver 2 og singleton `9007199254740993` returneres eksakt. Input forbliver immutable.
4. Samme elementer i VectorValue afvises med den aftalte diagnose; ingen implicit konvertering.
5. Tom liste og forkert elementtype afvises med de aftalte strukturerede diagnoser; ingen backendtekst eller fallback.

En efterfølgende særskilt slice skal afklare listestavemåde og konstruktorpolicy og føre kildelister gennem IR, før `A := ...; mean(A)` i separate FormulaBlocks og reaktiv genberegning kan accepteres. Eksakte decimal-literaler forbliver en selvstændig gate, ikke et skjult krav løst af heltalsmiddelværdi.

## Kørte kommandoer og resultater

Miljø: Node v24.11.0, Python 3.12.4. Ingen installation eller parserregenerering.

`node tools/build/generate_canonical_parser.mjs --check`: PASS, exit 0.

Fokuseret Node-kørsel nedenfor: **276 PASS / 0 FAIL / 0 TODO / 0 SKIP / 0 cancelled**, exit 0. Alle nedenstående filer er under `tests/js/`:

```powershell
$focused = @(
  'value-contract', 'semantic-ir', 'operation-spec', 'selected-operation-catalog',
  'evaluation-contract', 'p0011-numeric-precision-value', 'p0018-canonical-decimal-unit',
  'p0021-slice-88a-canonical-parser-sync', 'p0020-peg-parser-writers',
  'p0020-derived-semantic-snapshot', 'p0019-operation-argument-plan',
  'p0021-slice-93a-shared-arithmetic-lowering', 'p0021-slice-93b-shared-expression-traversal',
  'p0021-worker-evaluation-protocol', 'p0021-worker-value-rehydration',
  'p0021-shared-worker-value-boundary', 'p0021-runtime-semantic-reactive-invalidation',
  'p0021-slice-98a-total-source-analysis', 'p0021-slice-95g-existing-renderer-semantic-projection'
) | ForEach-Object { "tests/js/$_.test.mjs" }
node --test --test-reporter=tap $focused
```

Den faktisk udførte kommando opregnede samme 19 filstier direkte og viste de sidste 12 outputlinjer samt Node-exitstatus; blokken ovenfor er den tilsvarende reproducerbare PowerShell-form.

- `python -m unittest discover -s tests/python -p test_sympy_value_adapter.py`: **29 PASS / 0 FAIL / 0 SKIP**, ingen TODO-markeringer.
- `python -m unittest discover -s tests/python -p test_p0012_system_solving_red.py`: **10 PASS / 0 FAIL / 0 SKIP**, ingen TODO-markeringer.
- `npm test`, gentaget under auditten: **1701 JS PASS / 0 FAIL / 7 TODO / 1 SKIP / 0 cancelled**, 1709 tests; **264 Python PASS / 0 FAIL / 0 SKIP**, exit 0. Python-delen er `python -m unittest discover -s tests/python -p test_*.py`.
- Syv TODO er de kendte forventninger: aktiv multi-statement (1), F7-symbolbinding (2), F8-substitution/scientific notation/literalpræcision (3), F4-unitgrammatik (1). De er ikke PASS. SKIP er real-symlink-testen på Windows, ikke parser-sync.
- Ad hoc-proberne beskrevet i tabellen sluttede med exit 0. Forventede afvisninger blev observeret/fanget; de tælles ikke som nye permanente PASS-tests. Ingen mean-matematik blev implementeret eller kørt i selected motor.
- Rigtig browser/Worker/Pyodide/SymPy og offline cold-start: **ikke kørt i S100a**. Historiske 31 browsergrupper er ikke ny evidens og etablerer ikke liste/mean-accept.

## Ændringer og tilbagerulning

Eneste auditændring er denne informative fil. Ingen produktionskode, genereret parser, tests, normative kontrakter, roadmap eller udviklerartefakter er ændret. Ingen RED-kodning, staging, commit, push eller ZIP-pakning.

Forventet afsluttende status, verificeret særskilt i chatten: de to oprindelige untracked artefakter plus denne untracked rapport. `git diff --stat` og `git diff --cached --stat` er tomme, fordi rapporten er ny og ikke staged. Tilbagerulning består alene i at fjerne rapporten efter brugerens ønske; ingen rollback er udført.
