# P0010 — exit audit

**Status: awaiting full repository GREEN and final cleanup.**

## Evidence

- Previous in-repo checkpoint: 303/303 GREEN after Slice 6 (reported by user).
- Exit pressure produced 304/307 (three genuine request envelope failures).
- Exit GREEN bundle fixes them using the established descriptor mechanism.
- Consolidated regression suite replaces slice-specific JS fixtures with a single permanent `tests/js/evaluation-contract.test.mjs`.
- Contract recorded in `P0010-evaluation-transport-contract-v1.md`.

## Final acceptance

1. Apply this package and remove only the explicitly listed temporary Slice and exit-pressure test/document files.
2. `node --test`: all tests GREEN, with same total as the previous non-consolidated suite (307), assuming no independent changes.
3. Check `git status --short`; verify no unrelated file has been overwritten.
4. Set roadmap P0010 to COMPLETE / GREEN, then commit.

Do **not** amend P0005–P0009 contracts or legacy CAS scope; this is a standalone transport boundary.
