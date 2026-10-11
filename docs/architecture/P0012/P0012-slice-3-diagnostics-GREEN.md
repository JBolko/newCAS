# P0012 Slice 3 — selected scalar addition diagnostics — GREEN

- Five prior successful addition tests remain unchanged.
- Five RED pressure cases now return P0010 failure outcomes carrying P0009-style diagnostic payloads.
- `wrong-arity`: `operationId`, `expected`, `actual`.
- `type-mismatch`: `operationId`, `argument`, `expectedKinds`, `actualKind`.
- An unselected operation is rejected as `unsupported-operation`.
- A mismatched request/spec evaluatorId is refused as `unsupported-operation` **provisionally**. The RED test only requires a structured failure, and the eventual dispatcher must specify its definitive failure classification. This is not an assertion that a mismatch is a user-level mathematical error.

The module remains **one selected-operation fixture**, not a registry. It deliberately does not catch arbitrary adapter/backend exceptions as Diagnostics: malformed inputs and programming errors need a later, explicit boundary policy. In particular, this slice does not introduce general Python-to-P0009 diagnostic adaptation.

No P0005–P0011 contract changes. No legacy Task Scope.
