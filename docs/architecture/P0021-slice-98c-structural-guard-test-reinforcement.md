# S98c — F5 containment og målrettet testforstærkning

Informativ rapport, 21. oktober 2026. GREEN; afventer review.
Baseline: `26ceb7a114aeca09a54b77141d55fc40df27ec7f`, branch
`architecture-v1-implementation`. Ingen staging eller commit.

## Kodevejsaudit og godkendt afgrænsning

`src/js/editing/create-formula-structural-action.js` har to eksplicitte ruter.
S97b-ruten delegerer til injiceret `commitOperations` før den direkte F5-guard.
Det eksisterende S95f/k/m/p-browserfixture tilfører den fælles HistorySession.
Ingen produktions-UI-caller blev fundet ved søgning efter modulet/fabrikken.

Den direkte non-history-rute bruges fortsat af understøttede S95L/S95M- og
S97a/b-Node-kontrakter. Efter auditens stop blev minimal containment særskilt
godkendt: bevar ruten, kræv dens stamp-API og brug løsrevne primitive guardfelter.
Ingen retirement, generel rollback eller udbygning af legacy-arkitekturen.

S97-stemplet opdagede allerede normale source-/strukturændringer og ABA.
F5-hullerne var valgfrie stamp-kald og `getBlocks()`-elementer behandlet som
snapshots. Rækkefølgen er et snapshot; elementerne er stabile, levende views.
Derfor blev både før- og efter-generation læst fra det ændrede objekt.

## Produktionsrettelse

Kun `create-formula-structural-action.js` ændres:

- Non-history-konstruktion kræver `getDocumentMutationIdentity` før noget kald
  til hostens revisionscallback; kaldet kan ikke springes over med `?.()`.
- History-injektion får ikke et nyt krav. Den eksisterende commit-ejer bevarer
  ansvaret for transaktion, stempel og revision.
- Guarden gemmer id, type, taskId, source og generation som primitive værdier
  inden revisionsfremrykningen. View-reference beholdes separat som en legitim
  inkarnationskontrol, ikke som bevis for uændret indhold.
- Dokumentstempel, primitive felter, rækkefølge og inkarnation kontrolleres før
  den ønskede insert/remove/move. Samme-position move er fortsat en reel no-op.

Dette er en kortlivet preflight-kontrol, ikke en ekstra dokumentmodel.
Ingen matematisk semantik, source-identitet, beregningsgeneration eller
mutationsstempel-kontrakt ændres.

**Ingen rollback-påstand:** En forkert hostcallback kan allerede have ændret
source, calculation eller epoch, før guarden afviser. De sideeffekter bliver
stående; den efterfølgende ønskede strukturhandling starter ikke. Testene
kontrollerer dette udtrykkeligt. Generel tilbageførsel tilhører særskilt S98d.

## Permanente tests og orakler

`p0021-slice-98c-structural-guard.test.mjs` tilføjer 14 tests:

- Manglende/null/ikke-funktionelt stamp-API afvises før revisionscallbacks.
- History-injektion kan stadig anvendes uden adapterens direkte stamp-krav.
- En faktisk success-slot dirties under callback; generation ændres, mens
  view-identitet og dokumentstempel består. Guarden skal stoppe strukturhandlingen.
- Source, same-source write, source-ABA, insert, remove, move, move-ABA og
  delete/recreate med samme ID kan ikke passere guarden.
- No-op bevarer primitive data, stempel og epoch; callbacken udføres ikke.

`p0021-slice-98c-runtime-regressions.test.mjs` tilføjer otte tests efter de
supplerende N2–N4/N6/N7-temaer i opgaven:

1. Injicér en fejl **efter** downstream faktisk er dirty og uden resultat.
   Transaktionsrollback skal genskabe source, slots, generation, resultater,
   fejl, dependencies, graph, source-identitet og stempel. History må ikke få
   et nyt entry; host-epoch går stadig frem. Næste execute/Undo skal virke.
2. Under `setBlockSource`-publicering afvises nested source, insert, remove,
   move og transaction preparation. Den ydre source accepteres; ingen skjult
   ekstra source eller ændring i andre tasks. Ny korrekt owner kan Undo/Redo.
3. To transaktioner på tværs af T/U: source+source og insert+source. Kontroller
   eksakt affected set, generationsfremrykning, resultat/fejl og én notifikation.
   Uafhængige blokke i T/U og hele Z bevarer løsrevet calculation-state.
4. Fire ugyldige ikke-Values i batchens hale: null, tal, tomt objekt og falsk
   Value-lignende objekt. Tidligere gyldige outcomes må ikke delpubliceres.

Den oprindelige Claude-rapport med N-numrenes fulde ordlyd var ikke tilgængelig
som selvstændig rapport i de undersøgte filer; der påstås ikke en uafhængig
bekræftelse af nummereringen. De fem opgavedefinerede testtemaer dækkes konkret.

S95n's eksisterende no-op-test primes nu til ægte success og kontrollerer
løsrevne source/status/generation/result/error-værdier samt stamp. Den bevarede
view-identitetsassertion er supplerende. Tests, hvis udtrykkelige formål er
stabil view-identitet, er ikke fejlagtigt omklassificeret som snapshot-tests.

## RED → YELLOW → GREEN og mutationsevidens

F5's nye suite før produktionsrettelse: 14 total, **10 PASS / 4 FAIL**.
Tre FAIL er manglende stamp-API-varianter; én FAIL er generationsændringen.
YELLOW var kontraktafklaring og analyse af snapshot/stamp-ansvar; der påstås
ingen særskilt delimplementeringskørsel. Efter rettelsen: **14 PASS / 0 FAIL**.
De otte supplerende regressioner består uden runtime-produktionsændringer.

Otte isolerede in-memory mutationer blev alle dræbt af de tilsigtede assertions:

| Fjernet/ødelagt beskyttelse | Forventede test-FAIL |
| --- | ---: |
| Obligatorisk stamp-API | 3 |
| Primitive snapshots erstattet af live views | 1 |
| Rollback af allerede dirty slots | 1 |
| Source-reentrancy-guard | 1 |
| Task-præcis invalidation erstattet med dirtying af alle tasks | 2 |
| Value-gate før publicering | 4 |
| Value-validering flyttet ind mellem slot-publiceringer | 4 |
| No-op dirtying trods stabil view-identitet | 1 |

Mutationerne er kun indlæst via testprocessens ESM-loader i ignoreret rapportmappe.
Ingen src/tests-kilde blev erstattet; ingen produktionsbagdør blev tilføjet.
En indledende loaderkørsel ramte et CRLF-ankerproblem og tæller ikke som dræbt
mutant. Efter normalisering gennemførtes alle otte med konkrete assertion-fejl.

## Endelig verifikation på denne computer

| Kontrol | Total | PASS | FAIL | TODO | SKIP |
| --- | ---: | ---: | ---: | ---: | ---: |
| S98c nye tests | 22 | 22 | 0 | 0 | 0 |
| S98c + forstærket S95n-fil | 34 | 34 | 0 | 0 | 0 |
| Fokuseret S95–S98 | 465 | 465 | 0 | 0 | 0 |
| Fuld Node 24.11.0 standard discovery | 1598 | 1590 | 0 | 7 | 1 |
| Python 3.12.4 / SymPy 1.14.0 | 264 | 264 | 0 | 0 | 0 |
| Reel Chrome/Pyodide/SymPy, eksisterende S95f/k/m/p-grupper | 4 | 4 | 0 | 0 | 0 |

Ingen cancellations. Parser-sync og whitespace PASS. De syv arvede TODO:
S90 sequential statements (1), F7 symbolic/dummy binding (2), F8 substitution/
scientific notation/literal precision (3), hostile unit grammar (1).
Windows symlink EPERM er fortsat ét SKIP. Ingen nye TODO/SKIP.

Browser: Chrome 155.0.8059.85, ChromeDriver 155.0.8059.84, Selenium 4.35.0.
Reel production Worker og konfigureret CDN-Pyodide/SymPy; ingen syntetiske
browserresultater. Fire grupper er knapforløb, ikke fire enkelte assertions.
Forløbene dækker input/Enter, insert/move/remove, captures, draft isolation,
beregning og Undo/Redo. De kontrollerer den fælles adapterkonstruktion og
HistorySession-ruten, **ikke** en browserintegration af den direkte F5-guard.
Den direkte guard verificeres af de permanente Node-tests og mutationerne.
Offline cold-start, andre browsermotorer og fuld elev-UI er ikke accepteret her.

## Scope, filer og næste review

Fem permanente ændrede/nye filer:

- `src/js/editing/create-formula-structural-action.js`
- `tests/js/p0021-slice-95n-document-transaction.test.mjs`
- `tests/js/p0021-slice-98c-structural-guard.test.mjs`
- `tests/js/p0021-slice-98c-runtime-regressions.test.mjs`
- `docs/architecture/P0021-slice-98c-structural-guard-test-reinforcement.md`

Logs, komplet diff, filhashes, mutationsharness/-resultater og maskinel
slutkontrol: `tools/reports/s98c/` (ignoreret).
FROZEN, accepterede ADR'er og ADR-0007 er uændrede; ADR-0007 er Proposed for review.
DocumentRuntime og HistorySession-produktionskode er uændret.

Der kom ingen ny F1b/F2-RED fra de ovenstående regressioner. Det lukker ikke
generel direkte struktur-rollback, reentrancy uden for den testede source-
publiceringsgrænse eller F3 history recovery. F1b/F2 forbliver reserveret til
S98d; F3 er særskilt. Ingen implicit history-reset, fallback eller replay.

Ingen staging, commit, push, reset, clean, arkivering eller oprydning.
Eksisterende Selenium- og reviewartefakter er bevaret. Stop ved GREEN til review.
