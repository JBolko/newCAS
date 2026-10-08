import test from 'node:test';
import assert from 'node:assert/strict';

import {
  expression,
} from '../../src/js/values/value.js';
import { diagnostic } from '../../src/js/diagnostics/diagnostic.js';
import {
  EVALUATION_REQUEST_VERSION,
  EVALUATION_OUTCOME_VERSION,
  evaluationRequest,
  isEvaluationRequest,
  evaluationSuccess,
  evaluationFailure,
  isEvaluationOutcome,
} from '../../src/js/evaluator/evaluation-contract.js';

function expr(source = '1') {
  // P0005 requires a canonical expression node, not source text.
  return expression({ op: 'integer', value: /^[0-9]+$/.test(source) ? source : '1' });
}

test('P0010 Slice 1: request version is 1', () => {
  assert.equal(EVALUATION_REQUEST_VERSION, 1);
});

test('P0010 Slice 1: outcome version is 1', () => {
  assert.equal(EVALUATION_OUTCOME_VERSION, 1);
});

test('P0010 Slice 1: request carries evaluator id, resolved instruction, Values and options', () => {
  const value = expr('x');
  const request = evaluationRequest({
    evaluatorId: 'sympy.diff',
    instruction: { operation: 'diff', argumentRoles: ['value', 'symbolic'] },
    inputs: [value],
    options: { simplify: true },
  });

  assert.equal(request.evaluatorId, 'sympy.diff');
  assert.deepEqual(request.instruction, {
    operation: 'diff',
    argumentRoles: ['value', 'symbolic'],
  });
  assert.deepEqual(request.inputs, [value]);
  assert.deepEqual(request.options, { simplify: true });
  assert.equal(isEvaluationRequest(request), true);
});

test('P0010 Slice 1: request is immutable and detaches transport data', () => {
  const instruction = { operation: 'sin', metadata: { mode: 'exact' } };
  const options = { flags: ['a'] };

  const request = evaluationRequest({
    evaluatorId: 'sympy.sin',
    instruction,
    inputs: [expr('x')],
    options,
  });

  instruction.metadata.mode = 'changed';
  options.flags.push('b');

  assert.equal(request.instruction.metadata.mode, 'exact');
  assert.deepEqual(request.options.flags, ['a']);
  assert.equal(Object.isFrozen(request), true);
  assert.equal(Object.isFrozen(request.instruction), true);
  assert.equal(Object.isFrozen(request.options), true);
});

test('P0010 Slice 1: inputs must already be public Values', () => {
  assert.throws(
    () => evaluationRequest({
      evaluatorId: 'sympy.sin',
      inputs: [{ kind: 'expression' }],
    }),
    /Value/
  );
});

test('P0010 Slice 1: backend objects cannot cross through instruction', () => {
  class SympyLike {}
  assert.throws(
    () => evaluationRequest({
      evaluatorId: 'sympy.sin',
      instruction: { backendObject: new SympyLike() },
      inputs: [expr('x')],
    }),
    /transport-safe/
  );
});

test('P0010 Slice 1: backend objects cannot cross through options', () => {
  class BackendContext {}
  assert.throws(
    () => evaluationRequest({
      evaluatorId: 'sympy.sin',
      inputs: [expr('x')],
      options: { context: new BackendContext() },
    }),
    /transport-safe/
  );
});

test('P0010 Slice 1: success outcome contains exactly one public Value', () => {
  const value = expr('x^2');
  const outcome = evaluationSuccess(value);

  assert.deepEqual(outcome, {
    evaluationOutcomeVersion: 1,
    status: 'success',
    value,
  });
  assert.equal(isEvaluationOutcome(outcome), true);
});

test('P0010 Slice 1: success rejects backend-native result objects', () => {
  class SympyResult {}
  assert.throws(() => evaluationSuccess(new SympyResult()), /Value/);
});

test('P0010 Slice 1: failure outcome contains exactly one Diagnostic', () => {
  const d = diagnostic('backend-failure', { evaluatorId: 'sympy' });
  const outcome = evaluationFailure(d);

  assert.deepEqual(outcome, {
    evaluationOutcomeVersion: 1,
    status: 'failure',
    diagnostic: d,
  });
  assert.equal(isEvaluationOutcome(outcome), true);
});

test('P0010 Slice 1: failure rejects raw backend Error objects', () => {
  assert.throws(() => evaluationFailure(new Error('boom')), /Diagnostic/);
});

test('P0010 Slice 1: outcome has no mixed success/failure state', () => {
  const value = expr('x');
  const d = diagnostic('backend-failure', { evaluatorId: 'sympy' });

  const mixed = Object.freeze({
    evaluationOutcomeVersion: 1,
    status: 'success',
    value,
    diagnostic: d,
  });

  assert.equal(isEvaluationOutcome(mixed), false);
});

test('P0010 Slice 1: document authority is absent from canonical request shape', () => {
  const request = evaluationRequest({
    evaluatorId: 'sympy.sin',
    instruction: { operation: 'sin' },
    inputs: [expr('x')],
  });

  assert.deepEqual(Object.keys(request), [
    'evaluationRequestVersion',
    'evaluatorId',
    'instruction',
    'inputs',
    'options',
  ]);

  for (const forbidden of [
    'taskId',
    'taskScopeId',
    'documentId',
    'writerId',
    'providerId',
    'documentOrder',
    'dependencyGraph',
    'history',
  ]) {
    assert.equal(Object.hasOwn(request, forbidden), false);
  }
});

test('P0010 Slice 1: request accepts already materialized Values without resolution metadata', () => {
  const value = expr('resolved-x');
  const request = evaluationRequest({
    evaluatorId: 'sympy.identity',
    instruction: { operation: 'identity' },
    inputs: [value],
  });

  assert.equal(request.inputs[0], value);
  assert.equal(Object.hasOwn(request.inputs[0], 'providerId'), false);
});

// Consolidated P0010-slice-2-GREEN.zip pressure cases
{
function expr(integer = '1') {
  return expression({
    op: 'integer',
    value: integer,
  });
}

test('P0010 Slice 2: evaluator-local nested transport data remains legal', () => {
  const request = evaluationRequest({
    evaluatorId: 'sympy.diff',
    instruction: {
      argumentRoles: ['value', 'symbolic'],
      algorithm: {
        history: ['iteration-1'],
      },
    },
    inputs: [expr()],
    options: {
      backend: {
        taskId: 'backend-local-label',
      },
      precision: 30,
    },
  });

  assert.equal(request.instruction.algorithm.history[0], 'iteration-1');
  assert.equal(request.options.backend.taskId, 'backend-local-label');
  assert.equal(isEvaluationRequest(request), true);
});

test('P0010 Slice 2: request recognizer rejects extra document-authority field', () => {
  const canonical = evaluationRequest({
    evaluatorId: 'sympy.identity',
    inputs: [expr()],
  });

  const lookalike = Object.freeze({
    ...canonical,
    taskId: 'task-A',
  });

  assert.equal(isEvaluationRequest(lookalike), false);
});

test('P0010 Slice 2: request recognizer rejects any extra top-level field', () => {
  const canonical = evaluationRequest({
    evaluatorId: 'sympy.identity',
    inputs: [expr()],
  });

  const lookalike = Object.freeze({
    ...canonical,
    convenience: true,
  });

  assert.equal(isEvaluationRequest(lookalike), false);
});

test('P0010 Slice 2: canonical request remains accepted', () => {
  const request = evaluationRequest({
    evaluatorId: 'sympy.identity',
    instruction: { mode: 'exact' },
    inputs: [expr('2')],
    options: { precision: 30 },
  });

  assert.equal(isEvaluationRequest(request), true);
});

}

// Consolidated P0010-slice-3-GREEN.zip pressure cases
{
function expr(integer = '1') {
  return expression({ op: 'integer', value: integer });
}

function requestLookalike({ instruction = {}, options = {} } = {}) {
  return Object.freeze({
    evaluationRequestVersion: EVALUATION_REQUEST_VERSION,
    evaluatorId: 'sympy.identity',
    instruction,
    inputs: Object.freeze([expr()]),
    options,
  });
}

test('P0010 Slice 3: recognizer rejects mutable nested instruction data', () => {
  const request = requestLookalike({
    instruction: Object.freeze({ algorithm: { mode: 'exact' } }),
    options: Object.freeze({}),
  });
  assert.equal(isEvaluationRequest(request), false);
});

test('P0010 Slice 3: recognizer rejects mutable nested options data', () => {
  const request = requestLookalike({
    instruction: Object.freeze({}),
    options: Object.freeze({ backend: { precision: 30 } }),
  });
  assert.equal(isEvaluationRequest(request), false);
});

test('P0010 Slice 3: recognizer rejects non-transport-safe nested objects', () => {
  class BackendObject {}
  const request = requestLookalike({
    instruction: Object.freeze({ backendObject: Object.freeze(new BackendObject()) }),
    options: Object.freeze({}),
  });
  assert.equal(isEvaluationRequest(request), false);
});

test('P0010 Slice 3: recognizer rejects non-finite nested numbers', () => {
  const request = requestLookalike({
    instruction: Object.freeze({}),
    options: Object.freeze({ precision: Number.POSITIVE_INFINITY }),
  });
  assert.equal(isEvaluationRequest(request), false);
});

test('P0010 Slice 3: recognizer accepts recursively frozen transport lookalike', () => {
  const request = requestLookalike({
    instruction: Object.freeze({
      algorithm: Object.freeze({
        stages: Object.freeze(['normalize', 'evaluate']),
      }),
    }),
    options: Object.freeze({
      backend: Object.freeze({ precision: 30 }),
    }),
  });
  assert.equal(isEvaluationRequest(request), true);
});

test('P0010 Slice 3: constructor output remains recognized', () => {
  const request = evaluationRequest({
    evaluatorId: 'sympy.identity',
    instruction: { algorithm: { mode: 'exact', stages: ['normalize', 'evaluate'] } },
    inputs: [expr('2')],
    options: { backend: { precision: 30 } },
  });
  assert.equal(isEvaluationRequest(request), true);
  assert.equal(Object.isFrozen(request.instruction.algorithm), true);
  assert.equal(Object.isFrozen(request.instruction.algorithm.stages), true);
  assert.equal(Object.isFrozen(request.options.backend), true);
});

}

// Consolidated P0010-slice-4-GREEN.zip pressure cases
{
const value = () => expression({ op: 'integer', value: '1' });
const build = (instruction = {}, options = {}) => evaluationRequest({
  evaluatorId: 'sympy.identity', instruction, options, inputs: [value()],
});
const lookalike = (instruction, options = Object.freeze({})) => Object.freeze({
  evaluationRequestVersion: EVALUATION_REQUEST_VERSION,
  evaluatorId: 'sympy.identity',
  instruction,
  inputs: Object.freeze([value()]),
  options,
});

test('P0010 Slice 4: constructor rejects sparse arrays rather than silently preserving holes', () => {
  const sparse = new Array(2);
  sparse[1] = 'last';
  assert.throws(() => build({ steps: sparse }), /transport|sparse|dense|array/i);
});

test('P0010 Slice 4: recognizer rejects frozen sparse arrays', () => {
  const sparse = new Array(2);
  sparse[1] = 'last';
  Object.freeze(sparse);
  assert.equal(isEvaluationRequest(lookalike(Object.freeze({ steps: sparse }))), false);
});

test('P0010 Slice 4: constructor does not execute transport getters', () => {
  let reads = 0;
  const instruction = {};
  Object.defineProperty(instruction, 'stage', {
    enumerable: true, configurable: true,
    get() { reads++; return 'run'; },
  });
  assert.throws(() => build(instruction), /transport|accessor|getter|property/i);
  assert.equal(reads, 0);
});

test('P0010 Slice 4: recognizer does not execute transport getters', () => {
  let reads = 0;
  const instruction = {};
  Object.defineProperty(instruction, 'stage', {
    enumerable: true, configurable: true,
    get() { reads++; return 'run'; },
  });
  Object.freeze(instruction);
  assert.equal(isEvaluationRequest(lookalike(instruction)), false);
  assert.equal(reads, 0);
});

test('P0010 Slice 4: constructor rejects symbol-keyed transport objects', () => {
  const instruction = { mode: 'exact' };
  instruction[Symbol('hidden')] = 'surprise';
  assert.throws(() => build(instruction), /transport|symbol|property/i);
});

test('P0010 Slice 4: recognizer rejects frozen symbol-keyed transport objects', () => {
  const instruction = { mode: 'exact' };
  instruction[Symbol('hidden')] = 'surprise';
  Object.freeze(instruction);
  assert.equal(isEvaluationRequest(lookalike(instruction)), false);
});

test('P0010 Slice 4: normal nested transport remains valid', () => {
  const request = build({ algorithm: { steps: ['normalize', 'compute'] } }, { precision: 30 });
  assert.equal(isEvaluationRequest(request), true);
  assert.deepEqual(request.instruction.algorithm.steps, ['normalize', 'compute']);
});

}

// Consolidated P0010-slice-5-GREEN.zip pressure cases
{
function validValue() {
  return expression({ op: 'integer', value: '1' });
}

function lookalike(inputs) {
  return Object.freeze({
    evaluationRequestVersion: EVALUATION_REQUEST_VERSION,
    evaluatorId: 'sympy.identity',
    instruction: Object.freeze({}),
    inputs,
    options: Object.freeze({}),
  });
}

test('P0010 Slice 5: constructor rejects sparse Value input arrays', () => {
  const inputs = new Array(2);
  inputs[1] = validValue();
  assert.throws(
    () => evaluationRequest({ evaluatorId: 'sympy.identity', inputs }),
    /input|array|dense|sparse|Value/i
  );
});

test('P0010 Slice 5: recognizer rejects frozen sparse Value input arrays', () => {
  const inputs = new Array(2);
  inputs[1] = validValue();
  Object.freeze(inputs);
  assert.equal(isEvaluationRequest(lookalike(inputs)), false);
});

test('P0010 Slice 5: constructor rejects additional array properties', () => {
  const inputs = [validValue()];
  inputs.extra = validValue();
  assert.throws(
    () => evaluationRequest({ evaluatorId: 'sympy.identity', inputs }),
    /input|array|property|transport/i
  );
});

test('P0010 Slice 5: recognizer rejects frozen inputs with extra own properties', () => {
  const inputs = [validValue()];
  inputs.extra = validValue();
  Object.freeze(inputs);
  assert.equal(isEvaluationRequest(lookalike(inputs)), false);
});

test('P0010 Slice 5: dense Value inputs and empty inputs remain legal', () => {
  for (const inputs of [[], [validValue()], [validValue(), validValue()]]) {
    const request = evaluationRequest({ evaluatorId: 'sympy.identity', inputs });
    assert.equal(isEvaluationRequest(request), true);
    assert.equal(request.inputs.length, inputs.length);
  }
});

}

// Consolidated P0010-slice-6-GREEN.zip pressure cases
{
const value = () => expression({ op: 'integer', value: '1' });

function successLookalike(payload) {
  return Object.freeze({
    evaluationOutcomeVersion: EVALUATION_OUTCOME_VERSION,
    status: 'success',
    ...payload,
  });
}

test('P0010 Slice 6: success recognizer rejects non-enumerable extra field', () => {
  const invalid = { ...evaluationSuccess(value()) };
  Object.defineProperty(invalid, 'taskId', { value: 'task-A' });
  Object.freeze(invalid);
  assert.equal(isEvaluationOutcome(invalid), false);
});

test('P0010 Slice 6: failure recognizer rejects non-enumerable extra field', () => {
  const invalid = { ...evaluationFailure(diagnostic('EVALUATOR_TEST_FAILURE', {})) };
  Object.defineProperty(invalid, 'backend', { value: 'sympy' });
  Object.freeze(invalid);
  assert.equal(isEvaluationOutcome(invalid), false);
});

test('P0010 Slice 6: recognizer rejects success with symbol-keyed metadata', () => {
  const invalid = { ...evaluationSuccess(value()) };
  invalid[Symbol('hidden')] = 1;
  Object.freeze(invalid);
  assert.equal(isEvaluationOutcome(invalid), false);
});

test('P0010 Slice 6: recognizer does not execute a getter in success payload', () => {
  let reads = 0;
  const invalid = {
    evaluationOutcomeVersion: EVALUATION_OUTCOME_VERSION,
    status: 'success',
  };
  Object.defineProperty(invalid, 'value', {
    enumerable: true,
    get() { reads++; return value(); },
  });
  Object.freeze(invalid);
  assert.equal(isEvaluationOutcome(invalid), false);
  assert.equal(reads, 0);
});

test('P0010 Slice 6: constructor success output remains valid', () => {
  const outcome = evaluationSuccess(value());
  assert.equal(isEvaluationOutcome(outcome), true);
});

test('P0010 Slice 6: constructor failure output remains valid', () => {
  const error = diagnostic('EVALUATOR_TEST_FAILURE', {});
  const outcome = evaluationFailure(error);
  assert.equal(isEvaluationOutcome(outcome), true);
});

}

// Consolidated P0010-exit-pressure-GREEN.zip pressure cases
{
const value = () => expression({ op: 'integer', value: '1' });
const ordinary = () => evaluationRequest({ evaluatorId: 'sympy.identity', inputs: [value()] });

test('P0010 exit: request rejects hidden top-level field', () => {
  const request = { ...ordinary() };
  Object.defineProperty(request, 'taskId', { value: 'task-A', enumerable: false });
  assert.equal(isEvaluationRequest(Object.freeze(request)), false);
});

test('P0010 exit: request rejects top-level symbol metadata', () => {
  const request = { ...ordinary(), [Symbol('extra')]: 'hidden' };
  assert.equal(isEvaluationRequest(Object.freeze(request)), false);
});

test('P0010 exit: request recognizer does not invoke getter', () => {
  let calls = 0;
  const request = { ...ordinary() };
  Object.defineProperty(request, 'evaluatorId', {
    enumerable: true,
    get() { calls += 1; return 'sympy.identity'; },
  });
  assert.equal(isEvaluationRequest(Object.freeze(request)), false);
  assert.equal(calls, 0);
});

test('P0010 exit: ordinary constructor output is still valid', () => {
  assert.equal(isEvaluationRequest(ordinary()), true);
});

}
