# P0019 Slice 3 — source symbolic target / materialized Value guard

**Status:** GREEN in isolated local verification of Slices 1–3: 20/20 tests; full user's checkout pending.

## Scope

Extend `resolveSelectedOperationCall` by an optional fifth `LexicalIdentityScope` argument. No changes to four-argument callers. Allocate operation-local symbolic identities before resolving value operands, so an earlier source argument can resolve under the local symbolic target. Ordinary operands after the symbolic target (e.g. integration bounds) stay under the caller scope. Resolver receives immutable metadata with the relevant `lexicalScope`; it remains responsible for traversing source and for distinguishing source AST from previously materialized Values.

Preserve P0006 SemanticIdentity and P0007 Semantic IR shapes. No changes to Python, P0008 OperationSpec, document authority, parser or DocumentRuntime.

### Tests

- symbolic target applies to preceding *source* operand, notwithstanding an earlier document definition;
- materialized source Value is not re-resolved;
- integration upper bound `x` stays ordinary Value while integrand's `x` uses symbolic operation target;
- existing Slice 2 four-parameter API remains valid;
- callback receives a frozen role/context descriptor.

**Limitations (deliberate):** no real nearest-predecessor document resolution, no generic scoped `scopeOver` binder implementation, no nested operation-boundary algorithm. The callback's miniature resolver in the tests is intentionally only a fixture, not production document analysis. For operations whose symbolic argument does *not* come after the governed source operand, this temporary positional policy must be replaced by explicit generic scope metadata, not additional operation-name special cases. No end-to-end parser→Python claim.

## Verification

```powershell
node --test tests/js/p0019-operation-argument-plan.test.mjs tests/js/p0019-selected-symbolic-resolution.test.mjs tests/js/p0019-symbolic-source-scope.test.mjs
node --test
python -m unittest discover -s tests/python -p "test_p0012_*.py" -q
python -m unittest discover -s tests/python -p "test_p0011_*.py" -q
```

Expected full JavaScript total: **368** (previous 362 + six new), assuming no other changes. Python counts unchanged (191 and 16). The separate P0019 tests are already included in `node --test`.
