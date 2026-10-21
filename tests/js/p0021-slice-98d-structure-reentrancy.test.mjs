/** F2: committed structure is visible, but notification is not a mutation window. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {structuralFixture,structuralEdits,structuralState} from '../helpers/structural-mutation-fixture.mjs';

const nested={
  add:rt=>rt.addBlock({id:'nested',type:'formula',taskId:'T',source:'z:=5'}),
  insert:rt=>rt.insertBlock({id:'nested',type:'formula',taskId:'T',source:'z:=5'},0),
  remove:rt=>rt.removeBlock('b'),move:rt=>rt.moveBlock('b',0),
  source:rt=>rt.setBlockSource('b','b:=999'),
  prepare:rt=>rt.prepareDocumentTransaction([{kind:'source',blockId:'b',source:'b:=999'}]),
};

for(const legacy of [false,true])for(const kind of ['add','insert'])
test(`F2 ${kind} cannot return an already listener-deleted insertion; legacy=${legacy}`,async()=>{
  const rt=await structuralFixture(legacy);let error;
  rt.subscribeSemanticChanges(()=>{try{rt.removeBlock('new');}catch(e){error=e.message;}});
  const returned=structuralEdits[kind](rt);
  assert.equal(error,'S96A_REENTRANT_MUTATION');assert.ok(rt.getBlock('new'));
  if(kind==='add')assert.equal(returned,rt.getBlock('new'),'returned view is still authoritative');
  else assert.deepEqual(returned,new Set(['f','b','c']));
});

for(const legacy of [false,true])for(const kind of Object.keys(structuralEdits))
for(const attempt of Object.keys(nested))
test(`F2 ${kind} notification rejects nested ${attempt}; legacy=${legacy}`,async()=>{
  const rt=await structuralFixture(legacy),untouched=structuralState(rt).blocks.filter(b=>b.taskId==='U');
  let notices=0,error,seen;
  rt.subscribeSemanticChanges(()=>{
    if(++notices!==1)return; // Bound a faulty implementation without recursive test loops.
    seen=rt.getBlocks().map(b=>b.id);
    try{nested[attempt](rt);}catch(e){error=e.message;}
  });
  const outcome=structuralEdits[kind](rt);
  assert.equal(error,'S96A_REENTRANT_MUTATION');assert.equal(notices,1);
  assert.deepEqual(rt.getBlocks().map(b=>b.id),seen,'no nested order change after notification');
  assert.equal(rt.getBlock('nested'),null);assert.equal(rt.getBlock('b').source,'b:=f(3)');
  if(kind==='add')assert.equal(outcome,rt.getBlock('new'),'no stale add return view');
  else {assert.ok(outcome instanceof Set);assert.equal(outcome.has('nested'),false);}
  assert.deepEqual(structuralState(rt).blocks.filter(b=>b.taskId==='U'),untouched);
  // The publication gate must be released after the outer operation.
  rt.setBlockSource('b','b:=8');assert.equal(rt.getBlock('b').source,'b:=8');
});

for(const legacy of [false,true])for(const kind of Object.keys(structuralEdits))
test(`listener exception preserves existing post-publication behavior: ${kind}, legacy=${legacy}`,async()=>{
  const rt=await structuralFixture(legacy),stamp=rt.getDocumentMutationIdentity();let next=0;
  const failure=Error('LISTENER_FAILURE');
  const unsubscribe=rt.subscribeSemanticChanges(()=>{throw failure;});
  rt.subscribeSemanticChanges(()=>next++);
  if(legacy)assert.throws(()=>structuralEdits[kind](rt),e=>e===failure);
  else assert.doesNotThrow(()=>structuralEdits[kind](rt));
  assert.notEqual(rt.getDocumentMutationIdentity(),stamp,'mutation was accepted before listener delivery');
  if(kind==='add'||kind==='insert')assert.ok(rt.getBlock('new'));
  if(kind==='remove')assert.equal(rt.getBlock('a'),null);
  if(kind==='move')assert.equal(rt.getBlocks()[3].id,'a');
  assert.equal(next,legacy?0:1,'legacy still propagates, semantic-only still isolates');
  unsubscribe();rt.setBlockSource('b','b:=8');
});

for(const kind of Object.keys(structuralEdits))
test(`F2 ${kind} notification cannot consume/apply a prepared transaction`,async()=>{
  const rt=await structuralFixture();let error;
  const pending=rt.prepareDocumentTransaction([{kind:'source',blockId:'b',source:'b:=999'}]);
  rt.subscribeSemanticChanges(()=>{try{rt.applyDocumentTransaction(pending);}catch(e){error=e.message;}});
  structuralEdits[kind](rt);
  assert.equal(error,'S96A_REENTRANT_MUTATION');assert.equal(rt.getBlock('b').source,'b:=f(3)');
  assert.throws(()=>rt.applyDocumentTransaction(pending),/S95N_STALE_PLAN/,
    'reentrant rejection must not consume plan; later committed structure makes it stale');
});
