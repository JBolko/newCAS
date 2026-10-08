import { isSemanticIdentity } from '../semantics/identity.js';

/**
 * P0005 — Value Contract v1, first implementation slice.
 *
 * Backend-independent public mathematical Values.
 * No SymPy/Pyodide dependency. No evaluation is performed here.
 */

export const VALUE_VERSION = 1;

const KINDS = new Set([
  'expression',
  'function',
  'relation',
  'set',
  'list',
  'vector',
  'matrix',
  'quantity',
]);

function fail(message) {
  throw new TypeError(`Invalid Value: ${message}`);
}

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

function cloneJson(value) {
  // Values are deliberately JSON transport values. This also prevents callers
  // from retaining mutable references into a Value.
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    fail('payload must be JSON-serializable');
  }
}

function assertKeys(object, allowed, context) {
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) fail(`${context} contains unknown field "${key}"`);
  }
}

function validateEnvelope(value) {
  if (!isPlainObject(value)) fail('envelope must be an object');
  assertKeys(value, new Set(['valueVersion', 'kind', 'data']), 'envelope');

  if (value.valueVersion !== VALUE_VERSION) {
    fail(`unsupported valueVersion ${JSON.stringify(value.valueVersion)}`);
  }
  if (!KINDS.has(value.kind)) fail(`unsupported kind ${JSON.stringify(value.kind)}`);
  if (!isPlainObject(value.data)) fail('data must be an object');
}

function validateExprNode(node) {
  if (!isPlainObject(node)) fail('expression node must be an object');
  if (typeof node.op !== 'string') fail('expression node requires op');

  switch (node.op) {
    case 'integer':
      assertKeys(node, new Set(['op', 'value']), 'integer node');
      if (typeof node.value !== 'string' || !/^-?(0|[1-9]\d*)$/.test(node.value)) {
        fail('integer value must be a canonical decimal string');
      }
      return;

    case 'rational':
      assertKeys(node, new Set(['op', 'numerator', 'denominator']), 'rational node');
      if (typeof node.numerator !== 'string' || !/^-?(0|[1-9]\d*)$/.test(node.numerator)) {
        fail('rational numerator must be an integer string');
      }
      if (typeof node.denominator !== 'string' || !/^[1-9]\d*$/.test(node.denominator)) {
        fail('rational denominator must be a positive integer string');
      }
      return;

    case 'approx':
      assertKeys(node, new Set(['op', 'value', 'precisionBits']), 'approx node');
      if (typeof node.value !== 'string' ||
          !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(node.value)) {
        fail('approx value must be a finite decimal string');
      }
      if (node.precisionBits !== undefined &&
          (!Number.isSafeInteger(node.precisionBits) || node.precisionBits < 1)) {
        fail('approx precisionBits must be a positive safe integer');
      }
      return;

    case 'symbolRef':
      assertKeys(node, new Set(['op', 'identity']), 'symbolRef node');
      if (!isSemanticIdentity(node.identity)) {
        fail('symbolRef identity must be a SemanticIdentity');
      }
      return;

    case 'constant':
      assertKeys(node, new Set(['op', 'name']), 'constant node');
      if (typeof node.name !== 'string' || node.name === '') {
        fail('constant name must be non-empty');
      }
      return;

    case 'add':
    case 'mul':
      assertKeys(node, new Set(['op', 'args']), `${node.op} node`);
      if (!Array.isArray(node.args) || node.args.length < 2) {
        fail(`${node.op} requires at least two args`);
      }
      node.args.forEach(validateExprNode);
      return;

    case 'pow':
      assertKeys(node, new Set(['op', 'base', 'exponent']), 'pow node');
      validateExprNode(node.base);
      validateExprNode(node.exponent);
      return;

    case 'call':
      assertKeys(node, new Set(['op', 'name', 'args']), 'call node');
      if (typeof node.name !== 'string' || node.name === '') fail('call name must be non-empty');
      if (!Array.isArray(node.args)) fail('call args must be an array');
      node.args.forEach(validateExprNode);
      return;

    default:
      fail(`unsupported expression op ${JSON.stringify(node.op)}`);
  }
}

function validateExpressionData(data) {
  assertKeys(data, new Set(['expr']), 'expression data');
  validateExprNode(data.expr);
}


function validateIdentityReference(identity, context) {
  if (!isSemanticIdentity(identity)) {
    fail(`${context} identity must be a SemanticIdentity`);
  }
}

function validateFunctionData(data) {
  assertKeys(data, new Set(['parameters', 'body', 'capturedValues']), 'function data');
  if (!Array.isArray(data.parameters)) fail('function.parameters must be an array');
  for (const parameter of data.parameters) {
    if (!isPlainObject(parameter)) fail('function parameter must be an object');
    assertKeys(parameter, new Set(['identity']), 'function parameter');
    validateIdentityReference(parameter.identity, 'function parameter');
  }
  validateValue(data.body);
  if (!Array.isArray(data.capturedValues)) fail('function.capturedValues must be an array');
  for (const capture of data.capturedValues) {
    if (!isPlainObject(capture)) fail('function capture must be an object');
    assertKeys(capture, new Set(['identity', 'value']), 'function capture');
    validateIdentityReference(capture.identity, 'function capture');
    validateValue(capture.value);
  }
}

const RELATION_OPERATORS = new Set(['eq', 'ne', 'lt', 'le', 'gt', 'ge']);

function validateRelationData(data) {
  assertKeys(data, new Set(['operator', 'left', 'right']), 'relation data');
  if (!RELATION_OPERATORS.has(data.operator)) fail(`unsupported relation operator ${JSON.stringify(data.operator)}`);
  validateValue(data.left); validateValue(data.right);
}

function validateSetData(data) {
  if (typeof data.setKind !== 'string') fail('set.setKind must be a string');
  switch (data.setKind) {
    case 'empty':
      assertKeys(data, new Set(['setKind']), 'empty set data'); return;
    case 'finite':
      assertKeys(data, new Set(['setKind','items']), 'finite set data');
      if (!Array.isArray(data.items)) fail('finite set requires items array');
      data.items.forEach(validateValue); return;
    case 'interval':
      assertKeys(data, new Set(['setKind','lower','upper','lowerClosed','upperClosed']), 'interval set data');
      validateValue(data.lower); validateValue(data.upper);
      if (typeof data.lowerClosed !== 'boolean' || typeof data.upperClosed !== 'boolean') fail('interval closure flags must be boolean');
      return;
    default: fail(`unsupported setKind ${JSON.stringify(data.setKind)}`);
  }
}

function validateValue(value) {
  validateEnvelope(value);

  switch (value.kind) {
    case 'expression':
      validateExpressionData(value.data); return;
    case 'function':
      validateFunctionData(value.data); return;
    case 'relation':
      validateRelationData(value.data); return;
    case 'set':
      validateSetData(value.data); return;

    case 'list':
    case 'vector': {
      assertKeys(value.data, new Set(['items']), `${value.kind} data`);
      if (!Array.isArray(value.data.items)) fail(`${value.kind}.items must be an array`);
      value.data.items.forEach(validateValue);
      return;
    }

    case 'matrix': {
      assertKeys(value.data, new Set(['rows', 'cols', 'entries']), 'matrix data');
      const { rows, cols, entries } = value.data;
      if (!Number.isInteger(rows) || rows < 0) fail('matrix.rows must be a non-negative integer');
      if (!Number.isInteger(cols) || cols < 0) fail('matrix.cols must be a non-negative integer');
      if (!Array.isArray(entries) || entries.length !== rows) {
        fail('matrix.entries row count must match rows');
      }
      for (const row of entries) {
        if (!Array.isArray(row) || row.length !== cols) {
          fail('matrix entry row length must match cols');
        }
        row.forEach(validateValue);
      }
      return;
    }

    case 'quantity': {
      assertKeys(value.data, new Set(['magnitude', 'unit']), 'quantity data');
      validateValue(value.data.magnitude);
      if (typeof value.data.unit !== 'string' || value.data.unit === '') {
        fail('quantity.unit must be a non-empty canonical unit id');
      }
      return;
    }
  }
}

function make(kind, data) {
  const value = deepFreeze({
    valueVersion: VALUE_VERSION,
    kind,
    data: cloneJson(data),
  });
  validateValue(value);
  return value;
}

export function expression(expr) {
  return make('expression', { expr });
}


export function functionValue(parameters, body, capturedValues = []) {
  return make('function', { parameters, body, capturedValues });
}
export function relation(operator, left, right) {
  return make('relation', { operator, left, right });
}
export function emptySet() { return make('set', { setKind: 'empty' }); }
export function finiteSet(items) {
  if (!Array.isArray(items)) fail('finite set items must be an array');
  const canonicalItems = items.map(item => { validateValue(item); return item; })
    .sort((a,b) => encodeValue(a).localeCompare(encodeValue(b)));
  return make('set', { setKind: 'finite', items: canonicalItems });
}
export function interval(lower, upper, { lowerClosed=false, upperClosed=false } = {}) {
  return make('set', { setKind:'interval', lower, upper, lowerClosed, upperClosed });
}

export function list(items) {
  return make('list', { items });
}

export function vector(items) {
  return make('vector', { items });
}

export function matrix(entries) {
  if (!Array.isArray(entries)) fail('matrix entries must be an array');
  const rows = entries.length;
  const cols = rows === 0 ? 0 : (Array.isArray(entries[0]) ? entries[0].length : -1);
  return make('matrix', { rows, cols, entries });
}

export function quantity(magnitude, unit) {
  return make('quantity', { magnitude, unit });
}

export function encodeValue(value) {
  validateValue(value);
  // Object insertion order is controlled by constructors/decoder in this
  // first slice. Full unordered-set canonicalization belongs to the Set slice.
  return JSON.stringify(value);
}

export function decodeValue(serialized) {
  if (typeof serialized !== 'string') fail('encoded Value must be a string');

  let parsed;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    fail('encoded Value must be valid JSON');
  }

  const value = deepFreeze(cloneJson(parsed));
  validateValue(value);
  return value;
}

export function isValue(value) {
  try {
    validateValue(value);
    return true;
  } catch {
    return false;
  }
}