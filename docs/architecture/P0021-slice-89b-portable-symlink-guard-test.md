# P0021 Slice 89b — portable symlink-guard verification

**Status:** local targeted GREEN (Node 22); Node 24 full acceptance pending.

## Issue and evidence

S89a Node 24 run on Windows: five targeted tests passed, one failed, full JS had 984 passes and one unexpected fail. The failing test tried to create a real symlink and received Windows `EPERM`. S89a manifest verification and the 258 Python tests succeeded. Therefore S89a was NOT globally GREEN.

## Change

Only the S89a test file is revised, not the release implementation or runtime:
- Cross-platform mock of `fs.lstatSync` flags a leaf file and an intermediate directory as symlinks. The actual `verifyStudentPreviewInputs` code must reject both (never test a substitute guard).
- A separate real symlink integration check still runs on capable systems. It marks itself SKIP only when symlink creation is forbidden by OS permission/capability (`EPERM`, `EACCES`, `ENOTSUP`, `EOPNOTSUPP`). Other errors fail; a successful symlink must be rejected by the production validator.
- No security bypass, no change to the allowlist, release remains BLOCKED for students.

## Architectural follow-up — separate S90 design

The user wishes to enter `a:=1; b:=3; resultat:=a b` in a single formula block. Left-to-right ordered semantics is the starting requirement. ADR-0006 already defines positional reads for blocks and explicitly postpones multi-statement blocks. S90 must decide stable intra-block statement identities, per-statement writer/read binding, local output/diagnostics and invalidation after insert/reorder/edits. Potential contract example: `a:=1; b:=a+2; a:=5; resultat:=a*b` gives `b=3`, `resultat=15` if each read binds to nearest earlier statement. This is a design proposal pending its own RED and review; not a retroactive change to the frozen architecture.

## Acceptance

1. Targeted `node --test tests/js/p0021-slice-89a-student-preview-allowlist.test.mjs` passes on Node 24, including synthetic symlink checks.
2. `node tools/release/student-preview.mjs --verify` passes.
3. Full `node --test` and Python unit tests pass. Existing TODO is not PASS.
4. The actual release remains deliberately blocked.
5. Cleanup of previous one-shot verifiers only on full acceptance and matching SHA-256; keep ZIP reports locally, but exclude them from the student allowlist.
