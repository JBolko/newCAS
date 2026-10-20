/**
 * S96a RED contracts, from the S95 snapshot at 8a7b0d4.
 *
 * Tests 1-3 express DESIRED future behavior and must FAIL on S95.
 * Test 4 is a POSITIVE rollback regression and must PASS on S95.
 *
 * No test-only hooks are added to production modules. Fault injection uses
 * an instance override of the already public deriveSemanticTask method.
 * No Python/SymPy, Worker, or legacy engine is involved in this slice.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {createDocumentHistorySession} from '../../src/js/editing/create-document-history-session.js';
import {createSemanticCalculateAction} from '../../src/js/ui/create-semantic-calculate-action.js';
import {expression} from '../../src/js/values/value.js';

function fixture() {
  const runtime = DocumentRuntime.createSemantic('s96a-red');
  for (const [id, source] of [
    ['a', 'a:=2'], ['f', 'f(t):=t^2+a'], ['r', 'f(3)'],
  ]) runtime.addBlock({id, type:'formula', taskId:'T', source});
  // Use genuine immutable Values rather than success with fake result objects.
  const value = expression({op:'integer', value:'1'});
  for (const block of runtime.getBlocks()) {
    runtime.getBlock(block.id).calculation = {
      status:'success', generation:3, result:value, error:null,
    };
  }
  let epoch = 0;
  return {
    runtime,
    getCurrentRevision: () => `rev-${epoch}`,
    advanceRevision: () => { epoch++; },
    get epoch() { return epoch; },
  };
}

function authoritativeAndCalculationState(runtime) {
  return runtime.getBlocks().map(block => ({
    id:block.id, type:block.type, taskId:block.taskId, source:block.source,
    calculation: {
      status:block.calculation.status,
      generation:block.calculation.generation,
      result:block.calculation.result,
      error:block.calculation.error,
    },
  }));
}

function failOnSecondSemanticDerivation(runtime) {
  const original = runtime.deriveSemanticTask;
  let calls = 0;
  runtime.deriveSemanticTask = function (...args) {
    calls++;
    if (calls === 2) throw new Error('S96A_INJECTED_SEMANTIC_FAILURE');
    return original.apply(this, args);
  };
  return () => { runtime.deriveSemanticTask = original; };
}

// RED 1 / observational P4: exception during semantic rebuilding must NOT
// leave a changed source, valid-looking downstream result, or altered graph.
test('S96a RED: setBlockSource rollback is all-or-nothing on semantic failure', () => {
  const {runtime} = fixture();
  const before = authoritativeAndCalculationState(runtime);
  const previousGraph = runtime.getDependencyGraph('T');
  let notifications = 0;
  runtime.subscribeSemanticChanges(() => { notifications++; });
  const restore = failOnSecondSemanticDerivation(runtime);
  try {
    assert.throws(() => runtime.setBlockSource('a','a:=7'),
      /S96A_INJECTED_SEMANTIC_FAILURE/);
  } finally { restore(); }
  assert.deepEqual(authoritativeAndCalculationState(runtime), before,
    'rejected mutation must leave both source and calculation slots untouched');
  assert.equal(runtime.getDependencyGraph('T'), previousGraph,
    'rejected mutation must restore the dependency graph');
  assert.equal(notifications, 0, 'rejected mutation sends no notification');
});

// RED 2 / observational P2: a synchronous notification observer cannot
// perform a nested authoritative edit and corrupt an Undo/Redo entry.
test('S96a RED: reentrant observer mutation is refused and Undo stays coherent', () => {
  const d = fixture();
  let attempts = 0;
  d.runtime.subscribeSemanticChanges(() => {
    if (++attempts === 1) d.runtime.setBlockSource('r','f(5)');
  });
  const history = createDocumentHistorySession({
    runtime:d.runtime,
    getCurrentRevision:d.getCurrentRevision,
    advanceRevision:d.advanceRevision,
  });
  const committed = history.execute([{kind:'source',blockId:'a',source:'a:=3'}]);
  assert.equal(committed.kind, 'applied');
  assert.equal(committed.notificationErrors, 1,
    'attempted reentrant mutation must be handled as one observer error');
  assert.equal(d.runtime.getBlock('r').source, 'f(3)',
    'observer must not introduce an unrecorded edit');
  assert.equal(history.undo().kind, 'applied');
  assert.equal(d.runtime.getBlock('a').source, 'a:=2');
  assert.equal(d.runtime.getBlock('r').source, 'f(3)');
  assert.equal(history.redo().kind, 'applied');
  assert.equal(d.runtime.getBlock('a').source, 'a:=3');
  assert.equal(d.epoch, 3, 'host revision never rolls back');
});

// RED 3 / observational P5: Calculate receives two separately valid proposals;
// a throwing listener is isolated from the one atomic document mutation.
test('S96a RED: multi-draft Calculate commits together despite a throwing observer', async () => {
  const d = fixture();
  let notices = 0;
  d.runtime.subscribeSemanticChanges(() => {
    notices++;
    throw new Error('S96A_OBSERVER_FAILURE');
  });
  let runs = 0;
  const action = createSemanticCalculateAction({
    runtime:d.runtime, taskId:'T',
    session:{run:async()=>{runs++;return {kind:'complete'};}},
    getCurrentRevision:d.getCurrentRevision,
    advanceRevision:d.advanceRevision,
  });
  const answer = await action.calculate([
    {blockId:'a',source:'a:=5'},
    {blockId:'r',source:'f(4)'},
  ]);
  assert.equal(answer.kind, 'complete');
  assert.equal(d.runtime.getBlock('a').source, 'a:=5');
  assert.equal(d.runtime.getBlock('r').source, 'f(4)');
  assert.equal(notices, 1, 'one user action emits one dependency notification');
  assert.equal(d.epoch, 1, 'one user action advances host revision once');
  assert.equal(runs, 1, 'successful commit schedules one calculation');
});

// GREEN baseline / observational P3: a transaction already rolls back when
// a semantic derivation throws after its temporary staged publication.
test('S96a baseline: prepared transaction rollback restores all state and graph', () => {
  const {runtime} = fixture();
  const before = authoritativeAndCalculationState(runtime);
  const previousGraph = runtime.getDependencyGraph('T');
  let notifications = 0;
  runtime.subscribeSemanticChanges(() => { notifications++; });
  const plan = runtime.prepareDocumentTransaction([
    {kind:'remove',blockId:'a'},
    {kind:'source',blockId:'r',source:'f(9)'},
  ]);
  const restore = failOnSecondSemanticDerivation(runtime);
  try {
    assert.throws(() => runtime.applyDocumentTransaction(plan),
      /S96A_INJECTED_SEMANTIC_FAILURE/);
  } finally { restore(); }
  assert.deepEqual(authoritativeAndCalculationState(runtime), before);
  assert.equal(runtime.getDependencyGraph('T'), previousGraph);
  assert.equal(notifications, 0);
});
