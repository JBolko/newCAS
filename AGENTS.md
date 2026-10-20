# newCAS — proposed root AGENTS.md (review before adopting)

This file defines workflow guardrails for a coding agent working in **this repository**. It is *not* normative architecture. If `AGENTS.md` already exists, merge after review instead of overwriting it.

## Authority

- The three documents in `docs/architecture/v1.0/` (`ARCHITECTURE_SPECIFICATION_FROZEN_v1.0.md`, `ARCHITECTURE_STRESS_TESTS_FROZEN_v1.0.md`, `ARCHITECTURE_REVIEW_RESOLUTION.md`) and applicable accepted ADRs are normative. Do not modify frozen semantics implicitly. Changes require a versioned ADR and explicit user approval.
- Roadmaps, handovers, external reviews, and previous agent suggestions are informative, not normative. When the code disagrees with a frozen rule, call out the discrepancy rather than silently redefining the rule.
- DocumentRuntime owns authoritative sources, document order, task isolation, dependencies, invalidation and result publication. EditingSession holds only draft state; HistorySession owns reversible edit history, not a second document model.
- Preserve existing Semantic IR / immutable Value / stateless supervised Worker separation. Do not introduce new evaluators, document mirrors, implicit replay or legacy Python string-codegen in the selected pipeline.
- Keep host-owned monotonic revision/epoch, edit/source identity, and calculation generation distinct unless an explicit contract review approves a change.

## Working method

- For a new slice, first inspect `git status --short`, current branch and HEAD; protect pre-existing user edits. Never reset, clean, overwrite or commit without explicit approval.
- Work in small, testable slices: RED -> YELLOW -> GREEN. Before implementation, state affected files, RED expectations, invariants, regression scope and rollback plan.
- No commits, pushes, force operations or releases without explicit user approval. Don't change unrelated files or expand the scope on your own.
- Run the targeted Node tests, then suitable regressions; run full Node 24 / Python and real-browser Pyodide/SymPy checks when their boundaries are affected. Report actual counts, FAIL/TODO/SKIP and what was not tested. Never claim full acceptance from mocks alone.
- Diagnostic codes/parameters are structured and locale-independent; UI localization follows in presentation. No hidden fallback to legacy evaluation.
- Student release artifacts use an allowlist: exclude migrations, tests, `tools/reports/`, Repomix dumps, ZIP logs, .git, and virtual environments.
- On uncertain contract points, stop after an analysis and proposed RED tests; ask for a decision rather than taking an architecture shortcut.


## Parser and student-facing conventions (retained from retired May 2026 Claude guidance)

- `src/js/parser.mjs` is generated: **never edit it manually**. The grammar source is `docs/Grammatik.pegjs`. Inspect the *current* repository build/verification tooling before regenerating or claiming parser sync; do not assume the obsolete `npm run build:parser` command exists.
- Danish mathematical notation and readable Danish student-facing errors are product requirements. Preserve any established comma/semicolon, degree/radian, and display conventions; check the canonical grammar and current contracts before altering them.
- Structured diagnostics (codes + parameters) are produced below the UI. Localized Danish explanations belong in presentation; no raw Python tracebacks or arbitrary backend errors in student UI.
- Offline-first student operation is a product requirement, **not yet a completed release claim**. Real Pyodide/Worker, dependency packaging and network-free cold-start must be tested before declaring offline acceptance.
- The May 2026 instructions formerly stored as root `claude.md.txt` (headed `CLAUDE.md`) are **retired legacy guidance**: its transformer -> Python string-codegen pipeline, old result envelope, legacy E2E count/status and 'Worker not implemented' statements are superseded. Never use it as current authority.

## Current work

Read `docs/Styredokumenter/CODEX_HANDOVER_S96.md` if present for the current non-normative checkpoint. Do not infer worktree state from its date; always verify the actual files and tests.
