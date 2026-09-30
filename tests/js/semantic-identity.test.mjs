import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LexicalIdentityScope,
  binderIdentity,
  freeSymbolIdentity,
  identityKey,
  isSemanticIdentity,
  operationLocalIdentity,
  sameIdentity,
} from '../../src/js/semantics/identity.js';

test('same unresolved name in same task has same free-symbol identity', () => {
  const a = freeSymbolIdentity('task-A', 'x');
  const b = freeSymbolIdentity('task-A', 'x');

  assert.ok(sameIdentity(a, b));
  assert.equal(identityKey(a), identityKey(b));
});

test('same spelling in different tasks has different free-symbol identity', () => {
  assert.ok(!sameIdentity(
    freeSymbolIdentity('task-A', 'x'),
    freeSymbolIdentity('task-B', 'x'),
  ));
});

test('binder identity is independent of display spelling', () => {
  const x1 = binderIdentity('binder-1', 'x');
  const x2 = binderIdentity('binder-2', 'x');

  assert.ok(!sameIdentity(x1, x2));
  assert.notEqual(identityKey(x1), identityKey(x2));
});

test('operation-local identity is distinct from lexical binder with same spelling', () => {
  const lexical = binderIdentity('binder-1', 'x');
  const operation = operationLocalIdentity('op-1:x', 'x');

  assert.ok(!sameIdentity(lexical, operation));
});

test('unbound ordinary name resolves to task-local free symbol', () => {
  const scope = new LexicalIdentityScope('task-A');
  assert.ok(sameIdentity(scope.resolve('x'), freeSymbolIdentity('task-A', 'x')));
});

test('lexical binder shadows free symbol of same spelling', () => {
  const x = binderIdentity('binder-f:x', 'x');
  const scope = new LexicalIdentityScope('task-A').push([x]);

  assert.ok(sameIdentity(scope.resolve('x'), x));
  assert.ok(!sameIdentity(scope.resolve('x'), freeSymbolIdentity('task-A', 'x')));
});

test('innermost binder wins when display names are identical', () => {
  const outer = binderIdentity('binder-outer:x', 'x');
  const inner = binderIdentity('binder-inner:x', 'x');
  const scope = new LexicalIdentityScope('task-A')
    .push([outer])
    .push([inner]);

  assert.ok(sameIdentity(scope.resolve('x'), inner));
  assert.ok(!sameIdentity(scope.resolve('x'), outer));
});

test('operation-local symbolic target can shadow an outer lexical binder', () => {
  const outer = binderIdentity('binder-outer:x', 'x');
  const target = operationLocalIdentity('diff-target-1', 'x');
  const scope = new LexicalIdentityScope('task-A')
    .push([outer])
    .push([target]);

  assert.ok(sameIdentity(scope.resolve('x'), target));
});

test('materialized free identity is not captured retroactively by later binder', () => {
  const materializedX = freeSymbolIdentity('task-A', 'x');
  const functionX = binderIdentity('binder-f:x', 'x');
  const functionScope = new LexicalIdentityScope('task-A').push([functionX]);

  assert.ok(sameIdentity(materializedX, freeSymbolIdentity('task-A', 'x')));
  assert.ok(sameIdentity(functionScope.resolve('x'), functionX));
  assert.ok(!sameIdentity(materializedX, functionScope.resolve('x')));
});

test('identity objects are immutable', () => {
  const identity = binderIdentity('binder-1', 'x');
  assert.ok(Object.isFrozen(identity));
  assert.throws(() => { identity.displayName = 'y'; }, TypeError);
});


test('three nested binders with identical display name resolve strictly innermost', () => {
  const outer = binderIdentity('outer:x', 'x');
  const middle = binderIdentity('middle:x', 'x');
  const inner = binderIdentity('inner:x', 'x');

  const outerScope = new LexicalIdentityScope('task-A').push([outer]);
  const middleScope = outerScope.push([middle]);
  const innerScope = middleScope.push([inner]);

  assert.ok(sameIdentity(outerScope.resolve('x'), outer));
  assert.ok(sameIdentity(middleScope.resolve('x'), middle));
  assert.ok(sameIdentity(innerScope.resolve('x'), inner));
});

test('sibling scopes with same display name do not capture each other', () => {
  const leftX = binderIdentity('left:x', 'x');
  const rightX = binderIdentity('right:x', 'x');
  const root = new LexicalIdentityScope('task-A');
  const left = root.push([leftX]);
  const right = root.push([rightX]);

  assert.ok(sameIdentity(left.resolve('x'), leftX));
  assert.ok(sameIdentity(right.resolve('x'), rightX));
  assert.ok(!sameIdentity(left.resolve('x'), right.resolve('x')));
  assert.ok(sameIdentity(root.resolve('x'), freeSymbolIdentity('task-A', 'x')));
});

test('lexical binder inside operation-local scope shadows operation target of same spelling', () => {
  const target = operationLocalIdentity('integral-target:x', 'x');
  const local = binderIdentity('lambda:x', 'x');
  const scope = new LexicalIdentityScope('task-A')
    .push([target])
    .push([local]);

  assert.ok(sameIdentity(scope.resolve('x'), local));
  assert.ok(!sameIdentity(scope.resolve('x'), target));
});

test('operation-local target inside lexical scope shadows lexical binder of same spelling', () => {
  const local = binderIdentity('function:x', 'x');
  const target = operationLocalIdentity('sum-target:x', 'x');
  const scope = new LexicalIdentityScope('task-A')
    .push([local])
    .push([target]);

  assert.ok(sameIdentity(scope.resolve('x'), target));
  assert.ok(!sameIdentity(scope.resolve('x'), local));
});

test('different names continue resolving through nested scopes independently', () => {
  const outerX = binderIdentity('outer:x', 'x');
  const innerY = binderIdentity('inner:y', 'y');
  const scope = new LexicalIdentityScope('task-A')
    .push([outerX])
    .push([innerY]);

  assert.ok(sameIdentity(scope.resolve('x'), outerX));
  assert.ok(sameIdentity(scope.resolve('y'), innerY));
  assert.ok(sameIdentity(scope.resolve('z'), freeSymbolIdentity('task-A', 'z')));
});

test('materialized free symbols preserve task identity across unrelated later scopes', () => {
  const taskAX = freeSymbolIdentity('task-A', 'x');
  const taskBX = freeSymbolIdentity('task-B', 'x');
  const laterBinder = binderIdentity('later:x', 'x');
  const laterScopeA = new LexicalIdentityScope('task-A').push([laterBinder]);

  assert.ok(!sameIdentity(taskAX, taskBX));
  assert.ok(!sameIdentity(taskAX, laterScopeA.resolve('x')));
  assert.ok(sameIdentity(taskAX, freeSymbolIdentity('task-A', 'x')));
});

test('same opaque id does not merge binder and operation-local identity categories', () => {
  const lexical = binderIdentity('shared-id', 'x');
  const operation = operationLocalIdentity('shared-id', 'x');

  assert.ok(!sameIdentity(lexical, operation));
  assert.notEqual(identityKey(lexical), identityKey(operation));
});

test('display name is not part of binder equality key', () => {
  const x = binderIdentity('binder-1', 'x');
  const renamedPresentation = binderIdentity('binder-1', 'ξ');

  assert.ok(sameIdentity(x, renamedPresentation));
});

test('display name is not part of operation-local equality key', () => {
  const x = operationLocalIdentity('target-1', 'x');
  const renamedPresentation = operationLocalIdentity('target-1', 't');

  assert.ok(sameIdentity(x, renamedPresentation));
});


test('mutable lookalike is not a SemanticIdentity', () => {
  const mutable = {
    identityVersion: 1,
    kind: 'binder',
    id: 'mutable:x',
    displayName: 'x',
  };

  assert.equal(isSemanticIdentity(mutable), false);
  assert.throws(
    () => new LexicalIdentityScope('task-A').push([mutable]),
    /invalid identity/,
  );
});

test('scope cannot be semantically mutated through caller-owned identity object', () => {
  const mutable = {
    identityVersion: 1,
    kind: 'binder',
    id: 'mutable:x',
    displayName: 'x',
  };

  assert.throws(
    () => new LexicalIdentityScope('task-A').push([mutable]),
    /invalid identity/,
  );
  mutable.displayName = 'y';
  assert.equal(mutable.displayName, 'y');
});
