import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DIAGNOSTIC_VERSION,
  DIAGNOSTIC_SPEC_VERSION,
  diagnostic,
  isDiagnostic,
  diagnosticSpec,
  isDiagnosticSpec,
  diagnosticFromSpec,
} from '../../src/js/diagnostics/diagnostic.js';

// P0009 permanent contract suite.
// Consolidates the contract pressure retained from Slices 1–6.

// --- Diagnostic transport envelope ------------------------------------------------

test('Diagnostic v1 exposes the frozen version', () => {
  assert.equal(DIAGNOSTIC_VERSION, 1);
});

test('diagnostic constructs the minimal canonical envelope', () => {
  const d = diagnostic('wrong-arity', { actual: 3 });
  assert.deepEqual(d, {
    diagnosticVersion: 1,
    code: 'wrong-arity',
    parameters: { actual: 3 },
  });
});

test('Diagnostic envelope and parameters are immutable', () => {
  const d = diagnostic('x', { nested: { values: [1, 2] } });
  assert.equal(Object.isFrozen(d), true);
  assert.equal(Object.isFrozen(d.parameters), true);
  assert.equal(Object.isFrozen(d.parameters.nested), true);
  assert.equal(Object.isFrozen(d.parameters.nested.values), true);
});

test('Diagnostic transport detaches caller-owned data', () => {
  const source = { nested: { value: 1 }, values: [1, 2] };
  const d = diagnostic('x', source);
  source.nested.value = 99;
  source.values.push(3);
  assert.deepEqual(d.parameters, { nested: { value: 1 }, values: [1, 2] });
});

test('Diagnostic rejects an empty code', () => {
  assert.throws(() => diagnostic('', {}), /code/i);
});

test('Diagnostic requires a plain parameter object', () => {
  assert.throws(() => diagnostic('x', []), /plain object/i);
});

test('Diagnostic accepts transport-safe primitives and structures', () => {
  const d = diagnostic('x', {
    s: 'text', n: 3.5, b: true, z: null,
    a: [1, 'x', false],
    o: { x: 1 },
  });
  assert.equal(isDiagnostic(d), true);
});

test('Diagnostic rejects non-finite numbers', () => {
  assert.throws(() => diagnostic('x', { value: NaN }), /finite/i);
  assert.throws(() => diagnostic('x', { value: Infinity }), /finite/i);
});

test('Diagnostic rejects functions and backend/class instances', () => {
  class BackendThing {}
  assert.throws(() => diagnostic('x', { value: () => 1 }), /transport-safe/i);
  assert.throws(() => diagnostic('x', { value: new BackendThing() }), /transport-safe/i);
});

test('Diagnostic rejects raw Error objects', () => {
  assert.throws(() => diagnostic('backend-failure', { error: new Error('boom') }), /transport-safe/i);
});

test('isDiagnostic recognizes valid constructed Diagnostics', () => {
  assert.equal(isDiagnostic(diagnostic('x', {})), true);
});

test('isDiagnostic rejects mutable lookalikes', () => {
  assert.equal(isDiagnostic({ diagnosticVersion: 1, code: 'x', parameters: {} }), false);
});

test('Diagnostic transport remains open to unknown future codes', () => {
  const d = diagnostic('future-resolution-detail', { futureFact: 17 });
  assert.equal(d.code, 'future-resolution-detail');
  assert.deepEqual(d.parameters, { futureFact: 17 });
});

// --- DiagnosticSpec ---------------------------------------------------------------

test('DiagnosticSpec v1 exposes the frozen version', () => {
  assert.equal(DIAGNOSTIC_SPEC_VERSION, 1);
});

test('DiagnosticSpec canonicalizes shorthand descriptors', () => {
  const spec = diagnosticSpec({ code: 'x', parameters: { name: 'string' } });
  assert.deepEqual(spec.parameters.name, { type: 'string', required: true });
});

test('DiagnosticSpec canonicalizes optional object descriptors', () => {
  const spec = diagnosticSpec({
    code: 'x',
    parameters: { backendCode: { type: 'string', required: false } },
  });
  assert.deepEqual(spec.parameters.backendCode, { type: 'string', required: false });
});

test('DiagnosticSpec is recursively immutable through descriptor boundary', () => {
  const spec = diagnosticSpec({
    code: 'x',
    parameters: { name: 'string', optional: { type: 'string', required: false } },
  });
  assert.equal(Object.isFrozen(spec), true);
  assert.equal(Object.isFrozen(spec.parameters), true);
  for (const descriptor of Object.values(spec.parameters)) {
    assert.equal(Object.isFrozen(descriptor), true);
  }
});

test('DiagnosticSpec detaches object descriptors from caller mutation', () => {
  const descriptor = { type: 'string', required: false };
  const parameters = { backendCode: descriptor };
  const spec = diagnosticSpec({ code: 'backend-failure', parameters });
  descriptor.type = 'transport';
  descriptor.required = true;
  parameters.backendCode = 'transport';
  assert.deepEqual(spec.parameters.backendCode, { type: 'string', required: false });
});

test('isDiagnosticSpec recognizes constructed specs', () => {
  assert.equal(isDiagnosticSpec(diagnosticSpec({ code: 'x', parameters: {} })), true);
});

test('DiagnosticSpec rejects unsupported descriptor types', () => {
  assert.throws(
    () => diagnosticSpec({ code: 'x', parameters: { value: 'dimension' } }),
    /unsupported parameter type/i
  );
});

test('DiagnosticSpec rejects accidental descriptor extensions', () => {
  assert.throws(
    () => diagnosticSpec({
      code: 'x',
      parameters: { p: { type: 'string', required: false, localized: true } },
    }),
    /localized|unexpected/i
  );
});

test('DiagnosticSpec requires boolean required flag', () => {
  assert.throws(
    () => diagnosticSpec({
      code: 'x',
      parameters: { p: { type: 'string', required: 'no' } },
    }),
    /required|boolean/i
  );
});

// --- Generic schema vocabulary ----------------------------------------------------

test('string requires a non-empty string', () => {
  const spec = diagnosticSpec({ code: 'x', parameters: { p: 'string' } });
  assert.doesNotThrow(() => diagnosticFromSpec(spec, { p: 'ok' }));
  assert.throws(() => diagnosticFromSpec(spec, { p: '' }), /p|string/i);
});

test('string-list requires a non-empty list of non-empty strings', () => {
  const spec = diagnosticSpec({ code: 'x', parameters: { p: 'string-list' } });
  assert.doesNotThrow(() => diagnosticFromSpec(spec, { p: ['a', 'b'] }));
  assert.throws(() => diagnosticFromSpec(spec, { p: [] }), /p|list/i);
  assert.throws(() => diagnosticFromSpec(spec, { p: ['a', ''] }), /p|list/i);
});

test('non-negative-integer validates integer domain', () => {
  const spec = diagnosticSpec({ code: 'x', parameters: { p: 'non-negative-integer' } });
  assert.doesNotThrow(() => diagnosticFromSpec(spec, { p: 0 }));
  assert.throws(() => diagnosticFromSpec(spec, { p: -1 }), /non-negative integer/i);
  assert.throws(() => diagnosticFromSpec(spec, { p: 1.5 }), /non-negative integer/i);
});

test('non-negative-integer-list validates list domain', () => {
  const spec = diagnosticSpec({ code: 'x', parameters: { p: 'non-negative-integer-list' } });
  assert.doesNotThrow(() => diagnosticFromSpec(spec, { p: [0, 2, 4] }));
  assert.throws(() => diagnosticFromSpec(spec, { p: [] }), /list/i);
  assert.throws(() => diagnosticFromSpec(spec, { p: [1, -1] }), /list/i);
});

test('transport accepts structured transport-safe values', () => {
  const spec = diagnosticSpec({ code: 'x', parameters: { p: 'transport' } });
  const d = diagnosticFromSpec(spec, { p: { powers: { length: 1, time: -1 } } });
  assert.deepEqual(d.parameters.p, { powers: { length: 1, time: -1 } });
});

test('transport rejects backend objects', () => {
  class BackendThing {}
  const spec = diagnosticSpec({ code: 'x', parameters: { p: 'transport' } });
  assert.throws(() => diagnosticFromSpec(spec, { p: new BackendThing() }), /transport-safe|p/i);
});

test('optional means omitted, not implicitly nullable', () => {
  const spec = diagnosticSpec({
    code: 'x',
    parameters: { p: { type: 'string', required: false } },
  });
  assert.doesNotThrow(() => diagnosticFromSpec(spec, {}));
  assert.throws(() => diagnosticFromSpec(spec, { p: null }), /p|string/i);
});

test('DiagnosticSpec rejects undeclared producer parameters', () => {
  const spec = diagnosticSpec({ code: 'x', parameters: { p: 'string' } });
  assert.throws(() => diagnosticFromSpec(spec, { p: 'ok', extra: 1 }), /extra|unexpected/i);
});

// --- Representative diagnostic families -----------------------------------------

test('wrong-arity has stable structured facts', () => {
  const spec = diagnosticSpec({
    code: 'wrong-arity',
    parameters: {
      operationId: 'string',
      expected: 'non-negative-integer-list',
      actual: 'non-negative-integer',
    },
  });
  const d = diagnosticFromSpec(spec, {
    operationId: 'integrate', expected: [2, 4], actual: 3,
  });
  assert.deepEqual(d.parameters, {
    operationId: 'integrate', expected: [2, 4], actual: 3,
  });
});

test('type-mismatch supports expected kind lists without domain-specific descriptors', () => {
  const spec = diagnosticSpec({
    code: 'type-mismatch',
    parameters: {
      operationId: 'string',
      argument: 'string',
      expectedKinds: 'string-list',
      actualKind: 'string',
    },
  });
  const d = diagnosticFromSpec(spec, {
    operationId: 'sin',
    argument: 'value',
    expectedKinds: ['expression', 'quantity'],
    actualKind: 'matrix',
  });
  assert.deepEqual(d.parameters.expectedKinds, ['expression', 'quantity']);
});

test('dimension-mismatch carries structured facts through generic transport', () => {
  const spec = diagnosticSpec({
    code: 'dimension-mismatch',
    parameters: {
      operationId: 'string',
      expectedDimension: 'transport',
      actualDimension: 'transport',
    },
  });
  const d = diagnosticFromSpec(spec, {
    operationId: 'convert',
    expectedDimension: { length: 1, time: -1 },
    actualDimension: { length: 1 },
  });
  assert.deepEqual(d.parameters.expectedDimension, { length: 1, time: -1 });
});

test('backend-failure can omit an optional stable backend code', () => {
  const spec = diagnosticSpec({
    code: 'backend-failure',
    parameters: {
      evaluatorId: 'string',
      operationId: 'string',
      backendCode: { type: 'string', required: false },
    },
  });
  assert.doesNotThrow(() =>
    diagnosticFromSpec(spec, { evaluatorId: 'sympy', operationId: 'limit' })
  );
});

test('backend-failure validates optional backend code when present', () => {
  const spec = diagnosticSpec({
    code: 'backend-failure',
    parameters: {
      evaluatorId: 'string',
      operationId: 'string',
      backendCode: { type: 'string', required: false },
    },
  });
  assert.throws(
    () => diagnosticFromSpec(spec, {
      evaluatorId: 'sympy', operationId: 'limit', backendCode: 500,
    }),
    /backendCode|string/i
  );
});

test('blocked-by-provider records only immediate provider identity', () => {
  const spec = diagnosticSpec({
    code: 'blocked-by-provider',
    parameters: { providerId: 'string' },
  });
  assert.deepEqual(
    diagnosticFromSpec(spec, { providerId: 'writer-B' }).parameters,
    { providerId: 'writer-B' }
  );
});

test('blocked-by-provider rejects dependency path/history as undeclared producer data', () => {
  const spec = diagnosticSpec({
    code: 'blocked-by-provider',
    parameters: { providerId: 'string' },
  });
  assert.throws(
    () => diagnosticFromSpec(spec, {
      providerId: 'writer-B',
      dependencyPath: ['writer-A', 'writer-B'],
    }),
    /dependencyPath|unexpected/i
  );
});

test('resolution-unknown-callable carries stable resolution facts', () => {
  const spec = diagnosticSpec({
    code: 'resolution-unknown-callable',
    parameters: { name: 'string', taskScopeId: 'string' },
  });
  assert.deepEqual(
    diagnosticFromSpec(spec, { name: 'foo', taskScopeId: 'task-7' }).parameters,
    { name: 'foo', taskScopeId: 'task-7' }
  );
});

test('parse-invalid-syntax can carry source facts without freezing a source-location object', () => {
  const spec = diagnosticSpec({
    code: 'parse-invalid-syntax',
    parameters: {
      offset: 'non-negative-integer',
      length: 'non-negative-integer',
    },
  });
  assert.deepEqual(
    diagnosticFromSpec(spec, { offset: 12, length: 1 }).parameters,
    { offset: 12, length: 1 }
  );
});

// --- Boundary rules retained from pressure ---------------------------------------

test('Diagnostic-shaped nested transport data gains no implicit cause semantics', () => {
  const spec = diagnosticSpec({
    code: 'backend-failure',
    parameters: { detail: 'transport' },
  });
  const nested = {
    diagnosticVersion: 1,
    code: 'root-cause-looking-data',
    parameters: { x: 1 },
  };
  const d = diagnosticFromSpec(spec, { detail: nested });
  assert.deepEqual(d.parameters.detail, nested);
  assert.equal(Object.hasOwn(d, 'cause'), false);
});

test('open transport and strict producer schema remain intentionally distinct', () => {
  const spec = diagnosticSpec({
    code: 'blocked-by-provider',
    parameters: { providerId: 'string' },
  });
  assert.throws(
    () => diagnosticFromSpec(spec, { providerId: 'writer-B', futureFact: 17 }),
    /futureFact|unexpected/i
  );
  assert.doesNotThrow(() =>
    diagnostic('blocked-by-provider', { providerId: 'writer-B', futureFact: 17 })
  );
});

test('known producer contract does not admit authoritative presentation text', () => {
  const spec = diagnosticSpec({
    code: 'wrong-arity',
    parameters: {
      operationId: 'string',
      expected: 'non-negative-integer-list',
      actual: 'non-negative-integer',
    },
  });
  assert.throws(
    () => diagnosticFromSpec(spec, {
      operationId: 'integrate',
      expected: [2, 4],
      actual: 3,
      message: 'integrate takes 2 or 4 arguments',
    }),
    /message|unexpected/i
  );
});
