# S97c.4 correction — GREEN, 21. oktober 2026

Denne sektion er det aktuelle evidensgrundlag og supplerer den oprindelige closure
nedenfor. Staged review fandt R1 (immutable write-through) og R2 (maskeret isoleret
invalidationstest). Begge fund er nu rettet i WORKTREE efter særskilt godkendelse.
Det eksisterende index med 32 paths er bevaret uændret. HEAD er fortsat
`88a0a9bd5dcd8e341501e7fd5251f31817c9d01a` på architecture-v1-implementation.
Ingen gen-staging, commit, reset, clean, push, sletning eller arkivering er foretaget.

## R1: lokal immutable-bevisførelse

`src/js/runtime-readonly-view.js::immutableContract` kræver nu frosne, acykliske,
understøttede data før Value/Diagnostic-pass-through: plain/null-prototype objects,
normale arrays, finite primitive værdier og egne enumerable data-properties (plus
array length). Accessors læses ikke. Funktioner, symboler, hidden fields, cycles,
Map/Set/Date/WeakMap/WeakSet/ArrayBuffer/DataView og andre exotic prototypes kan ikke
attesteres alene med Object.isFrozen. En aktiv rekursionssti afviser cycles, mens
separat verified-memo tillader delte acykliske immutable referencer.

`isolateRuntimeInput` afviser også arrays med brugerdefineret prototype, så fallback-
kopiering ikke omgår den understøttede datagrænse. Uunderstøttet input afvises før
admission. Ægte korrekt konstruerede immutable Values/Diagnostics beholder deres
identitet, prototype og validators. De generelle P0005/P0009-kontrakter og kode er
ikke ændret. Der er ingen produktionsbagdør eller alternativ dokumentautoritet.

De fem oprindelige fejlede reviewprober er permanente i
`tests/js/p0021-slice-97c4-immutable-boundary.test.mjs`. Write-through-proben
forventer nu afvisning allerede ved admission; en separat pass-through-probe
kontrollerer, at read-only-grænsen heller ikke udleverer den farlige Map direkte.
De 30 tests dækker også Value-lignende envelopes, frosne funktioner, cycles,
accessors uden eksekvering, hidden/symbol fields, øvrige interne slots, genuine
immutable identitet/prototype, delte acykliske data og prepareBlock/insertBlock.
Afvisning bevarer dokument, source-token, mutationsstempel, host revision,
historikcursor og redo-gren; efterfølgende redo fungerer fortsat.

## R2: isoleret dirtying-bevis genetableret

De tre cases i `tests/js/test-document-runtime.mjs` bevarer oldAnalysis før move,
men re-seeder derefter berørte blokke gennem den sikre calculate-helper til success
før det eksplicit testede invalidateStructuralChanges-kald. Tests kræver success,
non-null result og null error før kaldet og dirty, generation+1, null result/error
bagefter. Affected sets, downstream og anden tasks uændrede slotidentitet kontrolleres.

Målrettet mutationstest, kun i isolerede child processes: en preloader lader den
rigtige metode beregne affected sets, men deaktiverer dens markBlockDirty-kald.
Den staged baseline bestod forkert alle tre cases; de korrigerede tests fejler alle
tre på success != dirty. Normal implementation består alle tre. Ingen sourcefil
eller index ændres af mutationstesten; harness og logs er ignorerede reviewartefakter.

## Faktiske testresultater efter korrektionen

| Kontrol | Total | PASS | FAIL | TODO | SKIP |
| --- | ---: | ---: | ---: | ---: | ---: |
| S97c.4 første permanente RED | 28 | 13 | 15 | 0 | 0 |
| S97c.4 final targeted | 30 | 30 | 0 | 0 | 0 |
| R2 korrigeret normal implementation | 3 | 3 | 0 | 0 | 0 |
| R2 mutant mod gammel staged opstilling | 3 | 3 | 0 | 0 | 0 |
| R2 mutant mod korrigeret opstilling — forventet mutation-kill | 3 | 0 | 3 | 0 | 0 |
| Fokuseret S95–S97 inkl. runtime-regressioner | 447 | 447 | 0 | 0 | 0 |
| Full Node v24.11.0 | 1509 | 1501 | 0 | 7 | 1 |
| Full Python unittest | 264 | 264 | 0 | 0 | 0 |
| Real Chrome 155.0.8059.85 / Pyodide / SymPy | 16 | 16 | 0 | 0 | 0 |

De tre FAIL på mutanten er det tilsigtede bevis for forbedret testdækning, ikke
produktfejl. Ingen cancellation. Parser source/AST sync og whitespace-kontrol PASS.
De syv tidligere TODO og Windows EPERM-symlink SKIP er uændrede og fortsat åbne.

Alle fire relevante browsergrupper er genkørt: S96b.2 3 PASS, S97a 4 PASS,
S97b's S95f/k/m/p 4 PASS og S97c inkl. S97c.4 5 PASS. Den nye case afviser frosne
exotic Diagnostic-inputs uden ændret token, epoch eller historik, hvorefter de
samme rigtige Worker-forløb verificerer live resultater, Undo/Redo, Undo-delete,
source-ABA og stale publication. Ingen offline cold-start-acceptance påstås.

## Scope og plan før checkpoint

Worktree-korrektionen berører én produktionsfil, to eksisterende tests/browserfiler,
fire eksisterende statusdokumenter og én ny permanent testfil. Det opdaterede
checkpoint-scope er de eksisterende 32 paths PLUS den nye S97c.4-test: **33 paths**.
Den permanente filoversigt nedenfor er opdateret; det nuværende index er IKKE.
ADR-0007 forbliver Proposed for review; FROZEN/accepterede ADR'er er uændrede.
R1 og R2 er lukket på det beskrevne testgrundlag. Ingen nye kontraktproblemer fundet;
øvrige tidligere dokumenterede release-/scopegrænser består.

Ignorerede logs, mutation-harness, index-baseline, præcist diff-regnskab og foreslået
33-path allowlist: `tools/reports/s97c4/`. Første RED: red.tap; final-targeted.tap;
r2-green.tap; r2-mutant-staged.tap; r2-mutant-corrected.tap; focused.tap;
full-node.tap; python.txt; browser-s96/a/b/c.txt. Artifacts slettes ikke.

Efter særskilt godkendelse: (1) verificér HEAD og uændret index mod den gemte
baseline; (2) gen-stage præcis de 33 godkendte paths med literal/NUL-manifest;
(3) maskinel eksakt staged path-set-kontrol og cached whitespace-check;
(4) nyt samlet staged diff-review inklusive R1/R2 og dokumentationsopdateringer;
(5) forelæg endelig commitgodkendelse. Ingen commit før den godkendelse.
Selenium-cache, root chromedriver/se-metadata, logs, ZIP/backups og migrationspayloads
forbliver udelukket. Ingen oprydning er udført eller autoriseret af denne slice.

---

## Oprindelig S97-closure (før review-korrektion; aktuel evidens ovenfor)

# S97 closure — S97a / S97b / S97c GREEN

**Status:** Implemented and verified; uncommitted, awaiting review/checkpoint approval.
**Authority:** Informative. FROZEN v1.0 and accepted ADRs are unchanged.
**Baseline:** `architecture-v1-implementation`, HEAD
`88a0a9bd5dcd8e341501e7fd5251f31817c9d01a` (S96 checkpoint).

## Outcome and boundaries

S97a protects chronology through public mutation APIs. S97b gives the selected
formula editor one history commit owner. S97c closes writable document-reference
paths with private owned data and stable deeply read-only block views.
DocumentRuntime remains the sole document authority. HistorySession holds
reversible primitive operations/cursor; EditingSession holds drafts. No parallel
document model, evaluator, scheduler, mathematical feature, replay or fallback.
No staging, commit, push, reset, clean, deletion or archival occurred in this
continuation. Existing S97a/b changes and permanent regressions are preserved.

Reviewed authority: FROZEN specification §§4, 18.1 and 19; stress cases 31/32/50/52;
review resolution 2.11/2.13; accepted ADR-0004 rev2, ADR-0005 and ADR-0006.
The new ADR-0007 v1 is **Proposed for review**, not normative or accepted. The user
explicitly approved S97c's implementation contracts; the draft records them for
later architecture review without editing existing normative documents.

## Completed slices

| Slice | Contract | Production scope |
| --- | --- | --- |
| S97a | Fresh runtime-owned mutation identity, independent of source identity, calculation generation and host epoch; history/content and prepared-plan chronology guards | document-runtime.js; create-document-history-session.js |
| S97b | One injected HistorySession owns transaction, history and revision for selected Enter/structure/whole-document formula actions; unchanged action preserves redo/epoch | create-formula-structural-action.js; create-semantic-calculate-action.js |
| S97c.1 | Private block storage and internal writable access; stable protected live views; admitted input isolation | document-runtime.js; runtime-readonly-view.js |
| S97c.2 | Nested arrays/calculations/results/diagnostics and runtime graph Map/Set/iterator/descriptor paths protected; immutable contracts preserved | same two S97c production files |
| S97c.3 | Identity through atomic source transactions/rollback/Undo; fresh delete/recreate incarnation; safe fixture migration; actual browser acceptance | runtime plus permanent Node/browser regression fixtures and reusable runner |

S97a includes same-source direct writes and applied net-zero compounds as mutations.
No-ops, preparation/rejection, full rollback and derived calculation do not mutate
the stamp. Direct partial structural writes refresh it before a possible rebuild
exception. History checks both stamp and content before revision/cursor changes.
Prepared transactions reject structural/source ABA and remain single-use.

S97b preserves non-history behavior and source-only task-isolated calculation.
Its optional whole-document mode is restricted to the existing single-task
FormulaBlock test document. It compiles remove/insert/move/source proposals into
ONE existing runtime transaction. The S95f/k/m/p test surface shares one global
history owner across Enter, structure, Calculate and Undo/Redo; no competing
handler-local owner or direct structural pre-pass remains in that surface.
Unchanged proposals cross history guards, preserve redo/revision and still evaluate.
A source acceptance event remains separate from asynchronous evaluation settlement.
A late Worker failure keeps the accepted edit/Undo; no hidden retry or replay.

## Exact S97c public boundary

- Owned blocks, dependency analyses and listener storage are private class fields.
  Non-configurable public storage readers reject assignment and reflection shadowing.
- `blocks` returns a frozen order snapshot containing protected block views.
  `getBlocks()` returns a detached, locally mutable order array of the same views.
  Neither array is authoritative storage.
- `getBlock(id)` and `addBlock()` return the stable view of that incarnation.
  Move, direct source edit and history source replacement/Undo preserve its view.
  A private WeakMap handle retargets to the accepted source candidate only after
  rollback-capable publication succeeds, before observer notification. It stores
  no alternative document content, history, evaluator state or source registry.
- Delete/recreate, including Undo-delete with the same block ID, creates a fresh
  view and source token. An old deleted view cannot follow a new incarnation.
- Read `heldBlock.calculation` after evaluation to observe current published data.
  A retained nested slot/graph view protects the particular object read earlier;
  it does not subscribe across replacement of that object or graph rebuild.
- Nested dependencies, calculation/error/result objects, arrays and graph Map/Set
  values remain read-only through direct reads, descriptors, iterators and callbacks.
  Property writes, deletion, defineProperty, prototype changes and freezing views
  are rejected. Shadow targets avoid frozen-property Proxy invariant leaks.
- Genuine deeply immutable Values and Diagnostics are returned unchanged from
  the accepted runtime boundary, preserving prototype, identity and validators.
  The existing upstream evaluator-outcome gate still serializes/copies before
  this boundary; S97c does not change that established behavior.
- Block admission recursively isolates inert finite primitives, arrays and plain
  objects (including null-prototype objects). Immutable contracts may be retained.
  Functions, symbols, accessors, non-enumerable hidden data, cycles, Date/Map/Set
  and other mutable exotic input are rejected with `S97C_INPUT_INVALID` before
  authority changes. Formula source and nonempty string task identity are checked.
  Formula dependencies/calculation slots remain runtime-derived, not caller-owned.
- Public prepareBlock returns a protected prepared candidate. Transaction plans
  expose only frozen primitive operations; their raw candidates remain private.
  Legacy returned evaluator objects are isolated before storage, so mutating the
  original returned object cannot change a calculation slot.

The internal objects are NOT deep-frozen. Runtime mutation/invalidation/rebuild/
atomic rollback continue through private owned access. `Object.isFrozen(view)` is
not the read-only API; immutable Values/Diagnostics retain their actual freeze.
Native `structuredClone` cannot clone Proxy views. Consumers requiring detached
serialization must project inert data; the migrated tests use explicit JSON data
snapshots for their JSON-safe calculation fixtures. No new persistence format or
public write-back/export mechanism was added.

## Consumer audit and fixture migration

The pre-implementation lexical inventory and ownership classification are retained
in S97_REVIEW.md. Runtime readers were checked in EditingSession, HistorySession,
structural/Calculate actions, supervised task sessions and S95/S96/S97 browser
fixtures. Semantic snapshot readers are detached consumers, not live block storage.
The selected editor reads source/task/order/results and needed no writable access.

Ten existing tracked test files required fixture adaptation; the untracked S97a
regressions were also migrated. `tests/helpers/runtime-fixtures.js` is TEST-only:
legacy slots are established through calculateBlock with a scoped fake engine;
semantic slots through real public source/evaluation entrypoints. Dirty state uses
markBlockDirty; order uses moveBlock; task replacement uses remove/insert. No
private access, production test hook or permissive writer was introduced.

Assertions are retained for calculation invalidation, generations, rollback,
history, task isolation and stale results. Writable-result reference assertions
become data equality where a protected view intentionally replaces a mutable
object. The former raw task-change case now exercises replacement into another
task; raw field writes are separately rejected by S97c. The S97a raw-content guard
probe now verifies rejection before mutation; content guarding remains in production.
Partial structural-failure fixtures restore visible content through supported APIs,
while still asserting the token changes at the original partial-failure boundary.

Two original S97c probes were corrected to match the actual/approved API: dependency
arrays are `dependencies.reads` rather than the enclosing dependency object, and a
getBlocks block-source assignment is expected to be blocked. Value identity is
asserted against the existing accepted immutable outcome, not the pre-copy evaluator
input. These are explicit boundary corrections, not removed failure coverage.

## RED → YELLOW → GREEN evidence

| Run | Total | PASS | FAIL | TODO | SKIP |
| --- | ---: | ---: | ---: | ---: | ---: |
| S97a extended RED, before implementation | 62 | 9 | 53 | 0 | 0 |
| S97a final targeted | 62 | 62 | 0 | 0 | 0 |
| S97b RED, before production changes | 23 | 5 | 18 | 0 | 0 |
| S97b final targeted | 23 | 23 | 0 | 0 | 0 |
| S97c extended RED, before production changes | 29 | 5 | 24 | 0 | 0 |
| S97c initial YELLOW | 29 | 28 | 1 | 0 | 0 |
| S97c reflection/storage sub-slice RED | 37 | 33 | 4 | 0 | 0 |
| S97c final targeted (includes all original 12) | 41 | 41 | 0 | 0 | 0 |
| Final focused S97a/b/c | 126 | 126 | 0 | 0 | 0 |
| Final FULL Node v24.11.0 | 1479 | 1471 | 0 | 7 | 1 |
| Final FULL Python unittest | 264 | 264 | 0 | 0 | 0 |
| Final actual browser scenario groups | 15 | 15 | 0 | 0 | 0 |

No cancellations. Full Node discovery was rerun after fixture migration and final
runtime changes; no existing non-TODO regression fails. The final full Node tree
is GREEN; the earlier intentional S97c RED closure status is superseded.
A diagnostic-validation integration failure was fixed by preserving genuinely
immutable Diagnostics at the boundary; the original S94d tests pass unchanged.

S97c tests cover input aliases/exotics/hidden fields/accessors without execution,
nested calculation/dependency/result/diagnostic arrays, immutable container Values,
reflection, graph Map/Set methods/iterators/callbacks, order snapshots/live roots,
source identity rotation, source/history/net-zero transactions, full rollback,
source ABA, direct delete/recreate and Undo-delete, and asynchronous stale publication.

### Inherited TODO/SKIP classification — no silent acceptance

- **1 S90 TODO:** sequential statements as one block; separate contract/ADR gate.
- **2 F7 TODO:** symbolic diff target and sum dummy binding metadata; math-scope gaps.
- **3 F8 TODO:** substitution parsing, scientific notation and exact literal precision;
  language/numeric-scope gaps.
- **1 F4 TODO:** hostile unit grammar acceptance; grammar/input-validation gap.
- **1 SKIP:** Windows EPERM prevents creating a real filesystem symlink. Portable
  guards pass, but an environment that permits symlinks must run this release case.

These pre-existing release gaps are outside S97 and remain open. No new TODO/SKIP.
No full mathematical capability or student/offline release acceptance is claimed.

## Actual browser / Pyodide / SymPy evidence

Installed Chrome **155.0.8059.84**, production supervised Worker and actual
Pyodide/SymPy. Four page groups, **15 PASS / 0 FAIL / 0 TODO / 0 SKIP**:

| Group | Scenarios | Demonstrated |
| --- | ---: | --- |
| Preserved S96b.2 | 3 | Early Enter draft release and real value 16; Undo rejects delayed Worker and preserves newer draft; unchanged Enter preserves redo |
| Preserved S97a | 4 | Separate mutation/source identities; foreign source ABA rejects delayed result/history without epoch consumption; recalculation/Undo/Redo; text structural ABA rejects prepared plan/history |
| Shared-history S97b S95f/k/m/p | 4 | Variable block counts; draft-only typing/Enter; insert/move/delete and active-draft protection; Undo/Redo/branching. Actual results 11/18, 14/21/30, 17/24, 15/22 |
| New S97c | 4 | Public array/block/nested/reflection/graph writes rejected; held live view reads actual 16; immutable Value identity; Undo/Redo actual 3/16; fresh Undo-delete view; raw mutation during delayed Worker blocked and supported source ABA rejects stale 17 before fresh actual recalculation |

Two initial sandbox browser attempts crashed at navigation (`tab crashed`), before
scenario execution. The same page passed outside the process restriction, followed
by all final gates. This was not reported as a product FAIL or SKIP. Browser logs
are retained. Selenium Manager also created root `chromedriver/` and
`se-metadata.json` during those attempts; they are untouched temporary artifacts,
explicitly excluded from checkpoint. The reusable runner now defaults its cache
to ignored `tools/reports/selenium-cache/`; its default S96 acceptance remains.

These are network-backed installed-dependency browser checks. Offline cold-start,
network-free packaging and additional browser engines are NOT verified.

## Dependency graphs, caches and remaining scope

Runtime-owned dependencyAnalysis, graphs, nested maps/sets and listener storage
are protected readers; collection replacement cannot replace private storage.
Standalone DependencyGraph remains mutable for its own callers. Fresh
`deriveSemanticTask` / `captureSemanticAnalyses` results and prepared evaluation
batches are detached derivations. A caller mutating a detached derivation does not
write the stored authoritative sources/graph; no persistent second cache is added.
Selective cached outcomes are invocation-local; stored cache Values are immutable.

The retained legacy engine and its getTaskState namespace remain a separate,
explicit legacy boundary. Semantic-only runtime rejects those entrypoints. S97c
protects runtime-held legacy result slots but does not redesign engine-owned state.
Methods and global JS primordials are trusted code; this is an ownership API, not
a security sandbox against malicious monkeypatching of an entire realm.

Open work remains: generic rollback for direct structural APIs (partial writes
are exposed by S97a); text/multi-task structural history routing; legacy student
UI cutover and full P0026–P0028 feature acceptance. No automatic history reset was
introduced. No further S98/product work was started. No known new blocking runtime
regression remains on the reported test ground.

## Verification commands and evidence locations

- `node --test --test-reporter=tap` — all discovered Node tests.
- Explicit targeted S97a/b/c files — 126 tests.
- `python -m unittest discover -s tests/python -p test_*.py` — 264 tests.
- `node tools/build/generate_canonical_parser.mjs --check` — exact source sync PASS;
  canonical regenerated-AST/sync tests also PASS in full Node. Parser untouched.
- `git diff --check` PASS; index empty; HEAD unchanged; no tracked FROZEN/ADR diff.
- `python tools/dev/run-s96b2-browser.py` plus `--page`/`--result-variable` and the
  four ordered S95 acceptance `--buttons` — actual browser cases above.

Final logs under ignored `tools/reports/`:
`s97-closure-focused.tap`, `s97-closure-node.tap`, `s97-closure-python.txt`,
`s97-closure-browser-s96.txt`, `s97-closure-browser-a.txt`,
`s97-closure-browser-b.txt`, `s97-closure-browser-c.txt`.
Earlier transition logs: `s97c-extended-red.tap`, `s97c-yellow.tap`,
`s97c-storage-red.tap`, `s97c-input-red.tap`, `s97c-final-targeted.tap`.
Earlier S97a/b logs remain under the original ignored S96 archive/report directory.

## Checkpoint proposal — do not stage or commit yet

Review this closure, the proposed ADR and the complete permanent tracked/untracked
diff. Include the S97a/b/c production code, permanent Node/browser tests, TEST-only
fixture helper, browser runner, current roadmap/handover/review/closure and draft ADR.
Exclude root Selenium cache/metadata, all tools/reports logs/caches/archives, ZIPs,
backups and migration payloads. No root artifact has been removed or archived.
A fresh explicit staging allowlist and exact staged-set verification should precede
any later approved commit; the old S96 allowlist is not an S97 staging instruction.

Proposed title:
`P0021 S97: unify history mutations and protect runtime read views`

Proposed body:

```text
Track public document mutation chronology independently of source and evaluation
identities, route selected formula actions through one HistorySession, and expose
stable deeply read-only incarnation views over private runtime-owned data.

Isolate caller inputs and nested graph/calculation references, preserve immutable
Value/Diagnostic contracts, and migrate writable fixtures through supported APIs.
Document compatibility changes and propose ADR-0007 v1 for review (not accepted).

Validation: Node 24.11.0 1501 PASS / 0 FAIL / 7 TODO / 1 SKIP (1509 total);
focused S95-S97 447 PASS; S97c.4 30 PASS; Python 264 PASS;
actual Chrome/Pyodide/SymPy 16 PASS. R1 immutable proof and R2 isolated invalidation
coverage are corrected; the no-dirty mutant is killed by all three repaired tests.
Parser source/AST sync and whitespace checks pass. Existing TODO/symlink and
text/multi-task routing, direct structural rollback, legacy/offline release limits
remain documented. FROZEN and accepted ADRs are unchanged.
```

Before checkpoint: user review/approval, fresh allowlist, staged-diff audit and
whitespace check. The ADR needs separate review before normative acceptance.
Any cache cleanup/archive is a separately authorized operation after review.

## Permanent diff paths relative to S96 HEAD

The following inventory excludes only the explicitly classified root Selenium
artifacts; it includes existing uncommitted S97a/b and all new permanent S97c work.

- `docs/Styredokumenter/CODEX_HANDOVER_S97.md`
- `docs/Styredokumenter/ROADMAP_AKTUEL.md`
- `docs/Styredokumenter/S97_CLOSURE.md`
- `docs/Styredokumenter/S97_REVIEW.md`
- `docs/adr/ADR-0007-document-runtime-readonly-boundary-v1.md`
- `docs/architecture/P0021-slice-97a-history-mutation-divergence-red.md`
- `docs/architecture/P0021-slice-97a-history-mutation-identity.md`
- `src/js/document-runtime.js`
- `src/js/editing/create-document-history-session.js`
- `src/js/editing/create-formula-structural-action.js`
- `src/js/runtime-readonly-view.js`
- `src/js/ui/create-semantic-calculate-action.js`
- `tests/browser/p0021-slice-95f-dynamic-document.mjs`
- `tests/browser/p0021-slice-97a-history-mutation.html`
- `tests/browser/p0021-slice-97a-history-mutation.mjs`
- `tests/browser/p0021-slice-97c-readonly-authority.html`
- `tests/browser/p0021-slice-97c-readonly-authority.mjs`
- `tests/helpers/runtime-fixtures.js`
- `tests/js/p0021-document-runtime-result-invalidation.test.mjs`
- `tests/js/p0021-runtime-semantic-reactive-invalidation.test.mjs`
- `tests/js/p0021-runtime-stale-no-retry.test.mjs`
- `tests/js/p0021-slice-86a-document-source-boundary.test.mjs`
- `tests/js/p0021-slice-95d-engine-free-document-runtime.test.mjs`
- `tests/js/p0021-slice-95e-semantic-ui-calculate-action.test.mjs`
- `tests/js/p0021-slice-95i-formula-editing-session.test.mjs`
- `tests/js/p0021-slice-95n-document-transaction.test.mjs`
- `tests/js/p0021-slice-96a-mutation-atomicity-red.test.mjs`
- `tests/js/p0021-slice-97a-history-mutation-divergence-red.test.mjs`
- `tests/js/p0021-slice-97b-history-aware-actions.test.mjs`
- `tests/js/p0021-slice-97c-authority-encapsulation-red.test.mjs`
- `tests/js/p0021-slice-97c4-immutable-boundary.test.mjs`
- `tests/js/test-document-runtime.mjs`
- `tools/dev/run-s96b2-browser.py`

Excluded temporary untracked paths (preserved):

- `chromedriver/win64/155.0.8059.84/chromedriver.exe`
- `se-metadata.json`
