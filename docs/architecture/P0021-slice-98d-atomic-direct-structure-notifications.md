# S98d — atomiske direkte strukturmutationer og notifikationsreentrancy

Informativ implementerings- og verifikationsrapport, 21. oktober 2026.
GREEN; afventer review. Ingen staging eller commit.
Baseline: `09e900edee5f4cf9f47918f89d82b28d21085c8c`.
Branch: `architecture-v1-implementation`.

## Kort arkitekturaudit

FROZEN v1.0 §§17–19 og 32, stress-test 32 og Review Resolution §2.13 bevarer
DocumentRuntime som eneste dokumentautoritet, task-isolation, afledte bindings,
immutable captures, særskilt host-epoch og afvisning af stale resultater.
Accepterede ADR-0004/0005/0006 bevarer runtime-ejerskab, sessionshistorik adskilt
fra persistence og fuldt graph-rebuild ud fra autoritativ orden. Ingen normativ
ændring er nødvendig. ADR-0007 er fortsat Proposed for review.

Før rettelsen skrev `addBlock`, `insertBlock`, `moveBlock` og `removeBlock`
direkte til den levende blokliste og fremrykkede mutationsstemplet før rebuild.
Rebuild/semantiske exceptions kunne derfor efterlade ny orden, fjernede eller
indsatte blokke og delvist dirty slots. S97a registrerede denne begrænsning med
et nyt stamp efter den delvise mutation, men genskabte ikke dokumentet.

`#assertNoReentrantMutation` fandtes ved alle fire API-indgange, men de satte
ikke `#publishing`. Struktur-notifikationer var derfor et åbent vindue for
nested add/insert/remove/move/source og transaction preparation. En add-listener
kunne eksempelvis fjerne den netop indsatte blok før retur af dens view.
Source-publicering og `applyDocumentTransaction` havde allerede gate/rollback.

Den offentlige `prepareDocumentTransaction` er bevidst begrænset til
semantic-only formeloperationer med et lukket operationsformat. Den kan ikke
direkte erstatte struktur-API'er, som også accepterer tekst, caller-owned
metadata og legacy-runtime. Udvidelse af dens offentlige kontrakt ville være
unødvendig. I stedet genbruges dens eksisterende private publiceringsmekanik.

## Mindste produktionsrettelse

Kun `src/js/document-runtime.js` ændres i produktion.

Den eksisterende commit/rollback-del fra `applyDocumentTransaction` er udtrukket
til `#publishDocumentStructure`. Både transaktioner og de fire direkte
struktur-API'er bruger den. Staged arrays er kortlivede referencearrays som i
den eksisterende transaktion; der tilføjes ingen dokumentmodel, history-owner,
evaluator, scheduler, persistent mirror eller offentlig mutations-API.

Forløbet er:

1. Bevar den eksisterende API-validering; forbered en løsrevet ordnet referenceliste.
2. Hold `#publishing` aktiv under analyse, publicering og notifikationslevering.
3. Gem de eksisterende blokreferencer, graph, calculation slots og mutation stamp
   som i transaktionens eksisterende rollback. Capture semantiske analyser før write.
4. Anvend den staged liste, rebuild, afled nye analyser og invalidér præcist.
5. Ved analyse-/invalidation-fejl: genskab orden, graph, slots og stamp; notificér ikke.
6. Efter succes: opdatér eksisterende incarnation pointers og fremryk stamp én gang.
   Lever først derefter notifikationer. Gate frigives også ved exceptions.

Inputvalidering og den fælles pre-write analyse kan fejle før autoritativ write;
det forbruger intet stamp. En mislykket indsættelses ephemeral identitet kan
aldrig genbruges ved en senere samme-ID-indsættelse.

## Bevarede offentlige kontrakter

- `addBlock` returnerer det nye beskyttede, stabile live view.
- `insertBlock`, `moveBlock` og `removeBlock` returnerer fortsat et caller-owned Set.
  Indsat/fjernet blok-ID medtages ikke som en eksisterende invalidated survivor.
- Tekstblokke, metadata, opaque ID'er, defaults, input-isolation og read-only views
  ændres ikke. Move bevarer inkarnation; delete/recreate giver frisk inkarnation.
- En reel same-position move er stadig en no-op: intet rebuild, stamp eller notice.
- Succesfulde direkte ændringer er stadig fremmede for en eksisterende HistorySession.
  Der indføres ingen automatisk historik, implicit recovery/reset eller replay.
- En fuldt afvist operation divergerer derimod ikke history og staler ikke en ellers
  gyldig prepared plan. Source-/calculation-identitet genskabes ved rollback.
- Runtime fremrykker ingen host-revision. En hostaction kan allerede have fremrykket
  sin monotone epoch før en fejlet runtime-operation; den tilbagerulles ikke.

**Notifikationssemantik er bevaret:** Semantic-only listener-exceptions isoleres,
og efterfølgende listeners køres. Legacy-listener-exceptions propagerer fortsat og
afbryder resten af leveringen. I legacy-tilfældet er dokumentmutation allerede
accepteret, selv om kaldet kaster fra listeneren; dette er ikke en afvist
analyse-/rebuild-mutation. Listenerlevering ligger uden for rollback-regionen.
Nested autoritative mutationer afvises i begge modes med den eksisterende
`S96A_REENTRANT_MUTATION`. Offentlige returtyper ændres ikke for at tilføje warnings.

## RED → YELLOW → GREEN

| Trin | Total | PASS | FAIL | TODO | SKIP |
| --- | ---: | ---: | ---: | ---: | ---: |
| Oprindelige permanente F1b/F2-tests før produktionsændring | 88 | 8 | 80 | 0 | 0 |
| YELLOW: udtræk af transaction publication; eksisterende transaction/rollback-tests | 24 | 24 | 0 | 0 | 0 |
| Første GREEN efter direkte API-integration | 88 | 88 | 0 | 0 | 0 |
| Endelig udvidet S98d-suite | 111 | 111 | 0 | 0 | 0 |

De otte oprindelige PASS fastlagde den eksisterende listener-exception-adfærd.
RED er injicerede fejl efter faktiske writes/rebuild/dirtying, ikke S98a's gamle
AST-fejl. YELLOW ændrede alene delingen af transaktionskoden; den direkte rute
blev først koblet på derefter.

Første fokuserede regression gav fire forventningskonflikter i gamle S97a-tests.
De forventede udtrykkeligt den tidligere delvise mutation og et frisk stamp efter
rebuild-fejl. Disse fire tests er migreret til den nu godkendte atomaritetskontrakt:
rollback genskaber stamp/indhold/views uden kompenserende edits. Testene kontrollerer
stadig, at en efterfølgende reel fremmed succes giver history-divergence og stale
prepared plans. De er ikke fjernet, sprunget over eller gjort TODO. Alle 62 tests
i den migrerede S97a-fil består.

## Permanente accepttests

Fælles testfixture anvender offentlige API'er, ægte immutable Values og P0009
Diagnostics. State-orakler er løsrevne JSON-data, primitive felter og eksplicitte
bindings-/edge-lister. View-/Value-/Diagnostic-identitet kontrolleres separat,
ikke som stedfortræder for indholdskontrol.

Den nye Node-suite dækker:

- Alle fire direkte API'er i semantic-only og legacy, med fejl efter write,
  erstattet graph og semantisk analyse. Ingen notice ved afvisning.
- Insert/move/remove-fejl efter downstream faktisk er dirty og uden resultat.
  Orden, task, source, writers, dependencies, graph, slots, generation, resultat,
  diagnose, mutation stamp og eksisterende inkarnationer genskabes.
- Tekstoperationer med metadata; uændrede andre tasks; gyldige operationer efter fejl.
- Pending plan/history efter afvisning, host-epoch efter fejlet action, præcise Sets,
  add-returview og frisk incarnation efter delete/recreate eller fejlet insert.
- Pending asynkron evaluering: rollback/no-op bevarer gyldig autoritet, mens en
  faktisk accepteret strukturmutation gør resultatet stale, også med konstant host-token.
- Notifikationsforsøg på add, insert, remove, move, source og prepare i begge modes.
  Særskilt test for allerede prepared transaction; reentrant afvisning forbruger
  ikke planen. Ingen skjult nested mutation eller stale add-returværdi.
- Oprindelig semantic-only/legacy listener-exception-adfærd og gate release efter fejl.

Fem in-memory mutationer bekræfter oraklernes styrke:

| Udeladt/ødelagt mekanisme | Forventede test-FAIL |
| --- | ---: |
| Genskabelse af blokorden | 34 |
| Genskabelse af graph | 22 |
| Genskabelse af dirty slots | 6 |
| Publiceringsgate | 56 |
| Uændret stamp efter afvisning | 33 |

Alle fem bliver dræbt af konkrete assertions. De køres i isolerede Node-processer
med en rapportlokal ESM-loader; ingen src/test-kilde eller index erstattes.

## Endelig regression

| Kontrol | Total | PASS | FAIL | TODO | SKIP |
| --- | ---: | ---: | ---: | ---: | ---: |
| Nye S98d Node-tests | 111 | 111 | 0 | 0 | 0 |
| S95–S98 + test-document-runtime | 647 | 647 | 0 | 0 | 0 |
| Fuld Node 24.11.0, standard discovery | 1709 | 1701 | 0 | 7 | 1 |
| Fuld Python 3.12.4 / SymPy 1.14.0 | 264 | 264 | 0 | 0 | 0 |
| Reel browser, endelig acceptance og regression | 31 | 31 | 0 | 0 | 0 |

Ingen cancellations. Parser source/AST-sync og whitespace PASS.
Syv arvede TODO: S90 sequential statements (1), F7 symbolic/dummy binding (2),
F8 substitution/scientific notation/literal precision (3), hostile unit grammar
(1). Ét Windows symlink EPERM SKIP. Ingen nye TODO/SKIP.

Browserne anvendte Chrome 155.0.8059.85, ChromeDriver 155.0.8059.84, Selenium
4.35.0, production Worker og rigtig Pyodide/SymPy via den konfigurerede CDN.
Fordeling: S95f/k/m/p 4, S96b.2 3, S97a 4, S97c inkl. c.4 5, S98a 5, S98b 5,
ny S98d 5. Antal er runnerens scenariegrupper, ikke individuelle assertions.

Den nye browserprøve bruger netop de direkte struktur-API'er: real math 11/101,
rollback efter dirtying med bevaret epoch-fremrykning, blokeret nested sletning,
indsat capture 14, flyttet capture 11, observer-isolation og no-op. Et faktisk
Worker-resultat holdes tilbage, mens provider slettes; resultatet afvises som
stale. Samme-ID-recreate får frisk identitet, og eksplicit genberegning giver 18.

Første browserfixture-kørsel gav 0 PASS/1 FAIL: kontrolblokken brugte fritstående
`a+1`, som den valgte batchgateway ikke understøtter som top-level statement.
Den blev rettet til den understøttede assignment `b:=a+1`, med uændret forventet
101 og uændret produktionskode. Fejlloggen er bevaret; den endelige kørsel er 5 PASS.

## Filer, evidens og begrænsninger

Otte permanente ændrede/nye paths:

- `src/js/document-runtime.js` — eneste produktionsfil.
- `tests/js/p0021-slice-97a-history-mutation-divergence-red.test.mjs` — fire kontraktmigrationer.
- `tests/helpers/structural-mutation-fixture.mjs` — offentlig testopsætning og løsrevne orakler.
- `tests/js/p0021-slice-98d-direct-structure-atomicity.test.mjs`.
- `tests/js/p0021-slice-98d-structure-reentrancy.test.mjs`.
- `tests/browser/p0021-slice-98d-direct-structure.html`.
- `tests/browser/p0021-slice-98d-direct-structure.mjs`.
- `docs/architecture/P0021-slice-98d-atomic-direct-structure-notifications.md`.

Komplet tracked/untracked diff, filhashes, rå RED/YELLOW/GREEN-logs, historiske
forventningskonflikter, browserlogs og mutationsevidens ligger i ignoreret
`tools/reports/s98d/`. Denne mappe er ikke elev-releaseindhold.

F1b/F2 er GREEN for de implementerede direkte struktur-/notifikationsgrænser.
Det er ikke generel rollback af vilkårlige hostcallbacks: S98c's revision-callback-
sideeffekter er stadig ikke en del af en overordnet hosttransaktion. F3 history
recovery forbliver særskilt; ingen automatisk reset, fallback eller replay er tilføjet.
Performance ved store dokumenter er ikke benchmarktestet; add udfører nu også
det fælles semantiske validerings-/invalidation-pass. Fuldt rebuild er den
accepterede arkitektur, ikke en ny incremental graph-mekanisme.

Offline cold-start, andre browsermotorer, fuld elev-UI og generel releaseacceptance
er ikke testet/erklæret. Legacy-evaluatorens matematik er ikke udvidet eller
brugt som fallback; legacy-mode verificeres for runtime-kontrakter.
FROZEN, accepterede ADR'er og ADR-0007's Proposed-status er uændrede.
HEAD forbliver baseline; index er tomt. Ingen commit, push, reset, clean,
arkivering eller oprydning. Selenium- og tidligere reviewartefakter er bevaret.
