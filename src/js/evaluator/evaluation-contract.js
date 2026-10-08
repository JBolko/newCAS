import { isValue } from '../values/value.js';
import { isDiagnostic } from '../diagnostics/diagnostic.js';

export const EVALUATION_REQUEST_VERSION = 1;
export const EVALUATION_OUTCOME_VERSION = 1;

const EVALUATION_REQUEST_KEYS = Object.freeze([
  'evaluationRequestVersion',
  'evaluatorId',
  'instruction',
  'inputs',
  'options',
]);

function isPlainObject(value) {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/*
 * Only plain, dense, own-data-property trees are transportable.
 * Validate descriptors rather than reading properties: inspecting a payload
 * must never execute user-defined getters or silently omit symbol keys/holes.
 */
function transportEntries(value) {
  const keys = Reflect.ownKeys(value);
  if (Array.isArray(value)) {
    if (keys.length !== value.length + 1) return null;
    for (let i = 0; i < value.length; i++) {
      if (!Object.hasOwn(value, i)) return null;
    }
    if (keys.some(key => key !== 'length' &&
      (typeof key !== 'string' || !/^(0|[1-9]\d*)$/.test(key)))) return null;
    return Array.from({ length: value.length }, (_, i) => [String(i), Object.getOwnPropertyDescriptor(value, String(i))]);
  }
  if (keys.some(key => typeof key !== 'string')) return null;
  return keys.map(key => [key, Object.getOwnPropertyDescriptor(value, key)]);
}

function isFrozenTransport(value, active = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (!Array.isArray(value) && !isPlainObject(value)) return false;
  if (!Object.isFrozen(value) || active.has(value)) return false;
  const entries = transportEntries(value);
  if (!entries) return false;
  active.add(value);
  try {
    return entries.every(([, descriptor]) => descriptor &&
      Object.hasOwn(descriptor, 'value') && isFrozenTransport(descriptor.value, active));
  } finally {
    active.delete(value);
  }
}

function cloneFreezeTransport(value, path = 'value', active = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${path} must contain only finite numbers`);
    return value;
  }
  if (!Array.isArray(value) && !isPlainObject(value)) {
    throw new TypeError(`${path} must contain only transport-safe data`);
  }
  if (active.has(value)) throw new TypeError(`${path} must not contain cycles`);
  const entries = transportEntries(value);
  if (!entries || entries.some(([, d]) => !d || !Object.hasOwn(d, 'value'))) {
    throw new TypeError(`${path} must contain only transport-safe own data properties`);
  }
  active.add(value);
  try {
    const result = Array.isArray(value) ? [] : {};
    for (const [key, descriptor] of entries) {
      const cloned = cloneFreezeTransport(descriptor.value, `${path}.${key}`, active);
      Object.defineProperty(result, key, {
        value: cloned, writable: true, enumerable: true, configurable: true,
      });
    }
    return Object.freeze(result);
  } finally {
    active.delete(value);
  }
}

function requireNonEmptyString(value, name) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value;
}

function requireFrozenValue(value, name) {
  if (!isValue(value)) {
    throw new TypeError(`${name} must be a valid Value`);
  }
  return value;
}

/*
 * P0010 transport boundary:
 *
 * The evaluator receives an already resolved instruction. The instruction
 * identifies evaluator-local behavior and contains only transport-safe
 * structured data. Mathematical inputs cross separately as materialized Values.
 *
 * Document/task/dependency authority is not part of the request envelope.
 * P0010 does not interpret arbitrary nested evaluator-local field names; the
 * producing semantic/runtime layers own the rule that document authority is
 * never encoded into instruction/options.
 */
export function evaluationRequest({
  evaluatorId,
  instruction = {},
  inputs = [],
  options = {},
}) {
  requireNonEmptyString(evaluatorId, 'evaluatorId');

  if (!isPlainObject(instruction)) {
    throw new TypeError('instruction must be a plain object');
  }
  if (!Array.isArray(inputs)) {
    throw new TypeError('inputs must be an array');
  }
  if (!isPlainObject(options)) {
    throw new TypeError('options must be a plain object');
  }

  // Reuse the same dense, own-data-property array rule as instruction/options.
  // Do not let Array.map() skip holes or read accessor-backed indices.
  const inputEntries = transportEntries(inputs);
  if (!inputEntries || inputEntries.some(([, descriptor]) =>
    !descriptor || !Object.hasOwn(descriptor, 'value'))) {
    throw new TypeError('inputs must be a dense array of own data properties');
  }
  const frozenInputs = Object.freeze(
    inputEntries.map(([index, descriptor]) =>
      requireFrozenValue(descriptor.value, `inputs[${index}]`))
  );

  return Object.freeze({
    evaluationRequestVersion: EVALUATION_REQUEST_VERSION,
    evaluatorId,
    instruction: cloneFreezeTransport(instruction, 'instruction'),
    inputs: frozenInputs,
    options: cloneFreezeTransport(options, 'options'),
  });
}

export function isEvaluationRequest(value) {
  // The request has the same strict, accessor-free envelope semantics as
  // EvaluationOutcome. The field helper is declared below (function hoisting).
  const fields = outcomeFields(value, EVALUATION_REQUEST_KEYS);
  if (fields === null) return false;
  if (fields.evaluationRequestVersion !== EVALUATION_REQUEST_VERSION) return false;
  if (typeof fields.evaluatorId !== 'string' || fields.evaluatorId.length === 0) return false;
  if (!isPlainObject(fields.instruction) || !isFrozenTransport(fields.instruction)) return false;
  if (!Array.isArray(fields.inputs) || !Object.isFrozen(fields.inputs)) return false;
  const inputEntries = transportEntries(fields.inputs);
  if (!inputEntries || !inputEntries.every(([, descriptor]) =>
    descriptor && Object.hasOwn(descriptor, 'value') && isValue(descriptor.value))) return false;
  if (!isPlainObject(fields.options) || !isFrozenTransport(fields.options)) return false;
  return true;
}

export function evaluationSuccess(value) {
  requireFrozenValue(value, 'value');
  return Object.freeze({
    evaluationOutcomeVersion: EVALUATION_OUTCOME_VERSION,
    status: 'success',
    value,
  });
}

export function evaluationFailure(diagnostic) {
  if (!isDiagnostic(diagnostic)) {
    throw new TypeError('diagnostic must be a valid Diagnostic');
  }
  return Object.freeze({
    evaluationOutcomeVersion: EVALUATION_OUTCOME_VERSION,
    status: 'failure',
    diagnostic,
  });
}

/*
 * Check the entire canonical envelope using own-property descriptors.
 * Neither hidden keys nor accessor fields may participate in result transport.
 */
function outcomeFields(value, expectedKeys) {
  if (!isPlainObject(value) || !Object.isFrozen(value)) return null;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== expectedKeys.length ||
      !expectedKeys.every(key => keys.includes(key))) return null;
  const fields = {};
  for (const key of expectedKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value') ||
        !descriptor.enumerable) return null;
    fields[key] = descriptor.value;
  }
  return fields;
}

export function isEvaluationOutcome(value) {
  // Both shapes contain the same version/status discriminators; read those
  // without invoking getters, then validate the exact branch shape.
  if (!isPlainObject(value) || !Object.isFrozen(value)) return false;
  const statusDescriptor = Object.getOwnPropertyDescriptor(value, 'status');
  if (!statusDescriptor || !Object.hasOwn(statusDescriptor, 'value')) return false;

  if (statusDescriptor.value === 'success') {
    const fields = outcomeFields(value, ['evaluationOutcomeVersion', 'status', 'value']);
    return fields !== null &&
      fields.evaluationOutcomeVersion === EVALUATION_OUTCOME_VERSION &&
      isValue(fields.value);
  }
  if (statusDescriptor.value === 'failure') {
    const fields = outcomeFields(value, ['evaluationOutcomeVersion', 'status', 'diagnostic']);
    return fields !== null &&
      fields.evaluationOutcomeVersion === EVALUATION_OUTCOME_VERSION &&
      isDiagnostic(fields.diagnostic);
  }
  return false;
}
