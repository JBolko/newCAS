# newCAS — handover efter S95a–p (19. oktober 2026)

> **Status og proveniens:** Dette handover bygger på den frosne roadmap, de leverede S95 ZIP-slices, test-verifikationsscripts og brugerens rapporterede Node 24/browseraccept. Det erstatter ikke direkte gennemgang af det endelige committed repository. **Ny S95-commit findes endnu ikke i den senest rapporterede Git-status.** Efter commit skal den faktiske hash føjes til dette dokument eller medsendes separat.

## 1. Kompas: én arkitektur, ikke flere motorer

- Branch: `architecture-v1-implementation`. Seneste **bekræftede commit før S95**: `296fbbe` — *P0021 checkpoint: S94 supervised Worker and revision-coupled recovery*.
- Normative: `docs/architecture/v1.0/ARCHITECTURE_SPECIFICATION_FROZEN_v1.0.md`, `ARCHITECTURE_STRESS_TESTS_FROZEN_v1.0.md` og `ARCHITECTURE_REVIEW_RESOLUTION.md` samt relevante ADR'er. Roadmap/handover er statusdokumenter, **ikke normative ændringer**.
- Dokumentautoritet: **DocumentRuntime** ejer kilde, stabile task-/blokidentiteter, rækkefølge, writer/binding/DAG, revision/epoch, afledt beregningstilstand og invalidation. EditingSession ejer kun ucommittede kladder. Transaktionsplan og apply for FormulaBlocks implementeres i den **eksisterende DocumentRuntime**.
- Matematisk vej: kanonisk input/PEG → AST/semantiske roller og attestation → Semantic IR → OperationSpec/immutable Values → supervised Pyodide Web Worker → SymPy/Value-adapter → eksisterende renderer. Ingen parallele dokumentmodeller, evaluatorer, Python-kodegenerering/`exec` i ny motor eller usynlige legacy-fallbacks.
- Omskriv/ret **ikke** frozen v1.0-kontrakter uden eksplicit versions-/ADR-beslutning. ADR-0006: én atomisk instruktion pr. blok i v1; S90a's semikolonsekvens er **analyse**, ikke tilladelse til at aktivere multi-statement eval.
- Asynkron sikkerhed: **history cursor og runtime epoch er forskellige**. Undo må gå baglæns i dokumentindhold, men ikke i epoch; late results må aldrig committes på baggrund af en ældre generation, heller ikke efter at Undo har genskabt en identisk kildestreng.
- Brugeren foretrækker små, repo-relative RED→GREEN ZIP-slices med PowerShell-verifikation, eksplicit Node24/Python og **faktiske** Pyodide-browserprøver på integrationsgrænser. Lokalt Node22-miljø kan fejle pga. manglende Peggy; sammenligning mod uændret baseline er ikke ækvivalent med fuld GREEN.

## 2. Aktuel accept (brugerens maskine, 19. oktober 2026)

| Gate | Sidste rapporterede S95p-resultat |
| --- | --- |
| Branch / nuværende HEAD før S95-checkpoint | `architecture-v1-implementation` / `296fbbe` |
| Fokuseret S95p-regression | **151/151 PASS** |
| Fuld JavaScript-suite, Node24 | **1.309 PASS; 0 FAIL; 7 TODO; 1 SKIP** |
| Python | **264/264 PASS** |
| Kanonisk Peggy-check | **PASS** |
| Rigtig Pyodide/SymPy-browser | **PASS**: S95f (fil/struktur), S95k (Enter/EditingSession), S95m (insert/move/remove), S95p (transaktions-Undo/Redo) |

**Dette er accept af udvalgte end-to-end forløb, ikke komplette phase exits, Release 1 eller fuldt normativt stress-korpus.** Browseren blev kørt mod `http://localhost:8000/tests/browser/p0021-slice-95f-dynamic-document.html`; efter udskiftning af modul-filer kræves ofte Ctrl+F5. HTTP 304 alene er ikke en serverfejl.

## 3. S95a–p i korte træk

| Slices | Leveret | Afgrænsning |
| --- | --- | --- |
| a–d | Audit af aktiv legacy-vej; semantic-only udvalgt browserpilot med rigtig Worker; test-file ingress i **kladde**; `DocumentRuntime.createSemantic()` uden dummy-legacy-engine. | Pilot, ikke slutbruger-/release-UI. |
| e–h | Eksplicit calculate-commit, 1–32 testblokke, Value/P0009 projection gennem eksisterende `renderer.js`, audit af `main.js`-Enter/identity/authority. | `main.js` er **en midlertidig prototype** og skal ikke bevare sit visuelle design eller gamle event-semantik. |
| i–m | Én aktiv EditingSession-kladde; Enter → eksisterende calculate action; 1 ad gangen insert/move/remove; real Pyodide demonstrerer korrekt capture/nearest provider. | Ingen endelig multi-editor, copy/duplicate eller fulde task-boundaries. |
| n | `DocumentRuntime.prepareDocumentTransaction(operations)` og `applyDocumentTransaction(plan)`: source/insert/remove/move; valideret samlet før mutation; én autoritativ publicering; inverse handlinger og stabile ID'er. | FormulaBlocks; runtime allokerer ikke selv opaque ID'er; ikke all-content transaktioner. |
| o | Sessionbaseret lineær Undo/Redo med ny redigering, der forkorter redo-grenen. Ekstern ændring uden om history afvises (`fail closed`), ucommittet kladde beskyttes. | Historikken er ikke separat dokumentautoritet, og optager kun transaktionshandlinger. |
| p | Real browser/Worker-probe: insert→undo→redo→move→undo→redo→delete→undo→source edit→undo→new branch. Også stale result efter Undo. | Værktøj til browseraccept, ikke elev-UI og ikke `.ncas`-persistens. |

Konkret browserbevis med `a:=2` og `f(t):=t^2+a`: `f(3),f(4)` er 11/18; ny `a:=5` før funktionen giver 14/21; flytning af definitionen efter anvendelserne giver igen 11/18; source `a:=8` giver 17/24; efter Undo og ny `a:=6` fås 15/22, og redo-grenen er væk. Genberegning skete gennem rigtig Pyodide/SymPy, ikke gendannede resultat-snapshots.

## 4. Væsentlige ikke-lukkede kontrakter

1. **P0026–P0028 er PARTIAL.** Hele den fremtidige UI skal dirigere hver autoritativ kilde-/strukturændring gennem den samme transaktions- og historikgrænse. De tidligere 95e/95l testhandlinger kan stadig mutere direkte; Undo afviser korrekt historik efter en ekstern mutation. Cross-task moves, copy/duplicate, tekst/VAR, grafer, indstillinger, multi-editor/clipboard og fuld all-content Undo/Redo mangler.
2. **Ingen endelig elev-UI.** S95f-siden er et bevidst skrabet udviklingstestværktøj. Opgaven med layout, tilgængelighed, korrekt matematisk notation, fejlmeddelelser/P0009-lokalisering og vejledende UX er stor og stadig åben. Bevar ikke `main.js`-DOM-designet af sentimentalitet.
3. **`.ncas` er ikke ændret.** Brugeren forventer nogenlunde samme autoritative dokumentformat, der senere skal versioneres/udvides til grafer, tabeller m.m.; hver udvidelse kræver save/load/migration-bevis. Session-historik og runtime-afledte Values/Worker-state bør ikke blive authoritative `.ncas`-felter.
4. **Legacy er stadig aktivt via den gamle prototype:** `main.js` → `CASEngine`/`Transformer` → gammel Python kodegeneration/`exec`/`eval`; S95a/h rapporterer ruterne. S95 semantic-only browserbevis er **ikke** et fuldt UI-cutover eller P0038–P0042 exit. Legacy's restricted builtins er containment, ikke sandbox.
5. **Syv TODO og én skip** består fortsat som åbne dispositionspunkter; auditér konkret mod den **aktuelle** kode (F7 binder, F8 substitution/videnskabelig notation/præcision, F4 enhedssyntaks, S90 multi-statement m.fl.) og dokumentér lukninger. F7-lokale symbolidentiteter understøttes i udvalgte S93-ruter, men `integrate`/andre symbolske Worker-operationer er ikke globalt aktiveret.
6. Fuld normativ stressmatrix 53+, operationsdækning P0014–P0017, offline packaging, resource budgets, service-worker cache/versioning og fremtidigt elevprodukt er ikke færdige.

## 5. Git-checkpoint: sidste status fra brugeren

```
branch: architecture-v1-implementation
HEAD:   296fbbe P0021 checkpoint: S94 supervised Worker and revision-coupled recovery
 M .gitignore
 M src/js/document-runtime.js
 M src/js/renderer.js
 ?? src/js/editing/
 ?? src/js/ui/
 ?? docs/architecture/P0021-slice-95*.md
 ?? tests/js/p0021-slice-95*.test.mjs
 ?? tests/browser/... and tools/analyze/p0021-s95*.mjs
 ?? node_modules/, .local/, *.zip, repomix-*.md, logs, __pycache__ ...
```

**Vigtigt:** Hovedparten af S95-filerne er untracked, ikke modificerede. Brug en **explicit allowlist** til staging; `git add -u` overser dem, `git add -A` trækker uønskede filer ind. Ingen one-shot `tools/migrations/p0021-s*-verify.ps1`, ZIP, tests-rapporter, `node_modules`, `repomix-*.md`, caches, `.local` eller Python bytecode i Git. `.gitignore` er lokalt ændret; gennemse `git diff -- .gitignore` før den inkluderes. Afklar `package-lock.json`-versionering separat, ikke stiltiende i checkpointet.

Medfølgende `tools/migrations/p0021-s95-checkpoint-stage.ps1` kører Node 24/parser/full `npm test` og **stager kun** den eksplicitte S95-kode/test/docs/roadmap og dette handover. Den committer ikke. Kontrollér `git diff --cached --stat`, `git diff --cached --check` og den præcise fil-liste før manuel commit; dokumentér den faktiske hash i handover.

## 6. Hvad den næste tråd skal have

**Vigtigst:**

- Dette S95-handover og den **opdaterede** `docs/Styredokumenter/ROADMAP_AKTUEL.md`.
- De tre frosne v1.0-dokumenter plus relevante ADR'er som separat tilgængeligt grundlag (ikke kun et generisk gammelt sammenkog).
- **Ny-genererede efter checkpoint** repomix-filer fra **samme** HEAD, ikke filer fra S84/S94 eller `.local`:
  - `repomix-engine.md`: udvalgt Semantic IR/document-runtime/EditingSession/UI actions/renderer/Worker/Python, inklusive relevante legacy-ruter ved retirement-opgaver.
  - `repomix-tests.md`: JS, Python og browserkontrakter (særligt S95a–p, normative cases, regression).
  - `repomix-docs.md`: arkitektur-/ADR-noter, roadmap og de nye S95-noter.
  - `repomix-tools.md`: `package.json`, parser-generator, build-/audit-/testværktøjer, release allowlist. Undlad genererede rapporter og one-shot logarkiver.
- Separat: faktiske `git rev-parse HEAD`, `git status --short`, `node --version`, seneste TAP/npm/Python-summaries og browser-PASS-output. Pak ikke adgangstokens eller lokale personlige filer.

**Normalt unødvendigt:** både en kæmpe `repomix-architecture.md` *og* alle frozen-filer *og* `repomix-docs.md` med den samme tekst; vælg den mindste komplette, kildeægte samling. `repomix-review-tools.md` kræves kun ved konkret ekstern audit. Medtag kun Claudes ældre FINDINGS som **historisk** reference; de må aldrig erstatte aktuelle testbeviser.

Kontrollér de scripts som **faktisk** findes i `package.json` med `npm run` før `npm run pack:engine`, `pack:docs`, `pack:tools` eller `pack:tests`. Efter generering: kontrollér dump-dato, HEAD og inkluderingsmønstre; sørg for at S95 editing/UI-filer er med. Repo-root `repomix-*.md` og logarkiver **må ikke** følge med i student release.

## 7. Klar opstartstekst til næste tråd

> Vi fortsætter newCAS efter S95a–p. Den frosne v1.0-arkitektur og ADR'er er normative. Læs først dette handover og den opdaterede roadmap. Verificér **faktisk** Git-HEAD (før S95-checkpoint var `296fbbe`; antag ikke et senere hash), branch og konsistensen af de nye repomix-filer. S95p blev brugergodkendt 2026-10-19 på Node24 (151/151 fokus, 1.309 JS pass, 7 TODO, 1 skip, 264 Python pass) og S95f/k/m/p i rigtig Pyodide-browser PASS. EditingSession, DocumentRuntime-transaktioner og sessionhistorik er **kun** demonstreret for FormulaBlocks; alle øvrige mutationsveje skal samles under samme autoritet, før Undo/Redo kaldes UI-komplet. Den aktuelle testside er **ikke** den endelige elev-UI; `main.js` er en kasserbar prototype; `.ncas` er uændret og planlagt til kontrolleret udvidelse. Ingen parallel evaluator/dokumentmodel, ingen Python-string-codegen i ny motor, og runtime epochs kan ikke rulles tilbage ved Undo. Fortsæt med små RED→GREEN repo-relative ZIP-slices og kræv Node24, Python og ægte browseraccept ved grænseændringer. Start med dokumenteret status/åbne risici, ikke tilfældig omskrivning.

## 8. Arbejdsrutine og scope

- Giv PowerShell-kommandoer (kopiérbare) for installation/verifikation og sikker rapportopsamling. Vis eksakte beståede testtal og skeln fra TODO/skip.
- Ikke `git add -A`, ikke ukontrolleret sletning af filer i OneDrive/reparse-punkter; ingen commit uden stage-inspektion.
- Hold external Claude-review efter checkpoint afgrænset: først arkitekturinvarianter og risici i transactional Undo/Redo og epoch; fuld legacy-retirement review efter at gammel eksekvering faktisk er væk.
- Bevar enhedspræsentation, lærebogsnotation (`·` og `×` i UI, ikke matematiske backend-shims), kommende pædagogisk monotonicitetslinje og i18n som separate, bevidste UI-/semantikopgaver.
