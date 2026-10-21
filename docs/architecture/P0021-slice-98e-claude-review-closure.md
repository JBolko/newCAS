# S98e — closure af de aftalte Claude-reviewkorrektioner

Informativ, 21. oktober 2026. Korrigeret efter Claudes uafhængige efterreview;
afventer endelig checkpointgodkendelse. De alvorlige korrektionsfund er CLOSED
inden for deres aftalte scopes; N6 og tekstbloknotifikationer er fortsat OPEN.
Ingen nye produktions-/testændringer i S98e.
Branch `architecture-v1-implementation`; verificeret HEAD
`96b9f2889bf9f81d1454e8de040cd96c19aea5d1`.

## Verificeret checkpointkæde

| Slice | Commit | Parent |
| --- | --- | --- |
| S98a | `390e2e96ff840130435e00ff2d0b40d6bfc706f3` | `c6514fba9bae3d0f76a26b8b42b4d52303de9c10` |
| S98b | `26ceb7a114aeca09a54b77141d55fc40df27ec7f` | `390e2e96ff840130435e00ff2d0b40d6bfc706f3` |
| S98c | `09e900edee5f4cf9f47918f89d82b28d21085c8c` | `26ceb7a114aeca09a54b77141d55fc40df27ec7f` |
| S98d | `96b9f2889bf9f81d1454e8de040cd96c19aea5d1` | `09e900edee5f4cf9f47918f89d82b28d21085c8c` |

Parents er kontrolleret enkeltvis. De tre FROZEN-dokumenter og hele `docs/adr/`
er uændrede ved hvert af de fire commits. ADR-0007 er fortsat **Proposed for review**.
Ved start var tracked worktree rent og index tomt. Kun de kendte
`chromedriver/` og `se-metadata.json` var untracked. S98e ændrer kun denne rapport,
roadmap og S99-handover; ingen staging, commit, push eller oprydning.

## Fundsmatrix — konkret scope og permanent bevis

Testfilnavne nedenfor er relative til `tests/js/`; alle indgår i den gemte fulde
Node-kørsel. GREEN gælder den beskrevne acceptance, ikke en generel phase-exit.

| Fund | Slice / kodeområde | Permanent regressionsbevis | Aktuel status |
| --- | --- | --- | --- |
| F1a: parsebare, ikke-understøttede statement-konverteringer | S98a; `dependency-analyzer.js`, `derive-block-source-bindings.js`, `create-runtime-function-batch-evaluator.js` | `p0021-slice-98a-total-source-analysis.test.mjs`: eksakt AST/source, ingen nested writers/reads/edges, lokal P0009 uden backend-kald og bevaret task-isolation; S98a-browser | CLOSED for Conversion(Assignment/FunctionDefinition); ingen ny konverteringskapabilitet |
| F4: leksikal callable-prioritet | S98b; bindings/classification, begge source-compilere og function gateway; `reject-lexical-callable.js` | `p0021-slice-98b-lexical-callable-precedence.test.mjs`: lokal f/f'/f'', operation-shadowing, ingen falsk edge/capture/fallback; positive kald; S98b-browser | CLOSED; lexical application er eksplicit unsupported, ikke generel higher-order application |
| F5: obligatorisk guard og primitive snapshots | S98c; `editing/create-formula-structural-action.js` | `p0021-slice-98c-structural-guard.test.mjs`: manglende stamp-API, generationsændring bag samme view, source/struktur/ABA, no-op og uændret history-injektion | CLOSED for den bevarede non-history-rute; ingen hostcallback-rollback |
| F1b: direkte strukturel atomaritet | S98d; `DocumentRuntime.#publishDocumentStructure` deles af direkte API'er og transaktioner | `p0021-slice-98d-direct-structure-atomicity.test.mjs`: write/rebuild/semantic/dirty-fejl, orden/graph/slots/identitet/stamp, tekst/legacy/tasks og async; fire S97a-kontraktmigrationer; S98d-browser | CLOSED for add/insert/move/remove ved analyse-/invalidation-fejl |
| F2: reentrancy under strukturpublicering | S98d; samme private publiceringsgate og eksisterende `#assertNoReentrantMutation` | `p0021-slice-98d-structure-reentrancy.test.mjs`: nested add/insert/remove/move/source/prepare/apply, stale returværdi, listenerfejl og gate release; S98d-browser | CLOSED i semantic-only og legacy; eksisterende listener-exception-semantik bevaret |

Claudes efterreview har afklaret den oprindelige N-nummerering. Det tidligere
forbehold om ukendt per-ID-tilknytning erstattes af følgende konkrete status:

| Fund | Status og bevis / resterende arbejde |
| --- | --- |
| N2 — rollback efter dirty slots | CLOSED. S98c `runtime-regressions`: fejl efter `markBlockDirty`, løsrevet state/graph, stamp/history/resultat genskabes; S98d udvider til direkte struktur |
| N3 — reentrancy under source-publicering | CLOSED. Samme fil: nested source/struktur/prepare afvises, ydre edit accepteres og næste execute/Undo/Redo virker |
| N4 — præcis invalidation og task-isolation | CLOSED. Samme fil: source+source og insert+source, eksakt affected set, generation/resultat/fejl, én notifikation, uafhængige slots uændrede |
| N7 — ikke-Value batchhale | CLOSED. Samme fil: fire ugyldige værdiformer efter tidligere gyldige outcomes; ingen delvis publicering, gamle slots og history/stamp bevares |
| N6 — fire svage identitetstest-orakler | OPEN. Fire eksisterende tests bygger fortsat på utilstrækkelig identitetskontrol. S95n's forstærkede no-op-test og de nye løsrevne orakler lukker ikke disse resterende tilfælde. Testdækningsproblem, ikke en verificeret ny produktionsfejl |

Desuden skal tre øvrige `deepEqual(getBlocks(), before)`-orakler styrkes med
løsrevne snapshots. Snapshot-rækkefølge gør ikke elementernes live views til
indholdssnapshots. Disse tre tilfælde er også åbent testforstærkningsarbejde;
den grønne regression må ikke bruges som bevis for, at oraklerne er tilstrækkelige.

Historisk RED/YELLOW og mutationstesttal findes i S98a–d-rapporterne. De er ikke
genkørt eller lagt oven i S98e's friske testtal.

## Gemte S98e-regressionskørsler fra uændret HEAD

Tallene nedenfor er de allerede udførte S98e-kørsler før efterreviewets
dokumentationsrettelser. Produktions- og testkilden er uændret; der påstås
ingen ny fuld regressionskørsel som del af disse dokumentationsrettelser.
Tre isolerede lokale runtimeprober bekræftede legacy-source-rollback efter
tidligere notifikation, accepteret legacy-struktur før listenerfejl og
tekstblok-move/remove med `[undefined]`. De er ikke nye permanente tests og
lægges ikke til regressionstallene.

| Kørsel | Total | PASS | FAIL | TODO | SKIP |
| --- | ---: | ---: | ---: | ---: | ---: |
| Standard `node --test`, Node 24.11.0 | 1709 | 1701 | 0 | 7 | 1 |
| Python 3.12.4 / SymPy 1.14.0, unittest discovery med `-B` | 264 | 264 | 0 | 0 | 0 |
| Reel Chrome/Worker/Pyodide/SymPy | 31 grupper | 31 | 0 | 0 | 0 |

Ingen cancellations. Parser-sync og whitespace-check PASS. Node-loggen bruger
standard spec-reporter; de syv TODO-assertions udskrives som kendte fejl, men
det faktiske resultat er 0 FAIL, 7 TODO og exitkode 0. De tæller ikke som PASS.
Node-cases, Python-cases og browsergrupper er forskellige populationer og summeres
ikke. S98a–d's målrettede testtal er overlappende delmængder, ikke ekstra acceptance.

Browser: Chrome 155.0.8059.85 / ChromeDriver 155.0.8059.84, Selenium 4.35.0.
S98a 5, S98b 5, S95f/k/m/p fælles history-rute 4, S98d 5, S96b.2 3, S97a 4,
S97c inkl. c.4 5. Hver side er genkørt; ingen genbrugte browserresultater.
S98c har ingen særskilt browserrute for sin direkte guard; den testes i Node.
Den fælles browseradapter og S97's read-only/identity/Worker-grænser er genverificeret.

## Fokuseret arkitektonisk slutkontrol

DocumentRuntime ejer fortsat private writable blocks, orden, dependencies,
invalidation og result-publicering. HistorySession ejer kun reversible operationer
og cursor; både direkte struktur og history-transaktioner bruger samme private
runtime-publicering/rollback. Ingen konkurrerende commit-owner er indført.
S97's stabile, dybt read-only live views og ægte immutable Value/Diagnostic-
identitet består; et view er ikke et indholdssnapshot.

Leksikal prioritet, task-isolation, særskilt mutation stamp/source identity/
calculation generation/host epoch og stale Worker-afvisning består. Diagnostics
bruger eksisterende koder og parametre; ingen beslutning afhænger af UI-sprog.
De fire valgte browsergrafer og Worker-entrypointet har ingen uløste statiske
imports eller imports til legacy `main.js`, `cas-engine.js` eller `transformer.js`.
Dette beviser den valgte rutes adskillelse, ikke generel legacy-retirement.

Preview-allowlistens 121 paths valideres; ingen tests, tools/reports, ZIP/logs eller
migrationsartefakter er inkluderet. Manifestet er fortsat `releaseReady:false`,
`DEVELOPMENT_PREVIEW_ONLY`. Ingen elevdistribution er bygget eller opgraderet;
komplet dependency-pakning/offline-drift er ikke erklæret accepteret.

## Accepteret adfærd og resterende begrænsninger

- **F3 er accepteret fail-closed-adfærd, ikke en ulukket implementeringsfejl:**
  HistorySession afviser efter fremmede mutationer før revision/cursor ændres,
  også ved ABA/samme-ID-recreate. Det understøttes af S97a/b- og S98d-tests.
  Ingen automatisk reset/recovery/replay er lovet eller implementeret.
- Generel rollback af vilkårlige hostcallback-sideeffekter er ikke garanteret.
  Runtime-analysefejl genskaber autoritet; allerede fremrykket host-epoch består.
- Semantic-only observerfejl isoleres. **Legacy `setBlockSource`:** En listener,
  som kaster, kan udløse rollback efter at tidligere listeners allerede er
  notificeret om den midlertidige source. Dokumentrollback tilbagefører ikke
  tidligere leverede notifikationer eller deres eksterne sideeffekter.
  **Direkte strukturmutationer:** Mutationen kan derimod være accepteret, før
  legacy-listenerfejlen propagerer. De to tilfælde har ikke ens post-commit-adfærd.
- **N6 er OPEN:** fire svage identitetstest-orakler; desuden tre øvrige
  `deepEqual(getBlocks(), before)`-orakler, som kræver løsrevne snapshots.
  Dette er testdækningsarbejde, ikke en verificeret ny produktionsfejl.
- **Tekstbloknotifikationer er OPEN:** Claude har reproduceret, at `moveBlock`
  og `removeBlock` på tekstblokke kan notificere med `[undefined]`. Verificeret,
  lavprioriteret eksisterende fejl; ingen produktionsrettelse i S98e.
- ADR-0007 forbliver Proposed; S98e giver ingen normativ godkendelse.
- Syv arvede TODO: S90 sequential statements (1, kræver særskilt kontrakt/ADR),
  F7 symbolic/dummy binding (2), F8 substitution/scientific notation/literal
  precision (3), hostile unit grammar (1). Det historiske F4-unit-label er ikke
  Claude F4 callable-fundet. Ét SKIP er Windows real-symlink EPERM; portable
  symlinkguards består. Ingen af disse tæller som lukket ved denne closure.
- Full student-UI/cutover, bred matematisk capability-/normativ acceptance,
  offline cold-start, andre browsermotorer, ressourcebudgetter og performance
  for store dokumenter er stadig særskilt releasearbejde.

**Anbefaling:** Afslut de alvorlige korrektionsfund F1a/F4/F5/F1b/F2 inden for
de aftalte scopes, som bekræftet af Claudes efterreview. N2/N3/N4/N7 er CLOSED;
N6, de tre øvrige snapshot-orakler og tekstbloknotifikationerne forbliver OPEN.
Der er ingen nye blokerende produktionsfejl. Denne korrigerede closure og
roadmap/handover afventer endelig checkpointgodkendelse. S99 er alene reserveret
til fælles kontrakt-/strategiafklaring om `.ncas`, persistens, Values,
præsentation, data og plots; ingen ny
kontrakt eller implementering fastlægges her.

De gemte regressionslogs og checkpoint-/import-/allowlist-audit ligger i
`tools/reports/s98e/` (ignoreret). Dens eksisterende `complete-documentation.diff`
og `final-verification.json` beskriver dokumentversionen før disse efterreview-
rettelser. De er bevaret uændrede; en ny checkpointverifikation skal bruge de
tre korrigerede dokumenter.
Handover: `docs/Styredokumenter/CODEX_HANDOVER_S99.md`.
