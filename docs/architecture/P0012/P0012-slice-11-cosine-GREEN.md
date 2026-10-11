# P0012 Slice 11 — cosine GREEN

Selected unary cosine handler in the same module as sine; explicit `angleUnit`
(`deg` or `rad`) supplied by DocumentRuntime, never guessed by evaluator.
Cosine is implemented through SymPy `cos(angle*pi/180)` for DEG and
`cos(angle)` for RAD, using P0011 for round-trip serialization.

Eleven pressure tests cover exact angles, symbolic identities, exact
radians, approximate radians, wrong arity, handler capability, signature
role, missing angle context and operationId independence. These tests
are **additive** to the prior P0012 suite.

No shared sine/cosine mathematical helper is extracted yet. The duplicate
angle handling is visible and intentional for an evidence-based review
before adding tan/exp/ln. No trigonometric changes to P0011, Value contracts
or DocumentRuntime are included.

Run from repo root:

    Expand-Archive -LiteralPath ".\P0012-slice-11-cosine-GREEN.zip" -DestinationPath "." -Force
    python -m unittest discover -s tests/python -p "test_p0012_*.py" -v

Local verification of P0012: 58 tests (47 previous + 11 new).
