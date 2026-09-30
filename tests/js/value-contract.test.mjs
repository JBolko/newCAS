import { binderIdentity, freeSymbolIdentity, operationLocalIdentity } from '../../src/js/semantics/identity.js';
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  VALUE_VERSION,
  decodeValue,
  emptySet,
  encodeValue,
  expression,
  finiteSet,
  functionValue,
  interval,
  isValue,
  list,
  matrix,
  quantity,
  relation,
  vector,
} from '../../src/js/values/value.js';

const int = (n) => expression({ op: 'integer', value: String(n) });
const sym = (id) => expression({ op: 'symbolRef', identity: id });

test('ExpressionValue round-trips and is deeply immutable', () => {
  const value = expression({
    op: 'add',
    args: [
      { op: 'integer', value: '2' },
      { op: 'symbolRef', identity: freeSymbolIdentity('task-A', 'x') },
    ],
  });

  const restored = decodeValue(encodeValue(value));
  assert.deepEqual(restored, value);
  assert.ok(Object.isFrozen(restored));
  assert.ok(Object.isFrozen(restored.data));
  assert.ok(Object.isFrozen(restored.data.expr));
  assert.ok(Object.isFrozen(restored.data.expr.args));
});

test('constructors detach Value state from mutable caller input', () => {
  const expr = { op: 'integer', value: '5' };
  const value = expression(expr);
  expr.value = '99';
  assert.equal(value.data.expr.value, '5');
});

test('ListValue, VectorValue and MatrixValue remain distinct', () => {
  const items = [int(1), int(2)];

  const l = list(items);
  const v = vector(items);
  const m = matrix([[int(1), int(2)]]);

  assert.equal(l.kind, 'list');
  assert.equal(v.kind, 'vector');
  assert.equal(m.kind, 'matrix');
  assert.notDeepEqual(l, v);
  assert.equal(m.data.rows, 1);
  assert.equal(m.data.cols, 2);
});

test('MatrixValue rejects ragged matrices', () => {
  assert.throws(
    () => matrix([[int(1), int(2)], [int(3)]]),
    /row length must match cols/
  );
});

test('QuantityValue contains mathematical quantity only, not display preference', () => {
  // P0005 does not perform conversion. A later adapter produces the canonical
  // magnitude/unit. Presentation preferences live outside mathematical Value.
  const twentyCelsiusCanonical = quantity(
    expression({ op: 'rational', numerator: '5863', denominator: '20' }), // 293.15
    'K',
  );

  assert.equal(twentyCelsiusCanonical.data.unit, 'K');
  assert.deepEqual(Object.keys(twentyCelsiusCanonical.data).sort(), ['magnitude', 'unit']);

  assert.throws(
    () => decodeValue(JSON.stringify({
      valueVersion: VALUE_VERSION,
      kind: 'quantity',
      data: {
        magnitude: int(20),
        unit: 'K',
        displayUnit: 'degC',
      },
    })),
    /unknown field "displayUnit"/,
  );
});

test('symbol identity reference survives transport without falling back to display name', () => {
  const x = sym(freeSymbolIdentity('task-A', 'x'));
  const restored = decodeValue(encodeValue(x));
  assert.deepEqual(restored.data.expr.identity, freeSymbolIdentity('task-A', 'x'));
});


test('ExpressionValue covers approximate, nested arithmetic and calls', () => {
  const fixtures = [
    expression({op:'approx', value:'3.14159'}),
    expression({op:'mul', args:[{op:'integer',value:'2'},{op:'add',args:[{op:'symbolRef',identity:freeSymbolIdentity('task-A', 'x')},{op:'integer',value:'1'}]}]}),
    expression({op:'call', name:'sin', args:[{op:'symbolRef',identity:freeSymbolIdentity('task-A', 'x')}]}),
  ];
  fixtures.forEach(v => assert.deepEqual(decodeValue(encodeValue(v)), v));
});

test('FunctionValue transports binders, body and resolved captures', () => {
  const one = functionValue([{identity:binderIdentity('binder-x', 'x')}], sym(binderIdentity('binder-x', 'x')));
  const two = functionValue([{identity:binderIdentity('binder-x', 'x')},{identity:binderIdentity('binder-y', 'y')}],
    expression({op:'add',args:[{op:'symbolRef',identity:binderIdentity('binder-x', 'x')},{op:'symbolRef',identity:binderIdentity('binder-y', 'y')}]}));
  const captured = functionValue([{identity:binderIdentity('binder-x', 'x')}],
    expression({op:'add',args:[{op:'symbolRef',identity:binderIdentity('binder-x', 'x')},{op:'symbolRef',identity:freeSymbolIdentity('task-A', 'a')}]}),
    [{identity:freeSymbolIdentity('task-A', 'a'), value:int(7)}]);
  [one,two,captured].forEach(v => assert.deepEqual(decodeValue(encodeValue(v)), v));
  assert.equal(captured.data.capturedValues[0].value.data.expr.value, '7');
});

test('FunctionValue preserves distinct placeholder identities', () => {
  const a=functionValue([{identity:binderIdentity('binder-A', 'x')}],sym(binderIdentity('binder-A', 'x')));
  const b=functionValue([{identity:binderIdentity('binder-B', 'x')}],sym(binderIdentity('binder-B', 'x')));
  assert.notEqual(encodeValue(a),encodeValue(b));
});

test('RelationValue and SetValue round-trip with finite sets canonicalized', () => {
  const rel=relation('le',sym(freeSymbolIdentity('task-A', 'x')),int(5));
  const empty=emptySet();
  const finiteA=finiteSet([int(3),int(1),int(2)]);
  const finiteB=finiteSet([int(2),int(3),int(1)]);
  const iv=interval(int(0),int(1),{lowerClosed:true});
  [rel,empty,finiteA,iv].forEach(v => assert.deepEqual(decodeValue(encodeValue(v)),v));
  assert.equal(encodeValue(finiteA),encodeValue(finiteB));
  assert.throws(()=>relation('approximately',int(1),int(2)),/unsupported relation operator/);
});

test('remaining container and quantity fixtures round-trip', () => {
  const heterogeneous=list([int(1),expression({op:'constant',name:'pi'}),relation('eq',sym(freeSymbolIdentity('task-A', 'x')),int(2))]);
  const symbolicMatrix=matrix([[sym(freeSymbolIdentity('task-A', 'x')),int(1)],[int(0),sym(freeSymbolIdentity('task-A', 'y'))]]);
  const qs=[
    quantity(int(5),'m'),
    quantity(int(20),'m/s'),
    quantity(int(12),'J/(kg*K)'),
    quantity(expression({op:'rational',numerator:'5863',denominator:'20'}),'K'),
    quantity(int(20),'K'),
  ];
  [heterogeneous,symbolicMatrix,...qs].forEach(v=>assert.deepEqual(decodeValue(encodeValue(v)),v));
});


test('FunctionValue binder does not capture materialized free symbol with same display name', () => {
  const freeX = freeSymbolIdentity('task-A', 'x');
  const localX = binderIdentity('function-f:x', 'x');
  const materializedFreeX = sym(freeX);
  const fn = functionValue(
    [{ identity: localX }],
    materializedFreeX,
    [{ identity: freeX, value: materializedFreeX }],
  );
  const restored = decodeValue(encodeValue(fn));
  assert.deepEqual(restored.data.parameters[0].identity, localX);
  assert.deepEqual(restored.data.body.data.expr.identity, freeX);
  assert.notDeepEqual(restored.data.body.data.expr.identity, localX);
});

test('Value contract rejects display-name strings where SemanticIdentity is required', () => {
  assert.throws(() => expression({ op: 'symbolRef', identity: 'x' }), /SemanticIdentity/);
  assert.throws(() => functionValue([{ identity: 'x' }], int(1)), /SemanticIdentity/);
});

test('malformed or unknown Values are rejected', () => {
  assert.equal(isValue({ valueVersion: VALUE_VERSION, kind: 'sympy', data: {} }), false);

  assert.throws(
    () => decodeValue('{"valueVersion":1,"kind":"expression","data":{"expr":{"op":"integer","value":2}}}'),
    /integer value must be a canonical decimal string/
  );

  assert.throws(
    () => decodeValue('{"valueVersion":999,"kind":"expression","data":{}}'),
    /unsupported valueVersion/
  );
});

test('encoding is deterministic for canonicalized unordered Values', () => {
  const first = finiteSet([int(3), int(1), int(2)]);
  const second = finiteSet([int(2), int(3), int(1)]);

  assert.equal(encodeValue(first), encodeValue(second));
  assert.equal(
    encodeValue(decodeValue(encodeValue(first))),
    encodeValue(first),
  );
});


test('nested FunctionValue binders with same display name retain distinct identities', () => {
  const outerX = binderIdentity('outer-function:x', 'x');
  const innerX = binderIdentity('inner-function:x', 'x');

  const inner = functionValue(
    [{ identity: innerX }],
    sym(innerX),
  );
  const outer = functionValue(
    [{ identity: outerX }],
    inner,
  );

  const restored = decodeValue(encodeValue(outer));
  const restoredOuter = restored.data.parameters[0].identity;
  const restoredInner = restored.data.body.data.parameters[0].identity;
  const restoredInnerBody = restored.data.body.data.body.data.expr.identity;

  assert.deepEqual(restoredOuter, outerX);
  assert.deepEqual(restoredInner, innerX);
  assert.deepEqual(restoredInnerBody, innerX);
  assert.notDeepEqual(restoredOuter, restoredInner);
});

test('FunctionValue preserves free symbol distinct from same-spelled nested binders', () => {
  const freeX = freeSymbolIdentity('task-A', 'x');
  const outerX = binderIdentity('outer:x', 'x');
  const innerX = binderIdentity('inner:x', 'x');
  const materializedFreeX = sym(freeX);

  const inner = functionValue(
    [{ identity: innerX }],
    materializedFreeX,
    [{ identity: freeX, value: materializedFreeX }],
  );
  const outer = functionValue(
    [{ identity: outerX }],
    inner,
  );

  const restored = decodeValue(encodeValue(outer));
  const innerRestored = restored.data.body;

  assert.deepEqual(innerRestored.data.body.data.expr.identity, freeX);
  assert.notDeepEqual(innerRestored.data.body.data.expr.identity, outerX);
  assert.notDeepEqual(innerRestored.data.body.data.expr.identity, innerX);
});

test('FunctionValue transport preserves operation-local identity distinct from lexical binder', () => {
  const localX = binderIdentity('function:x', 'x');
  const targetX = operationLocalIdentity('diff:x', 'x');
  const body = sym(targetX);

  const fn = functionValue([{ identity: localX }], body);
  const restored = decodeValue(encodeValue(fn));

  assert.deepEqual(restored.data.parameters[0].identity, localX);
  assert.deepEqual(restored.data.body.data.expr.identity, targetX);
  assert.notDeepEqual(
    restored.data.parameters[0].identity,
    restored.data.body.data.expr.identity,
  );
});


test('decoded SemanticIdentity references are frozen before Value validation', () => {
  const original = sym(freeSymbolIdentity('task-A', 'x'));
  const restored = decodeValue(encodeValue(original));
  const identity = restored.data.expr.identity;

  assert.equal(Object.isFrozen(identity), true);
  assert.deepEqual(identity, freeSymbolIdentity('task-A', 'x'));
});

test('Value constructors detach and freeze caller-owned SemanticIdentity payloads', () => {
  const identity = freeSymbolIdentity('task-A', 'x');
  const value = sym(identity);

  assert.notEqual(value.data.expr.identity, identity);
  assert.equal(Object.isFrozen(value.data.expr.identity), true);
  assert.deepEqual(value.data.expr.identity, identity);
});
