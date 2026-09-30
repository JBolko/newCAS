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
      { op: 'symbolRef', identity: 'P0006:placeholder-x' },
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
  const x = sym('P0006:placeholder-x');
  const restored = decodeValue(encodeValue(x));
  assert.equal(restored.data.expr.identity, 'P0006:placeholder-x');
});


test('ExpressionValue covers approximate, nested arithmetic and calls', () => {
  const fixtures = [
    expression({op:'approx', value:'3.14159'}),
    expression({op:'mul', args:[{op:'integer',value:'2'},{op:'add',args:[{op:'symbolRef',identity:'P0006:x'},{op:'integer',value:'1'}]}]}),
    expression({op:'call', name:'sin', args:[{op:'symbolRef',identity:'P0006:x'}]}),
  ];
  fixtures.forEach(v => assert.deepEqual(decodeValue(encodeValue(v)), v));
});

test('FunctionValue transports binders, body and resolved captures', () => {
  const one = functionValue([{identity:'P0006:binder-x'}], sym('P0006:binder-x'));
  const two = functionValue([{identity:'P0006:binder-x'},{identity:'P0006:binder-y'}],
    expression({op:'add',args:[{op:'symbolRef',identity:'P0006:binder-x'},{op:'symbolRef',identity:'P0006:binder-y'}]}));
  const captured = functionValue([{identity:'P0006:binder-x'}],
    expression({op:'add',args:[{op:'symbolRef',identity:'P0006:binder-x'},{op:'symbolRef',identity:'P0006:free-a'}]}),
    [{identity:'P0006:free-a', value:int(7)}]);
  [one,two,captured].forEach(v => assert.deepEqual(decodeValue(encodeValue(v)), v));
  assert.equal(captured.data.capturedValues[0].value.data.expr.value, '7');
});

test('FunctionValue preserves distinct placeholder identities', () => {
  const a=functionValue([{identity:'P0006:binder-A'}],sym('P0006:binder-A'));
  const b=functionValue([{identity:'P0006:binder-B'}],sym('P0006:binder-B'));
  assert.notEqual(encodeValue(a),encodeValue(b));
});

test('RelationValue and SetValue round-trip with finite sets canonicalized', () => {
  const rel=relation('le',sym('P0006:x'),int(5));
  const empty=emptySet();
  const finiteA=finiteSet([int(3),int(1),int(2)]);
  const finiteB=finiteSet([int(2),int(3),int(1)]);
  const iv=interval(int(0),int(1),{lowerClosed:true});
  [rel,empty,finiteA,iv].forEach(v => assert.deepEqual(decodeValue(encodeValue(v)),v));
  assert.equal(encodeValue(finiteA),encodeValue(finiteB));
  assert.throws(()=>relation('approximately',int(1),int(2)),/unsupported relation operator/);
});

test('remaining container and quantity fixtures round-trip', () => {
  const heterogeneous=list([int(1),expression({op:'constant',name:'pi'}),relation('eq',sym('P0006:x'),int(2))]);
  const symbolicMatrix=matrix([[sym('P0006:x'),int(1)],[int(0),sym('P0006:y')]]);
  const qs=[
    quantity(int(5),'m'),
    quantity(int(20),'m/s'),
    quantity(int(12),'J/(kg*K)'),
    quantity(expression({op:'rational',numerator:'5863',denominator:'20'}),'K'),
    quantity(int(20),'K'),
  ];
  [heterogeneous,symbolicMatrix,...qs].forEach(v=>assert.deepEqual(decodeValue(encodeValue(v)),v));
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
