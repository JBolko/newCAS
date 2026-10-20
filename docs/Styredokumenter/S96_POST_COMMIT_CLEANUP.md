# S96 checkpoint organization and post-commit archival plan

**Non-normative proposal, 2026-10-20. No staging, commit, archival or deletion has run under this plan.**
Baseline branch: `architecture-v1-implementation`; HEAD: `8a7b0d47131b9004855fb64205a2fa13dde07a9d`.

## Scope for the user's current review

- Permanent S96b.2 evidence moved to `docs/architecture/P0021-slice-96b2-history-enter-source-identity.md`.
- Include the existing `claude.md.txt` deletion explicitly. It is obsolete instruction text, not executable code; active legacy runtime removal is a separate slice.
- Retain AGENTS.md, FROZEN v1.0, accepted ADRs, all six S96 regression files, both browser fixtures, reusable developer tools, roadmap, handover and closure.
- Git checkpoint allowlist: `tools/dev/s96-checkpoint-allowlist.txt` (**23 exact paths**). The sole allowed absent path is the tracked deletion `claude.md.txt`.
- Archive candidate list: `tools/dev/s96-post-commit-archive-allowlist.txt` (**71 exact file paths**). These are temporary artifacts, not Git additions: eight historical S96 package readmes, eighteen untracked migration installer/cleanup/payload files, plus forty-five ignored root ZIP/log/Repomix files and S96 one-shot verifiers.
- Existing S96 testlogs and backups already under ignored `tools/reports/` remain archived there. Do not move that tree into its own subdirectory. Earlier tracked architecture/slice/handover documents remain tracked and are not archival targets.
- Do not add blanket ignore rules merely to hide dirty work. Existing `/tools/reports/`, root ZIP/log and Repomix ignores are sufficient.

## Gate 1 - approve scope, then stage exactly the checkpoint allowlist

**Pending explicit user approval. Do not execute now.**

Recheck branch, HEAD and Git status. Index must be empty. Every proposed present path must exist; `claude.md.txt` must be absent locally but tracked at HEAD. Read the allowlist as literal repo-relative paths, reject duplicates and additions outside it.

After approval, the proposed staging command is:

```powershell
git --literal-pathspecs add --pathspec-from-file=tools/dev/s96-checkpoint-allowlist.txt
```

Then compare **sets**, not counts, between the sorted unique allowlist lines and `git diff --cached --name-only`. Require no difference, exactly 23 paths. Verify `git diff --cached --name-status` shows only the intended 45-line deletion of `claude.md.txt`, expected modifications and permanent additions. Review the full staged diff, run `git diff --cached --check`, confirm no FROZEN/ADR/parser/regression edits beyond reviewed S96 scope, and **stop for commit authorization**. No `git add .`, `git add -A`, reset or cleanup.

## Gate 2 - separately approve commit

Only after a separate explicit approval may the reviewed staged checkpoint be committed. Record the resulting real hash in the conversation; do not invent one beforehand or edit tracked files after commit merely to insert its own hash.

Immediately afterward, expect the 26 excluded visible artifacts still to be untracked. This is deliberate until Gate 3; do not claim a clean repository at this point. Ignored artifacts do not appear in ordinary status.

## Gate 3 - separately approve reversible archival after the actual commit

**Not authorized now. This is a move-and-verify plan, not a deletion plan.**

1. Re-read current Git status and actual commit hash. Require no staged changes and no modified tracked files. Require the remaining visible untracked path set to match the 26 reviewed excluded artifacts. If new user work appears, stop and revise the inventory.
2. Resolve repository root and every source/destination to absolute paths. Verify they remain under the intended root. Revalidate that each of the 71 manifest entries is an existing regular file, is not tracked at the new commit, and is outside all permanent source/test/doc/tool and normative paths. Inspect reparse/symlink properties; never recursively follow an unknown OneDrive/junction target.
3. Choose a fresh destination `tools/reports/S96-post-checkpoint-<actual-short-commit>-<timestamp>/`. Verify `git check-ignore` matches this destination. Refuse an existing destination, overwrite or any destination beneath a source tree. Do not use force.
4. Write an inventory in that ignored archive with actual commit, timestamp, each original relative path, byte size and SHA-256. Compute hashes before moving. If a cloud placeholder cannot be read/hydrated safely, stop; do not mark it archived.
5. Move each individually approved file to `<archive>/files/<original-relative-path>`, preserving its relative path, using native PowerShell `Move-Item -LiteralPath` with verified absolute paths. No recursive broad directory move, no shell switching, no wildcard enumeration into deletion commands, no old cleanup scripts. Empty source directories may remain.
6. Recompute every archived hash and size; compare with the recorded original. Confirm all original manifest file paths are absent and all destinations exist. Stop on any mismatch. Keep the inventory and all contents; delete nothing.
7. Rollback, if needed, is an individually checked move from the archive to the recorded original path only when that path remains absent; stop on collisions rather than overwriting new user work. No automatic rollback or `git reset`.

## Gate 4 - S97 readiness verification after archival

- Run `node --test` on Node 24 and full Python discovery. Expected prior baseline: 1345 PASS / 0 FAIL / 7 TODO / 1 SKIP; Python 264 PASS. Investigate any changed counts instead of suppressing failures.
- Run `python tools/dev/run-s96b2-browser.py` using installed Selenium/Chrome and the actual supervised Pyodide/SymPy Worker (network required). Expected three acceptance scenarios. Dependencies are existing project/Python/browser requirements, not old ZIP/payload installers.
- Confirm source/test/tool imports and package scripts do not read old S96 readmes, migration payloads, verifiers or `claude.md.txt`. The permanent collector defaults to a retained S96 regression test, not a payload.
- Require `git diff --quiet`, empty staged diff, and **empty `git status --porcelain=v1 --untracked-files=all`**. `git status --ignored` will still list the intentional ignored archive; this does not mean content was lost or a tracked change was hidden.
- Verify the commit contains all 23 approved paths, including deletion, and all tests/fixtures/tools execute with old artifact locations absent. This is the evidence that S97 is independent of migration packages.
- If any tracked/untracked discrepancy or payload dependency remains, report it and stop before S97. Do not clean or reset to force a clean status.

The final clean status is a future acceptance condition, not a present claim. Offline release, known TODO/security/capability gaps and HistorySession mixed-route divergence remain open as recorded in S96_CLOSURE.md.
