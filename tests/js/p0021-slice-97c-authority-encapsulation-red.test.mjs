/** S97c approved read-only boundary: permanent RED -> GREEN regressions. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {createDocumentHistorySession} from '../../src/js/editing/create-document-history-session.js';
function setup() {
  const runtime=DocumentRuntime.createSemantic('s97c');
  const returned=runtime.addBlock({id:'a',type:'formula',taskId:'T',source:'a:=2'});
  runtime.addBlock({id:'b',type:'formula',taskId:'T',source:'a+1'});
  return {runtime,returned};
}
function blocked(write,read,expected) {
  try { write(); } catch(error) { assert.ok(error instanceof TypeError); }
  assert.deepEqual(read(),expected);
}
test('S97c RED blocks array cannot remove authoritative blocks',()=>{
  const {runtime}=setup();blocked(()=>runtime.blocks.pop(),()=>runtime.getBlocks().map(b=>b.id),['a','b']);
});
test('S97c RED blocks property cannot replace authoritative storage',()=>{
  const {runtime}=setup();blocked(()=>{runtime.blocks=[];},()=>runtime.getBlocks().map(b=>b.id),['a','b']);
});
test('S97c RED getBlock source cannot bypass mutation identity',()=>{
  const {runtime}=setup();blocked(()=>{runtime.getBlock('a').source='a:=9';},()=>runtime.getBlock('a').source,'a:=2');
});
test('S97c RED nested calculation object cannot forge published status',()=>{
  const {runtime}=setup();blocked(()=>{runtime.getBlock('a').calculation.status='success';},()=>runtime.getBlock('a').calculation.status,'idle');
});
test('S97c RED getBlocks shallow snapshot cannot mutate nested calculation generation',()=>{
  const {runtime}=setup();blocked(()=>{runtime.getBlocks()[0].calculation.generation=99;},()=>runtime.getBlock('a').calculation.generation,0);
});
test('S97c RED nested dependency array cannot be mutated by consumers',()=>{
  const {runtime}=setup(),before=[...runtime.getBlock('b').dependencies.reads];
  blocked(()=>runtime.getBlock('b').dependencies.reads.push('forged'),()=>runtime.getBlock('b').dependencies.reads,before);
});
test('S97c RED addBlock return cannot bypass authority',()=>{
  const {runtime,returned}=setup();blocked(()=>{returned.source='a:=9';},()=>runtime.getBlock('a').source,'a:=2');
});
test('S97c RED text input nested array must not remain authoritative caller alias',()=>{
  const {runtime}=setup(),metadata={tags:['original']};
  runtime.addBlock({id:'text',type:'text',source:'text',metadata});
  metadata.tags.push('external');assert.deepEqual(runtime.getBlock('text').metadata.tags,['original']);
});
test('S97c control top-level getBlocks copy already isolates source assignment',()=>{
  const {runtime}=setup();blocked(()=>{runtime.getBlocks()[0].source='different';},()=>runtime.getBlock('a').source,'a:=2');assert.equal(runtime.getBlock('a').source,'a:=2');
});
test('S97c control stable block identity survives move and direct source mutation',()=>{
  const {runtime}=setup(),block=runtime.getBlock('a');
  runtime.moveBlock('a',1);assert.equal(runtime.getBlock('a'),block);
  runtime.setBlockSource('a','a:=3');assert.equal(runtime.getBlock('a'),block);assert.equal(block.source,'a:=3');
});
test('S97c control Undo delete preserves ID but creates fresh incarnation',()=>{
  const {runtime}=setup(),block=runtime.getBlock('a'),identity=runtime.getBlockSourceIdentity('a');let epoch=0;
  const history=createDocumentHistorySession({runtime,getCurrentRevision:()=>String(epoch),advanceRevision:()=>{epoch++;}});
  history.execute([{kind:'remove',blockId:'a'}]);history.undo();
  assert.equal(runtime.getBlock('a').source,'a:=2');assert.notEqual(runtime.getBlock('a'),block);
  assert.notEqual(runtime.getBlockSourceIdentity('a'),identity);
});
test('S97c control supported source ABA changes mutation stamp',()=>{
  const {runtime}=setup(),stamp=runtime.getDocumentMutationIdentity();
  runtime.setBlockSource('a','a:=3');runtime.setBlockSource('a','a:=2');
  assert.notEqual(runtime.getDocumentMutationIdentity(),stamp);
});

// Approved S97c boundary extensions, before implementation.
import {expression} from '../../src/js/values/value.js';
const value=()=>expression({op:'integer',value:'7'});
async function publish(runtime,evaluate=async task=>({blockId:task.blockId,status:'success',value:value()})) {
  return runtime.evaluateAndCommitSemanticTask('T',{revision:'r',getCurrentRevision:()=> 'r',evaluate});
}
test('S97c snapshot order is detached while block views are shared and live',async()=>{
  const {runtime}=setup(),snapshot=runtime.getBlocks(),view=runtime.getBlock('a');
  assert.equal(snapshot[0],view);runtime.moveBlock('a',1);
  assert.deepEqual(snapshot.map(b=>b.id),['a','b']);await publish(runtime);
  assert.equal(view.calculation.status,'success');assert.equal(runtime.getBlock('a'),view);
});
test('S97c history source commit preserves block incarnation view, rotates source identity',()=>{
  const {runtime}=setup(),view=runtime.getBlock('a'),source=runtime.getBlockSourceIdentity('a');let epoch=0;
  const h=createDocumentHistorySession({runtime,getCurrentRevision:()=>String(epoch),advanceRevision:()=>epoch++});
  h.execute([{kind:'source',blockId:'a',source:'a:=4'}]);
  assert.equal(runtime.getBlock('a'),view);assert.equal(view.source,'a:=4');
  assert.notEqual(runtime.getBlockSourceIdentity('a'),source);h.undo();assert.equal(runtime.getBlock('a'),view);
});
test('S97c immutable Value identity and prototype survive publication unchanged',async()=>{
  const {runtime}=setup(),v=value();const outcome=await publish(runtime,async t=>({blockId:t.blockId,status:'success',value:v}));
  assert.equal(runtime.getBlock('a').calculation.result,outcome.state.outcomes[0].value);
  assert.equal(Object.getPrototypeOf(runtime.getBlock('a').calculation.result),Object.getPrototypeOf(v));
  assert.throws(()=>{runtime.getBlock('a').calculation.result.data.expr.value='999';},TypeError);
});
test('S97c nested diagnostic parameters cannot be changed via block view',async()=>{
  const {runtime}=setup();await publish(runtime,async t=>({blockId:t.blockId,status:'failure',code:'TEST',message:'failure'}));
  const e=runtime.getBlock('a').calculation.error;assert.throws(()=>{e.code='FORGED';},TypeError);
});
test('S97c caller nested array input is isolated and retained Values are identical',()=>{
  const {runtime}=setup(),v=value(),input={id:'txt',type:'text',source:'hello',metadata:{list:[{x:1}],value:v}};
  runtime.addBlock(input);input.metadata.list[0].x=2;
  assert.equal(runtime.getBlock('txt').metadata.list[0].x,1);assert.equal(runtime.getBlock('txt').metadata.value,v);
  assert.throws(()=>runtime.getBlock('txt').metadata.list.push({x:9}),TypeError);
});
for(const mode of ['accessor','function','cycle','date']) test(`S97c rejects unsupported input ${mode} before mutation`,()=>{
  const {runtime}=setup(),stamp=runtime.getDocumentMutationIdentity();let metadata;
  if(mode==='accessor') metadata=Object.defineProperty({},'x',{get(){throw Error('getter executed');},enumerable:true});
  if(mode==='function') metadata={f(){}};
  if(mode==='cycle'){metadata={};metadata.self=metadata;}
  if(mode==='date')metadata=new Date();
  assert.throws(()=>runtime.addBlock({id:'bad',type:'text',source:'x',metadata}),/S97C_INPUT_INVALID/);
  assert.equal(runtime.getDocumentMutationIdentity(),stamp);assert.equal(runtime.getBlock('bad'),null);
});
for(const mode of ['define','delete','prototype','freeze','descriptor'])test(`S97c blocks reflection escape ${mode}`,()=>{
  const {runtime}=setup(),view=runtime.getBlock('a');
  const writes={define:()=>Object.defineProperty(view,'source',{value:'forged'}),delete:()=>delete view.source,
    prototype:()=>Object.setPrototypeOf(view,{}),freeze:()=>Object.freeze(view),
    descriptor:()=>{Object.getOwnPropertyDescriptor(view,'calculation').value.status='forged';}};
  assert.throws(writes[mode],TypeError);assert.equal(view.source,'a:=2');assert.equal(view.calculation.status,'idle');
});
test('S97c graph and dependency map/set mutation paths are blocked',()=>{
  const {runtime}=setup(),g=runtime.getDependencyGraph('T');
  assert.equal(g.hasEdge('a','b'),true);
  for(const write of [()=>g.addEdge('b','a'),()=>g.nodes.clear(),()=>g.outgoing.set('x',new Set()),
    ()=>g.outgoing.get('a').clear(),()=>runtime.dependencyAnalysis.clear(),
    ()=>runtime.dependencyAnalysis.forEach(entry=>entry.bindings.clear())])assert.throws(write,TypeError);
  assert.equal(g.hasEdge('a','b'),true);assert.equal(g.hasEdge('b','a'),false);
});
test('S97c full rollback preserves view, source, token and live results',async()=>{
  const {runtime}=setup();await publish(runtime);const view=runtime.getBlock('a'),stamp=runtime.getDocumentMutationIdentity();
  const original=runtime.rebuildDependencyAnalysis;runtime.rebuildDependencyAnalysis=()=>{throw Error('injected');};
  assert.throws(()=>runtime.applyDocumentTransaction(runtime.prepareDocumentTransaction([{kind:'source',blockId:'a',source:'a:=9'}])),/injected/);
  runtime.rebuildDependencyAnalysis=original;assert.equal(runtime.getBlock('a'),view);assert.equal(view.source,'a:=2');
  assert.equal(view.calculation.status,'success');assert.equal(runtime.getDocumentMutationIdentity(),stamp);
});
test('S97c async publication updates held live view; source ABA still rejects stale result',async()=>{
  const {runtime}=setup(),view=runtime.getBlock('a');let release,started;
  const ready=new Promise(r=>started=r),pending=publish(runtime,async t=>{started();await new Promise(r=>release=r);return {blockId:t.blockId,status:'success',value:value()};});
  await ready;assert.throws(()=>{view.source='forged';},TypeError);
  runtime.setBlockSource('a','a:=3');runtime.setBlockSource('a','a:=2');release();
  assert.equal((await pending).kind,'stale');await publish(runtime);assert.equal(view.calculation.status,'success');
});

test('S97c frozen caller accessor is rejected without invoking getter',()=>{
 const {runtime}=setup();let reads=0;
 const metadata=Object.freeze(Object.defineProperty({},'valueVersion',{get(){reads++;return 1;},enumerable:true}));
 assert.throws(()=>runtime.addBlock({id:'bad',type:'text',metadata}),/S97C_INPUT_INVALID/);assert.equal(reads,0);
});
test('S97c prepare and net-zero source transaction preserve live view chronology',()=>{
 const {runtime}=setup(),view=runtime.getBlock('a'),stamp=runtime.getDocumentMutationIdentity();
 const plan=runtime.prepareDocumentTransaction([{kind:'source',blockId:'a',source:'a:=3'},{kind:'source',blockId:'a',source:'a:=2'}]);
 assert.equal(runtime.getBlock('a'),view);assert.equal(view.source,'a:=2');assert.equal(runtime.getDocumentMutationIdentity(),stamp);
 runtime.applyDocumentTransaction(plan);assert.equal(runtime.getBlock('a'),view);assert.equal(view.source,'a:=2');
 assert.notEqual(runtime.getDocumentMutationIdentity(),stamp);
});
test('S97c direct delete/recreate gives fresh view; retained old view never follows ID reuse',()=>{
 const {runtime}=setup(),view=runtime.getBlock('a');runtime.removeBlock('a');
 runtime.insertBlock({id:'a',type:'formula',taskId:'T',source:'a:=9'},0);
 assert.notEqual(runtime.getBlock('a'),view);assert.equal(view.source,'a:=2');assert.equal(runtime.getBlock('a').source,'a:=9');
});
test('S97c Map/Set iterator, callback and descriptor paths expose no owned mutable values',()=>{
 const {runtime}=setup(),graph=runtime.getDependencyGraph('T');
 for(const [id,children] of graph.outgoing)assert.throws(()=>children.add('forged'),TypeError);
 graph.outgoing.forEach((children,id,owner)=>{assert.equal(owner,graph.outgoing);assert.throws(()=>children.clear(),TypeError);});
 const entry=graph.outgoing.entries().next().value;assert.throws(()=>entry[1].add('x'),TypeError);
 assert.throws(()=>Object.getOwnPropertyDescriptor(graph,'nodes').value.clear(),TypeError);
 assert.throws(()=>Map.prototype.clear.call(graph.outgoing),TypeError);
 assert.throws(()=>{runtime.dependencyAnalysis=new Map();},TypeError);
 assert.throws(()=>runtime.semanticChangeListeners.clear(),TypeError);
});

for(const property of ['blocks','dependencyAnalysis','semanticChangeListeners'])test(`S97c storage reader ${property} cannot be shadowed through reflection`,()=>{
 const {runtime}=setup();assert.throws(()=>Object.defineProperty(runtime,property,{value:[]}),TypeError);
 assert.equal(runtime.getBlock('a').source,'a:=2');
});
test('S97c invalid formula task input is rejected before authoritative mutation',()=>{
 const {runtime}=setup(),stamp=runtime.getDocumentMutationIdentity();
 assert.throws(()=>runtime.addBlock({id:'bad',type:'formula',taskId:{alias:true},source:'2'}),/S97C_INPUT_INVALID/);
 assert.equal(runtime.getBlock('bad'),null);assert.equal(runtime.getDocumentMutationIdentity(),stamp);
});

import {diagnostic,isDiagnostic} from '../../src/js/diagnostics/diagnostic.js';
import {list} from '../../src/js/values/value.js';
test('S97c structured diagnostic retains contract while nested arrays reject writes',async()=>{
 const {runtime}=setup(),d=diagnostic('TEST',{nested:{items:[1,2]}});
 const outcome=await publish(runtime,async t=>({blockId:t.blockId,status:'failure',code:'TEST',message:'TEST',diagnostic:d}));
 const stored=runtime.getBlock('a').calculation.error.diagnostic;
 assert.ok(isDiagnostic(stored));assert.equal(stored,outcome.state.outcomes[0].diagnostic);
 assert.throws(()=>stored.parameters.nested.items.push(3),TypeError);
});
test('S97c container Value input and published result retain nested immutable contracts',async()=>{
 const {runtime}=setup(),v=list([value()]);runtime.addBlock({id:'txt',type:'text',metadata:{value:v}});
 assert.equal(runtime.getBlock('txt').metadata.value,v);
 const outcome=await publish(runtime,async t=>({blockId:t.blockId,status:'success',value:v}));
 const stored=runtime.getBlock('a').calculation.result;assert.equal(stored,outcome.state.outcomes[0].value);
 assert.equal(Object.getPrototypeOf(stored),Object.getPrototypeOf(v));
 assert.throws(()=>stored.data.items.push(value()),TypeError);
});
test('S97c legacy returned evaluator object cannot alias runtime calculation storage',async()=>{
 const result={nested:{items:[1]}};
 const runtime=new DocumentRuntime({calculate:async()=>result},'legacy-input');
 runtime.addBlock({id:'a',type:'formula',source:'2'});await runtime.calculateBlock('a');
 result.nested.items.push(2);assert.deepEqual(runtime.getBlock('a').calculation.result.nested.items,[1]);
});
test('S97c rejects hidden caller fields rather than silently losing source on spread',()=>{
 const {runtime}=setup(),input={id:'hidden',type:'formula',taskId:'T'};
 Object.defineProperty(input,'source',{value:'99',enumerable:false});
 assert.throws(()=>runtime.addBlock(input),/S97C_INPUT_INVALID/);assert.equal(runtime.getBlock('hidden'),null);
});
