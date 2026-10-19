import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {createFormulaEditingSession} from '../../src/js/editing/create-formula-editing-session.js';
import {createFormulaStructuralAction} from '../../src/js/editing/create-formula-structural-action.js';

function setup() {
  const runtime=DocumentRuntime.createSemantic('s95l');
  for(const [id,source,taskId] of [
    ['a','a:=2','task'],['b','b:=a+1','task'],['c','c:=b+1','task'],['outside','q:=42','other']
  ]) runtime.addBlock({id,type:'formula',taskId,source});
  let rev=0;
  const editing=createFormulaEditingSession({runtime,taskId:'task'});
  const make=(overrides={})=>createFormulaStructuralAction({runtime,taskId:'task',editingSession:editing,
    getCurrentRevision:()=>`revision-${rev}`,advanceRevision:()=>{rev++;},...overrides});
  const snapshot=()=>runtime.getBlocks().map(b=>[b.id,b.taskId,b.source,b.calculation.generation]);
  return {runtime,editing,make,snapshot,get rev(){return rev;}};
}

test('S95l requires semantic-only runtime and revision ownership',()=>{
  assert.throws(()=>createFormulaStructuralAction(),/S95L_ACTION_CONTRACT/);
  const s=setup();assert.throws(()=>s.make({advanceRevision:null}),/S95L_ACTION_CONTRACT/);
  const legacy=new DocumentRuntime({calculate(){}},'legacy');
  assert.throws(()=>createFormulaStructuralAction({runtime:legacy,taskId:'task',
    getCurrentRevision:()=> 'r0',advanceRevision:()=>{}}),/S95L_ACTION_CONTRACT/);
});
test('S95l rejects unknown kind and unexpected fields without source or revision change',()=>{
  const s=setup(),old=s.snapshot();
  for(const p of [null,{kind:'rename'},{kind:'remove',blockId:'a',secret:1},
    {kind:'insert',blockId:'x',index:1,source:'1',calculation:{status:'success'}}])
    assert.throws(()=>s.make().apply(p),/S95L_/);
  assert.deepEqual(s.snapshot(),old);assert.equal(s.rev,0);
});
test('S95l prevalidates insert ID, index, and source before any revision',()=>{
  const s=setup(),old=s.snapshot();
  for(const p of [{kind:'insert',blockId:'a',index:1,source:'5'},
    {kind:'insert',blockId:'',index:1,source:'5'},
    {kind:'insert',blockId:'next',index:99,source:'5'},
    {kind:'insert',blockId:'next',index:1,source:17}])
      assert.throws(()=>s.make().apply(p),/S95L_INSERT_INVALID/);
  assert.deepEqual(s.snapshot(),old);assert.equal(s.rev,0);
});
test('S95l insert leaves new block ID to caller and dependency analysis to runtime',()=>{
  const s=setup();const x=s.make().apply({kind:'insert',blockId:'newWriter',index:1,source:'a:=10'});
  assert.equal(x.kind,'applied');assert.ok(Object.isFrozen(x));
  assert.deepEqual(s.runtime.getBlocks().map(b=>b.id),['a','newWriter','b','c','outside']);
  assert.equal(s.runtime.getBlock('newWriter').calculation.status,'idle');
  assert.equal(s.runtime.deriveSemanticTask('task').snapshot.blocks.length,4);
  assert.equal(s.rev,1);
});
test('S95l opaque block IDs are preserved rather than derived from the DOM',()=>{
  const s=setup();s.make().apply({kind:'insert',blockId:'uuid:example/1',index:1,source:'2'});
  assert.equal(s.runtime.getBlock('uuid:example/1').source,'2');
});
test('S95l incomplete mathematical input is source data, not a structural error',()=>{
  const s=setup();s.make().apply({kind:'insert',blockId:'incomplete',index:1,source:'f('});
  assert.equal(s.runtime.getBlock('incomplete').source,'f(');
});
test('S95l remove invalidates dependent providers through the existing runtime',()=>{
  const s=setup();const r=s.make().apply({kind:'remove',blockId:'a'});
  assert.equal(r.kind,'applied');assert.equal(s.runtime.getBlock('a'),null);
  assert.deepEqual(s.runtime.getBlocks().map(b=>b.id),['b','c','outside']);
  assert.equal(s.rev,1);
});
test('S95l move preserves block object identity and delegates order semantics',()=>{
  const s=setup(),first=s.runtime.getBlock('a');
  const r=s.make().apply({kind:'move',blockId:'a',index:2});
  assert.equal(r.kind,'applied');assert.equal(s.runtime.getBlock('a'),first);
  assert.deepEqual(s.runtime.getBlocks().map(b=>b.id),['b','c','a','outside']);
  assert.equal(s.rev,1);
});
test('S95l no-op move neither advances revision nor invalidates results',()=>{
  const s=setup(),before=s.snapshot();
  assert.deepEqual(s.make().apply({kind:'move',blockId:'b',index:1}),{kind:'unchanged'});
  assert.equal(s.rev,0);assert.deepEqual(s.snapshot(),before);
});
test('S95l cannot remove/move another task or nonexistent block',()=>{
  const s=setup(),before=s.snapshot();
  for(const p of [{kind:'remove',blockId:'outside'},{kind:'move',blockId:'outside',index:1},
    {kind:'remove',blockId:'absent'},{kind:'move',blockId:'a',index:99}])
    assert.throws(()=>s.make().apply(p),/S95L_/);
  assert.deepEqual(s.snapshot(),before);assert.equal(s.rev,0);
});
test('S95l active EditingSession draft blocks structural action before any write',()=>{
  const s=setup(),before=s.snapshot();s.editing.begin('a');s.editing.replaceSource('a:=999');
  assert.throws(()=>s.make().apply({kind:'remove',blockId:'a'}),/S95L_ACTIVE_FORMULA_DRAFT/);
  assert.equal(s.rev,0);assert.deepEqual(s.snapshot(),before);
  assert.equal(s.editing.snapshot().source,'a:=999');
});
test('S95l failed host revision update prevents mutation',()=>{
  const s=setup(),before=s.snapshot();
  const a=s.make({advanceRevision:()=>{}});
  assert.throws(()=>a.apply({kind:'remove',blockId:'a'}),/S95L_REVISION_UNCHANGED/);
  assert.deepEqual(s.snapshot(),before);
});
test('S95l a revision callback cannot silently mutate authoritative document structure',()=>{
  const s=setup();let rev=0;
  const a=s.make({getCurrentRevision:()=>`other-${rev}`,
    advanceRevision:()=>{rev++;s.runtime.removeBlock('a');}});
  assert.throws(()=>a.apply({kind:'remove',blockId:'b'}),/S95L_STRUCTURE_CHANGED_DURING_REVISION/);
  assert.equal(s.runtime.getBlock('b').source,'b:=a+1');
});
test('S95l a revision callback cannot mutate a source under the guard',()=>{
  const s=setup();let rev=0;
  const a=s.make({getCurrentRevision:()=>`other-${rev}`,
    advanceRevision:()=>{rev++;s.runtime.setBlockSource('b','b:=123');}});
  assert.throws(()=>a.apply({kind:'remove',blockId:'a'}),/S95L_STRUCTURE_CHANGED_DURING_REVISION/);
  assert.equal(s.runtime.getBlock('a').source,'a:=2');
});
test('S95l successful action never creates a new document model or evaluator',()=>{
  const s=setup();const a=s.make();
  assert.deepEqual(Object.keys(a),['apply']);
  assert.equal('blocks' in a,false);assert.equal('calculate' in a,false);
  a.apply({kind:'remove',blockId:'c'});
  assert.equal(s.runtime.getBlocks().length,3);
});
