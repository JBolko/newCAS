# S99 — handover til fælles kontrakt- og arkitekturafklaring

Informativ, 21. oktober 2026. **S99 er ikke påbegyndt eller kontraktfastlagt.**

- Branch: `architecture-v1-implementation`.
- Seneste kodecheckpoint: `96b9f2889bf9f81d1454e8de040cd96c19aea5d1` (S98d).
- Kæde: S98a `390e2e9` → S98b `26ceb7a` → S98c `09e900e` → S98d `96b9f28`.
- S98e er dokumentationsclosure ved samme HEAD; rapport, roadmap og denne
  handover afventer review/checkpoint. Verificér altid faktisk Git-status.
- Læs [S98-closure](../architecture/P0021-slice-98e-claude-review-closure.md).
  Claudes efterreview bekræfter F1a/F4/F5/F1b/F2 CLOSED inden for aftalte scopes.
  N2 (rollback efter dirty slots), N3 (source-reentrancy), N4 (præcis invalidation/
  task-isolation) og N7 (ikke-Value batchhale) er CLOSED.
- **N6 OPEN:** fire identitetstest-orakler er fortsat svage. Desuden skal tre
  øvrige `deepEqual(getBlocks(), before)`-orakler styrkes med løsrevne snapshots.
  Dette er testdækningsarbejde, ikke en verificeret ny produktionsfejl.
- **Tekstbloknotifikationer OPEN:** `moveBlock`/`removeBlock` på tekstblokke kan
  notificere med `[undefined]`. Verificeret, lavprioriteret eksisterende fejl;
  ingen rettelse i S98e og ingen automatisk implementeringsopgave i S99.
- Gemte S98e-kørsler ved uændret kode: Node 1701 PASS / 0 FAIL / 7 TODO / 1 SKIP (1709 cases).
  Python: 264 PASS. Reel Chrome/Worker/Pyodide/SymPy: 31 grupper PASS.
  Parser-sync og whitespace PASS. Populationerne må ikke lægges sammen.
- F3: HistorySession fail-closed ved fremmede mutationer er accepteret adfærd.
  Ingen implicit history-reset/replay/recovery. Vilkårlige hostcallback-sideeffekter
  har ingen generel rollbackgaranti; host-epoch er fortsat særskilt og monoton.
- Legacy-listenerfejl er forskellige: `setBlockSource` kan rulle tilbage efter
  tidligere listeners er notificeret; direkte strukturmutationer kan allerede
  være accepteret, når listenerfejlen propagerer. Ingen fælles post-commit-garanti.
- DocumentRuntime er eneste dokumentautoritet. S97 read-only live views,
  immutable Values/Diagnostics og de særskilte identitets-/generationskontrakter består.
- FROZEN og accepterede ADR'er er uændrede; ADR-0007 er stadig Proposed.

## Første S99-samtale — spørgsmål, ikke beslutninger

Afklar sammen, hvilket konkret behov der skal prioriteres omkring `.ncas`,
persistens, Values, præsentation, data og plots. Kortlæg først gældende FROZEN,
ADR-0005 og eksisterende fil-/Value-/præsentationskontrakter og consumers.
Skeln mellem allerede besluttede regler og nye produktvalg. Identificér
eventuelt behov for en versioneret ADR, før en ny kontrakt eller kode fastlægges.

Ingen schemaændringer, nye dokumentmodeller, persistence-/plotimplementeringer
eller nye features er autoriseret af denne handover. Begynd med kontrakt- og
strategiafklaring; antag ikke, at rækkefølgen af emnerne er en implementeringsplan.

Syv TODO, Windows symlink-SKIP, legacy-UI/cutover, offline/pakning, ressource-
budgetter og fuld releaseacceptance er stadig åbne som beskrevet i closure.
Preview-manifestet er development-only; der er ingen ny elevrelease.
Bevar `chromedriver/`, `se-metadata.json` og ignorerede review-/testartefakter.
Ingen staging, commit, push, reset, clean eller oprydning er udført af S98e.
