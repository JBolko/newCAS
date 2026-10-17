# P0021 Slice 89a — allowlist-based distribution boundary

Status: **GREEN candidate**, acceptance on user Node 24 pending.

## Why

Student deployments must not depend on `.gitignore` or manual removal of developer files. They must never accidentally include `tools/reports/*.zip`, migration scripts, Repomix snapshots, test suites, test logs, `.git`, `.venv` or `node_modules`.

## Delivered

- `tools/release/student-preview-manifest.json`: explicit **per-file** allowlist for the runtime assets visible in the current repository/tree, including CSS, KaTeX and fonts, JS modules, Python modules and the entry page; `releaseReady` is permanently `false` for this slice.
- `tools/release/student-preview.mjs`: validates every manifest entry (canonical paths, extensions, duplicate case-folded names, forbidden dirs, symlinks) and all referenced source files before copying. Programmatic preview staging is outside the repository and refuses overwriting an existing target.
- Runtime manifest cannot contain developer files even if they exist on disk; test fixtures create extra files and prove they never get copied.
- `--verify` checks that the student's **present** working tree has all allowlisted source inputs; it never creates a release archive.
- `--release` **intentionally fails**: no student-distributable ZIP exists yet. Current `src/js/main.js` still instantiates `CASEngine` and `Transformer`, and the legacy injection/security review is not fully closed. The future final release path needs UI→DocumentRuntime/IR migration, browser E2E, resource closure/offline tests and a separate explicit release gate.

## Non-goals and architectural discipline

No engine, parser, frozen contract, Python runtime, URL fetching or document semantics are changed. The manifest is an initial snapshot, not a statement that all eventual offline resource dependencies have been audited. In particular Pyodide and other CDN dependencies must be reviewed before an offline student release. No quick fixes or implicit additions to the allowlist: future files require explicit manifest review.

## Acceptance

- `node --test tests/js/p0021-slice-89a-student-preview-allowlist.test.mjs` must be GREEN.
- `node tools/release/student-preview.mjs --verify` must be GREEN on actual user root.
- `node tools/release/student-preview.mjs --release` must refuse (test asserts this without causing test failure).
- Full `node --test` and Python unittest suite must be GREEN in user Node 24 / Python environment.
- Clean up previous one-shot scripts only when their SHA256 matches what was shipped; never use indiscriminate `git clean` or remove test history.

## Relation to multiple statements per block

`a:=1; b:=3; resultat:=a b` is already parsed by the canonical grammar; executing it remains a **separate architectural problem** requiring per-statement writer identity, intra-block order, binding/invalidations, output and diagnostics. No grammar or IR changes here. The `;` separator remains a strong candidate, but no irreversible semantic commitment is made.
