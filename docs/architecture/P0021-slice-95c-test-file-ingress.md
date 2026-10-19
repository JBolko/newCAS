# P0021 Slice 95c — bounded test-file ingress for selected UI pilot

**Status:** GREEN candidate in Node-focused tests; requires Node 24 full test and **actual Pyodide browser acceptance**.
**Starting checkpoint:** S94 `296fbbe`; S95b browser + Pyodide accepted on the developer machine.

## Decision and scope

Permit the existing, **non-production S95b browser pilot** to open a small local JSON
source fixture so mathematical test inputs can be exchanged as files instead of
retyping three formula blocks. This is a TEST fixture, **not** the normative `.ncas`
file format, a save/load feature, a production importer, or EditingSession.

Fixture version: `newCAS-test-sources-v1`; maximum file payload **16 KiB**, exactly
three test-only block identities `pilot-a`, `pilot-f`, `pilot-result`; maximum
**1,024 characters per source**. Unknown fields, duplicate IDs, missing IDs,
invalid source types, oversized payloads and unexpected versions fail closed.
The fixture contains only source strings, not results, authority flags, IDs for
a new document, formulas to be executed while loading, cache data or Worker
requests. Block order in JSON does not alter existing document positions.

## Ownership boundaries

1. `parseS95cTestFixture` is a pure data validator in `tests/browser`. It does
   not invoke Peggy, the evaluator, the Worker, DocumentRuntime or DOM APIs.
2. Import changes **only the already-existing HTML draft input values**.
   All file content is validated before any input changes. Neither file select
   nor import calls `runtime.setBlockSource` or `session.run`.
3. Only the already-existing explicit **Beregn dokumentet** action advances
   the caller-owned revision and commits changed source via `DocumentRuntime`.
   The existing selected semantic batch runs in the **same supervised real
   Pyodide/SymPy Worker** as S95b. No legacy fallback or alternative evaluator.
4. This fixed-three-block pilot intentionally does not invent general editing,
   block insertion/removal, serialization, a new source-of-truth, or .ncas schema.
   The later reusable document fixture runner should use the actual
   EditingSession/DocumentRuntime lifecycle when those contracts are ready.
5. Only `textContent` is used for diagnostics and results; file text is never
   rendered as HTML or treated as executable JavaScript.

## Browser acceptance

From repository root, run `python -m http.server 8000`. Open
`http://localhost:8000/tests/browser/p0021-slice-95b-selected-ui-pilot.html`.

**Manual file import:** Select
`tests/browser/fixtures/p0021-slice-95c-three-formulas.json`, then click
**Indlæs testfil som kladde**. The fields show `a:=2`, `f(t):=t^2+a`, `f(3)`,
**without calculating**; click **Beregn dokumentet** to calculate `11`.

**Automated browser contract:** Click **Kør S95c-browseraccept**. The browser
fetches the bundled test fixture with `cache:'no-store'`, first commits a
different `a:=5` and checks actual Pyodide returns `14`, imports the fixture
into drafts, verifies authoritative DocumentRuntime still holds `a:=5`, and
only after explicit calculation verifies the fixture's `a:=2` and result `11`.
This is a browser probe against real Worker, not a JS testdouble.

## Deliberately deferred

- Arbitrary block counts, mixed task types, text blocks, file migrations,
  transactions, complete EditingSession and native `.ncas` save/load.
- Production `main.js` migration and student-release inclusion.
- Generic UI/i18n rendering and full mathematical operation coverage.

## Acceptance

S95c adds focused Node source/contract tests. Full `npm test` must remain green
on supported Node 24/Python on developer machine. As this slice changes the
browser ingestion path that reaches actual Pyodide, its real-browser test is
**required before GREEN acceptance**. Future checkpoint still needs broader
real-browser regression.
