# P0021 Slice 38 — Shared Worker Value rehydration

- Successful Worker outcomes must carry a valid P0005 Value. The main-thread Worker client decodes each successful result using `decodeValue(JSON.stringify(...))`, restoring deep immutability and validating SemanticIdentity and Value structure.
- Malformed/missing successful Values fail closed with `INVALID_WORKER_VALUE`; no fallback, registry, document scope, or semantic rewriting.
- Failure outcomes remain failures; revision and correlation rejection precede Value decoding.
- Transport-side snapshot remains JSON-portable; the rehydrated Value is available to all consumers, including nested and derived function evaluation.
- The Slice 37 browser smoke now trusts the public Worker boundary and no longer carries a one-off decode; run it again against real Pyodide.
- S38 adds six Node tests. Browser verification and full Node24 regression remain user-side checks.
