# P0009 — Diagnostic contract v1

**Status:** COMPLETE / GREEN  
**Contract version:** 1

## Purpose

P0009 defines a backend-independent, locale-independent diagnostic transport
contract and a strict producer-side schema contract.

Diagnostics communicate stable machine-readable meaning. Human-readable
messages are presentation data and are not authoritative mathematical state.

## Diagnostic

Canonical envelope:

```text
Diagnostic {
    diagnosticVersion: 1,
    code: string,
    parameters: object
}
```

`diagnostic(code, parameters)` creates an immutable, detached transport value.

Allowed parameter data is transport-safe:

- strings;
- finite numbers;
- booleans;
- null;
- arrays of transport-safe values;
- plain objects containing transport-safe values.

Functions, class/backend instances, raw `Error` objects, `NaN`, and infinities
are rejected.

The transport envelope is deliberately **open**. Unknown future codes are
valid transport. This supports persistence and forward-compatible transport
without requiring every reader to know every producer contract.

## DiagnosticSpec

A DiagnosticSpec describes the parameter contract for a known producer:

```text
DiagnosticSpec {
    diagnosticSpecVersion: 1,
    code: string,
    parameters: {
        name: {
            type,
            required
        }
    }
}
```

Input shorthand:

```js
operationId: 'string'
```

canonicalizes to:

```js
operationId: { type: 'string', required: true }
```

Optionality is orthogonal to type:

```js
backendCode: { type: 'string', required: false }
```

`required: false` means omitted is allowed. It does not imply nullable.

### Schema vocabulary

P0009 freezes only the generic descriptor vocabulary evidenced by pressure:

- `string`
- `string-list`
- `non-negative-integer`
- `non-negative-integer-list`
- `transport`

Descriptor names describe data shape, not diagnostic-domain semantics.

`diagnosticFromSpec(spec, parameters)`:

- requires declared required parameters;
- rejects undeclared parameters;
- validates declared data shape;
- produces an ordinary Diagnostic.

## Architectural split

```text
Diagnostic
    open immutable transport envelope

DiagnosticSpec
    strict producer-side semantic parameter contract
```

Transport capability is not semantic contract.

A transport-safe nested object does not gain implicit `cause`, dependency, or
other diagnostic semantics merely because of its shape.

## Representative families pressure-tested

The contract can represent structured facts for:

- parse;
- resolution;
- unsupported operation;
- wrong arity;
- type mismatch;
- dimension mismatch;
- backend failure;
- blocked-by-provider.

These examples do **not** freeze a complete global diagnostic code registry.

For blocked calculations, the blocked diagnostic identifies the immediate
provider. The provider retains its own root diagnostic. Dependency paths and
duplicated root causes are not part of Diagnostic v1.

## Localization

Diagnostic codes and parameters are locale-independent.

Human-readable wording, localized operation help, number formatting, and
locale files belong outside this contract. A future presentation layer may map
stable codes and parameters to localized text.

## Relationship to OperationSpec

`OperationSpec.diagnosticAdapterId` remains an opaque adapter identity.
OperationSpec does not own diagnostic codes or diagnostic construction.

## Explicit non-goals

P0009 does not introduce:

- a global diagnostic registry;
- a frozen complete code vocabulary;
- category;
- severity;
- authoritative user-facing messages;
- locale files;
- nested cause semantics;
- dependency paths/history;
- a complete source-location object contract;
- raw backend exception strings;
- backend objects in public diagnostics.

## Forward rule

Producers define stable DiagnosticSpecs where a known diagnostic contract is
required. Consumers rely on `code` plus structured parameters, never backend
exception wording.

Presentation consumes Diagnostics; it does not become an authority on
mathematical meaning.
