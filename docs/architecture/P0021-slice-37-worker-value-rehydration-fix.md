# P0021 Slice 37 — Worker Value rehydration fix (v2)

## Cause

The real Worker returns a JSON-serializable P0005 ExpressionValue. Serialization
necessarily strips JS `Object.freeze` flags, including those on nested P0006
SemanticIdentity objects. `isSemanticIdentity` requires frozen identity objects,
so passing the raw returned shape directly to Slice 36's
`materializeSelectedDerivativeFunction` is correctly rejected. Slice 35 checked
only structural fields and thus did not detect the missing frozen invariant.

## Correction

The browser integration fixture now performs `decodeValue(JSON.stringify(response.value))`
at the Worker-to-P0005 boundary. This is the **existing strict P0005 decoder**,
not a fallback or permissive identity conversion. It freezes and validates the
whole returned Value before constructing the derived FunctionValue. The Worker,
Python adapter, Value contract and production materializer remain unchanged.

## Tests / status

Two new Node regressions establish the JSON loss and strict decoding behavior,
plus assert the browser fixture uses it. They do not replace a real browser
run. The revised browser fixture adds a visible PASS for rehydration, so the
expected browser count is 6 (formerly 5). It uses bumped module and Worker URLs
so the first run cannot reuse an old cached fixture. The test remains a
selected-operation smoke test, **not** full DocumentRuntime integration.
