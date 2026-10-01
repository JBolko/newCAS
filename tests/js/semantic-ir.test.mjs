import test from 'node:test';
import assert from 'node:assert/strict';

import {
  binderIdentity,
  freeSymbolIdentity,
  operationLocalIdentity,
} from '../../src/js/semantics/identity.js';

import {
  call,
  define,
  defineFunction,
  operationReference,
  providerReference,
  semanticReference,
  valueLiteral,
} from '../../src/js/semantics/semantic-ir.js';

import { expression } from '../../src/js/values/value.js';

const intValue = (n) => expression({ op: 'integer', value: String(n) });
const symbolValue = (identity) => expression({ op: 'symbolRef', identity });

function collectKeys(value, keys = new Set()) {
  if (value === null || typeof value !== 'object') return keys;
  for (const [key, child] of Object.entries(value)) {
    keys.add(key);
    collectKeys(child, keys);
  }
  return keys;
}

test('nearest-predecessor meaning is source-independent once provider is resolved', () => {
  const ir = define('writer:b', call(operationReference('add'), [
    providerReference('writer:a1'),
    semanticReference(freeSymbolIdentity('task-1', 'x')),
  ]));
  assert.equal(ir.body.args[0].providerId, 'writer:a1');
  assert.equal(ir.body.args[1].identity.name, 'x');
  assert.equal(JSON.stringify(ir).includes('a + x'), false);
});

test('read-before-write can bind RHS to previous writer while defining fresh writer', () => {
  const ir = define('writer:a2', call(operationReference('add'), [
    providerReference('writer:a1'),
    semanticReference(freeSymbolIdentity('task-1', 'x')),
  ]));
  assert.equal(ir.writerId, 'writer:a2');
  assert.equal(ir.body.args[0].providerId, 'writer:a1');
});

test('function body distinguishes local binder, captured provider and free symbol', () => {
  const x = binderIdentity('binder:f:x', 'x');
  const y = freeSymbolIdentity('task-1', 'y');
  const ir = defineFunction('writer:f1', [x], call(operationReference('mul'), [
    semanticReference(x),
    providerReference('writer:a1'),
    semanticReference(y),
  ]));
  assert.equal(ir.body.args[0].identity.kind, 'binder');
  assert.equal(ir.body.args[1].kind, 'provider-reference');
  assert.equal(ir.body.args[2].identity.kind, 'free-symbol');
});

test('operation-local target is representable without encoding OperationSpec policy', () => {
  const x = operationLocalIdentity('oplocal:diff:x', 'x');
  const ir = call(operationReference('diff'), [
    semanticReference(x),
    semanticReference(x),
  ]);
  assert.equal(ir.args[1].identity.kind, 'operation-local');
  assert.equal('argumentRoles' in ir, false);
});

test('same spelling remains distinct across free, binder and operation-local identities', () => {
  const free = semanticReference(freeSymbolIdentity('task-1', 'x'));
  const binder = semanticReference(binderIdentity('binder:x', 'x'));
  const local = semanticReference(operationLocalIdentity('local:x', 'x'));
  assert.notDeepEqual(free.identity, binder.identity);
  assert.notDeepEqual(binder.identity, local.identity);
  assert.notDeepEqual(free.identity, local.identity);
});

test('Semantic IR is deeply immutable and detached from caller-owned arrays', () => {
  const args = [semanticReference(freeSymbolIdentity('task-1', 'x'))];
  const ir = call(operationReference('sin'), args);
  args.push(semanticReference(freeSymbolIdentity('task-1', 'y')));
  assert.equal(ir.args.length, 1);
  assert.equal(Object.isFrozen(ir), true);
  assert.equal(Object.isFrozen(ir.args), true);
});

test('materialized Value is not re-resolved by a later lexical binder', () => {
  const freeX = freeSymbolIdentity('task:1', 'x');
  const localX = binderIdentity('binder:f:x', 'x');
  const materialized = valueLiteral(symbolValue(freeX));

  assert.equal(materialized.kind, 'value');
  assert.deepEqual(materialized.value.data.expr.identity, freeX);
  assert.notDeepEqual(materialized.value.data.expr.identity, localX);
});

test('materialized Value remains distinct from same-spelled operation-local target', () => {
  const freeX = freeSymbolIdentity('task:1', 'x');
  const localX = operationLocalIdentity('oplocal:integral:x', 'x');

  const ir = call(operationReference('integral'), [
    valueLiteral(symbolValue(freeX)),
    semanticReference(localX),
    valueLiteral(intValue(0)),
    valueLiteral(intValue(1)),
  ]);

  assert.deepEqual(ir.args[0].value.data.expr.identity, freeX);
  assert.deepEqual(ir.args[1].identity, localX);
  assert.notDeepEqual(ir.args[0].value.data.expr.identity, ir.args[1].identity);
});

test('container construction does not require a container-shaped IR hierarchy', () => {
  const ir = call(operationReference('vector'), [
    providerReference('writer:a'),
    providerReference('writer:b'),
  ]);

  assert.equal(ir.kind, 'call');
  assert.equal(ir.callee.kind, 'operation-reference');
  assert.equal(ir.callee.operationId, 'vector');
  assert.deepEqual(ir.args.map((arg) => arg.providerId), ['writer:a', 'writer:b']);
});

test('relation construction can remain a canonical operation call', () => {
  const ir = call(operationReference('eq'), [
    providerReference('writer:a'),
    providerReference('writer:b'),
  ]);

  assert.equal(ir.kind, 'call');
  assert.equal(ir.callee.operationId, 'eq');
  assert.equal(ir.args.length, 2);
});

test('substitution target is semantic identity rather than display spelling', () => {
  const freeX = freeSymbolIdentity('task:1', 'x');
  const ir = call(operationReference('substitute'), [
    providerReference('writer:A'),
    semanticReference(freeX),
    valueLiteral(intValue(2)),
  ]);

  assert.equal(ir.args[1].kind, 'semantic-reference');
  assert.deepEqual(ir.args[1].identity, freeX);
  assert.equal('name' in ir.args[1], false);
});

test('substitution distinguishes free symbol from same-spelled lexical binder', () => {
  const freeX = freeSymbolIdentity('task:1', 'x');
  const localX = binderIdentity('binder:f:x', 'x');

  const freeTarget = semanticReference(freeX);
  const binderTarget = semanticReference(localX);

  assert.notDeepEqual(freeTarget.identity, binderTarget.identity);
});

test('resolved IR contains no source or document-runtime context', () => {
  const x = freeSymbolIdentity('task:semantic-scope', 'x');
  const ir = define('writer:result', call(operationReference('add'), [
    providerReference('writer:a'), semanticReference(x), valueLiteral(intValue(2)),
  ]));
  const keys = collectKeys(ir);
  for (const key of ['source','sourceText','ast','documentId','blockId','documentIndex','position','dependencyGraph','dirty','generation','history','backend','pyodide','sympy'])
    assert.equal(keys.has(key), false, `Semantic IR leaked forbidden field: ${key}`);
});

test('same resolved meaning produces identical IR independent of source history', () => {
  const build = () => define('writer:b', call(operationReference('add'), [
    providerReference('writer:a'), valueLiteral(intValue(1)),
  ]));
  assert.deepEqual(build(), build());
});

test('provider choice is already explicit and needs no document-order lookup in IR', () => {
  const earlier = define('writer:use', providerReference('writer:a1'));
  const later = define('writer:use', providerReference('writer:a2'));
  assert.equal(earlier.body.providerId, 'writer:a1');
  assert.equal(later.body.providerId, 'writer:a2');
  assert.notDeepEqual(earlier, later);
  assert.equal('documentIndex' in earlier.body, false);
});

test('function IR carries binder identity and resolved external provider explicitly', () => {
  const x = binderIdentity('binder:f:x', 'x');
  const ir = defineFunction('writer:f', [x], call(operationReference('add'), [
    semanticReference(x), providerReference('writer:a'),
  ]));
  assert.deepEqual(ir.parameters[0], x);
  assert.deepEqual(ir.body.args[0].identity, x);
  assert.equal(ir.body.args[1].providerId, 'writer:a');
});

test('operation identity is explicit without dispatch metadata', () => {
  const ir = call(operationReference('differentiate'), [
    providerReference('writer:A'),
    semanticReference(freeSymbolIdentity('task:semantic-scope', 'x')),
  ]);
  assert.equal(ir.callee.operationId, 'differentiate');
  assert.equal('backendName' in ir.callee, false);
  assert.equal('dispatch' in ir.callee, false);
  assert.equal('argumentRoles' in ir.callee, false);
});

test('Semantic IR survives JSON transport without live runtime objects', () => {
  const ir = define('writer:r', call(operationReference('multiply'), [
    providerReference('writer:a'), valueLiteral(intValue(3)),
  ]));
  assert.deepEqual(JSON.parse(JSON.stringify(ir)), ir);
});
