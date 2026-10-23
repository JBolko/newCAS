# S100m1 — Value v2 repræsentation og codecs

**Status: GREEN for S100m1; ingen v2-Worker/Pyodide-accept påstås.**
23. oktober 2026. Branch `architecture-v1-implementation`, HEAD `462deb0381ea5b624cd9ad41ceb06dd4069fcc58`.

## Accepteret kontraktcheckpoint

Brugerens S100m1-instruktion accepterer den stabiliserede repræsentation, encoding, nesting, metadata, lighed og codecdiagnoser. ADR-0008 er registreret Accepted med dato/scope efter projektets eksisterende ADR-praksis; det præcise schema står i [P0005 Value v2-tillægget](P0005-value-v2-statistics-contract.md). S100m-analysen er bevaret med en historisk statusnote. Ingen særskilt ADR-registreringsprocedure er fundet.

Ressourcegaten fra første RED-aflevering er efterfølgende **USER-ACCEPTED**: dybde 128, 100.000 besøgte JSON-værdier, 8 MiB canonical UTF-8 og P0009-producenten `value-codec-resource-limit` med `{path,resource,limit}`. Beslutningen blev registreret i tillægget/ADR før produktionstilføjelser. Gaten er lukket; ingen ny matematisk metode er godkendt i kraft af denne accept.

## Implementering og filafgrænsning

- `src/js/values/value.js`: eksplicit versionsdispatch og de nye API'er `statisticsValue(data)`, `listV2(items)`, `sameValue(a,b)`. Eksisterende v1-factories, konstanten VALUE_VERSION=1 og den rekursive v1-validator bevares.
- `src/js/values/statistics-value.js`: separat structural codec med de to disjunkte StatisticsValue-varianter og generel ListV2. Præcise felter, sikker inspektion af own-data-descriptors, ingen getterudførelse, detached deep freeze, canonical recordorden, assumptions-sortering og opaque id-validering. Ingen matematisk partitionskontrol eller scalar-unwrapping.
- `src/python/adapters/statistics_value_adapter.py`: selvstændig structural codec uden SymPy/evaluator. Hele eksisterende v1-familien understøttes som typed payload, inklusive function/relation/set/vector/matrix/quantity. Egen immutable record og tuples bevarer snapshots; `encode_value` er JSON-grænsen. Returnerede records/arrays må ikke muteres. Eksisterende SympyValueAdapter er uændret.
- `src/js/diagnostics/diagnostic.js`: tre accepterede P0009 DiagnosticSpecs og streng producentvalidering af reason/feature/resource. Ingen ny envelope eller diagnosemekanisme.
- `tests/js/p0005-statistics-value-contract.test.mjs`: **53 tests**; `tests/python/test_statistics_value_adapter.py`: **39 tests**.
- `tests/fixtures/statistics-value-v2.json`: **23 fælles bytefixtures** for begge codecs, inklusive alle v1-payloadkinds, stor Number-dimensionsmetadata, Unicode/astral/lone-surrogates og approx uden precisionBits.
- Dokumenter: ADR-0008, P0005-v2-tillægget, S100m-analysens statusnote og denne rapport.

Kvartilfixturen har S100l-referencebasis [2,3,5] og værdien [35/3,20,30]. Symbolske radikaler og øvrige resultater er materialiserede repræsentationsfixtures; ingen grouped-algoritme er udført. En shape-valid klasse med lower>=upper/count=0 kan encode/decode uden en opdigtet matematisk attest.

## Ressourcebeskyttelse og canonical encoding

Budgettet gælder hele v2-træet, inklusive embedded v1 og hver gentaget shared/provenance-forekomst. Roddybde er 0; keys tæller i bytes, ikke som selvstændige JSON-nodeværdier. Cycles afvises; shared acyclic input kopieres kun inden for budgettet. Overskridelse giver almindelig struktureret P0009-diagnose, uden delvis Value, trunkering eller metadata-tab.

JSON-ingress gennemgår først en lineær versionsscan og for v2 en tokenpreflight af dybde, noder og normaliserede tokenbytes **før fuld JSON.parse/json.loads**. Store individuelle stringtokens er også afgrænset før token-decode; JSON-escaping kan kræve op til 6× bytebudgettet i rå tokentekst. Whitespace kræver scanning, men intet nyt Value-træ; budgettet er ikke en begrænsning af allerede modtaget tekst eller hele processens RAM. Ikke-kanoniske gentagne JSON-felter bruger også preflightarbejde/budget; sidste felt fortolkes som ved native JSON-decode. Ydre Worker/message-/rå ingressgrænser er fortsat S100m2's separate gate.

Canonical v2-recordorden og assumptions-normalisering er identiske på JS/Python. Embedded v1-repræsentationers feltrækkefølge bevares. Eksakte heltals-/rational-/countværdier forbliver strenge; der bruges ingen Number/float til matematisk beregning. Python tilpasser kun eksisterende numerisk JSON-envelope-/dimensionsmetadata til JS's JSON Number-encoding, ikke matematiske talblade.

Top-level v1 er eksplicit fritaget for de nye v2-budgetter og bruger fortsat sin gamle decode/encode-/factory-sti. Dets historiske generelle ressourcerisiko lukkes derfor ikke med denne slice.

## RED → YELLOW → GREEN — faktiske beviser

| Fase/kørsel | Resultat |
| --- | --- |
| Før produktionsændringer: oprindelig repræsentations-RED | JS **42 tests: 1 PASS, 41 FAIL**; Python **29 FAIL**. Den beståede JS-test bekræftede v1. En første Python-kørsel havde 40 subtest-fejlregistreringer; setUp blev rettet til én manglende-modul-fejl pr. test uden svækkede assertions. |
| Accepteret ressourcepolitik, stadig før produktion | JS **47 tests: 1 PASS, 46 FAIL**; Python **34 FAIL**. |
| YELLOW | Codecs gjorde de fokuserede suites grønne. En eksisterende regression krævede bevaret unsupported-valueVersion-fejltekst; den bevares sammen med den nye diagnose. Fuld npm fandt den eksisterende tekstvagts match på re.compile; codec bruger nu direkte re.fullmatch og en lineær numerisk versionsscanner. Ingen guard/TODO/SKIP ændret. |
| Endelig S100m1-suite | JS **53 PASS**, Python **39 PASS**, 0 FAIL/TODO/SKIP. Efterfølgende regressionstests udvidede med eksakte node-/bytegrænser, Unicode, producentkontrakter, store counts og versionkey-normalisering. |
| Fokuseret JS Value/P0010/Worker-rehydrering/P0009 + S100m1 | **163 PASS**, 0 FAIL/TODO/SKIP. Dette er eksisterende rehydrering/regression, ikke reel v2-Workeraccept. |
| Eksisterende Python SymPy-adapter | **29 PASS**, ingen ændring af adapteren. |
| Injektions-/dynamic-code-vagt | **4 PASS**, ingen ændring af vagten eller legacy-koden. |
| Canonical parser-sync | **5 PASS**, ingen parserregenerering eller grammatikændring. |
| Fuld `npm test`, Node 24.11.0 | **1781 tests: 1773 PASS, 0 FAIL, 7 TODO, 1 SKIP, 0 cancelled**. |
| Fuld `npm test`, Python 3.12.4 | **365 PASS**, 0 FAIL/SKIP. Hele kommandoen exit 0. |

Endelig fuld log: systemets tempmappe, `newcas-s100m1-green-full-1a194145-77fc-48e1-b8ae-e2967355cfed.txt`. Brugerens `s100-testlog.txt` er ikke overskrevet.

Ressourcetests prøver netop på/over dybde 128, præcis 100.000 noder, præcis 8 MiB, UTF-8/control-escaping, bred JSON, 1000-niveauers ingress og shared-DAG-ekspansion. Store countstrenge med 10.000 cifre bevares uden heltalskonvertering. Metode-id'er med store versionssuffixer behandles som opaque strenge.

## Bevis for uændret v1 og bevaret arbejdstræ

En source-sammenligning med HEAD bekræfter, at hele den tidligere JS-v1-implementering er identisk bortset fra den eksplicitte import/versionsdispatch og nye exports; samtlige gamle konstruktører/validatorer er bevaret. Gamle byte-/container-/identitytests består uden ændring.

SHA-256 er uændret for P0005 v1, P0010, begge S100l-dokumenter, `s100-testlog.txt`, `se-metadata.json` og checkpoint-allowlisten. De tre FROZEN-dokumenter og allerede accepterede ADR-0004/-0005/-0006 er ikke ændret. Chromedriver er ikke anvendt eller ændret.

`git status --short`, `git diff --check` og `git diff --stat` er kontrolleret. Tracked diff omfatter den allerede eksisterende S100l-ændring (7 tilføjelser/5 fjernelser) samt JS-dispatch (16 tilføjelser/1 fjernelse, inklusive EOF) og P0009-producenter (20 tilføjelser). De nye codecs/tests/kontraktdokumenter er untracked og indgår derfor ikke i almindelig Git-diffstat; de er særskilt kontrolleret for whitespace/EOF og dokumentlinks. Ingen staging, commit, push, reset eller clean.

## S100m2-anbefaling og resterende gates

S100m1 er GREEN. **S100m2 er ikke startet** og kræver brugerens gennemgang som aftalt.

Næste slice bør samlet opgradere eksisterende Worker-protokol/rehydrering, Python-gatewayens typed grænser og container_list-handlerens versionsvalg. Genbrug disse codecs; Python-immutable Values skal gå gennem den eksplicitte encoding ved transport, ikke sendes som nye backendobjekter. Bevis både request og response i rigtig browser/module Worker/Pyodide/SymPy med grouped/result/radikal/approx/provenance og genbrug af returnerede Values som næste input.

Test derefter generisk DocumentRuntime-publicering/providerbinding, task-isolation, invalidation/genberegning og stale-result-afvisning uden runtime-specialregler. Ukendte metode-id'er må kun transporteres opakt; eksisterende scalaroperationer må ikke unwrappe statistikwrapperen.

Åbne gates: reel v2-Worker/gatewayaccept og ydre messagebudgetter; senere konkrete matematiske grouped-producenter/metodekontrakter, dokumentprofil/syntax/persistens og rendering. Ingen af disse er påstået løst af S100m1.
