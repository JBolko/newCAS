# P0021 Slice 88a — canonical parser sync (GREEN candidate)

## Scope

- Frozen architectural contracts are **unchanged**.
- Single grammar source of truth: `docs/Grammatik.pegjs` (P0018).
- Generated derivative: `src/js/parser.mjs` (Peggy 5.1.0, ES module).
- Add a deterministic `--check` / explicit `--write` generator.
- Parser drift fails an ordinary `node --test` run, so a CI run of the normal suite will catch it.
- Two existing F3 pilot TODOs are promoted to ordinary, enforced tests.
- Grammar source, DocumentRuntime, Semantic IR, Worker and Python are not edited.

## Acceptance

1. Run `node tools/build/generate_canonical_parser.mjs --write` explicitly, after backing up the generated parser.
2. Run the same tool with `--check` (must pass).
3. Run focused tests (including promoted F3), the full JS suite and full Python suite.
4. The user's Node 24 environment supplies the final acceptance (local Node 22 snapshot lacks Peggy).
5. The generated change to `src/js/parser.mjs` must be reviewed and committed *with* the authoritative grammar snapshot; do not hand-edit it.

## Out of scope / known gaps

- **P0018 i18n:** Danish decimal comma needs an explicit lexical/locale boundary. No silent global substitutions.
- **Precision:** number literals still use JavaScript `Number` and can lose significant digits. F8 remains open.
- **Multiple statements in one block:** grammar parses `a:=1; b:=3; resultat:=a b`, but runtime remains intentionally single-writer-per-block. Before execution semantics are added, decide source spans, writer identity, order, same-block dependencies, changes, deletion, invalidation and diagnostics. Separator remains under discussion; no new runtime added.
- **Security:** the legacy F4 unit compiler containment is separate from the new IR path. This slice does not change either.
- **Distribution:** `tools/reports`, test logs, migration scripts, ZIP slices and Repomix files are development artefacts. Future student release must package from a strict allowlist and fail on forbidden files, independent of Git ignore rules. The release pipeline itself is not implemented in this slice.
