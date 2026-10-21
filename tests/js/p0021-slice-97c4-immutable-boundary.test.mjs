/** S97c.4 R1: immutable envelope predicates do not attest arbitrary extra references. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {diagnostic,isDiagnostic} from '../../src/js/diagnostics/diagnostic.js';
import {expression,list,isValue} from '../../src/js/values/value.js';
import {createDocumentHistorySession} from '../../src/js/editing/create-document-history-session.js';
import {createRuntimeReadonlyViews} from '../../src/js/runtime-readonly-view.js';
const integer=()=>expression({op:'integer',value:'7'});
function fixture() {
 const runtime=DocumentRuntime.createSemantic('s97c4');
 runtime.addBlock({id:'a',type:'formula',taskId:'T',source:'2'});
 let epoch=0;const history=createDocumentHistorySession({runtime,getCurrentRevision:()=>String(epoch),advanceRevision:()=>epoch++});
 history.execute([{kind:'source',blockId:'a',source:'3'}]);history.undo();
 return {runtime,history,get epoch(){return epoch;}};
}
function rejectAtomically(extra,envelope='diagnostic') {
 const s=fixture(),stamp=s.runtime.getDocumentMutationIdentity(),source=s.runtime.getBlockSourceIdentity('a');
 const revision=s.epoch,cursor=s.history.snapshot(),before=s.runtime.getBlocks();
 const supplied=envelope==='diagnostic'?Object.freeze({...diagnostic('REVIEW'),extra}):
  Object.freeze({...integer(),extra});
 if(envelope==='diagnostic')assert.ok(isDiagnostic(supplied));
 assert.throws(()=>s.runtime.addBlock({id:'bad',type:'text',source:'text',metadata:{supplied}}),/S97C_INPUT_INVALID/);
 assert.equal(s.runtime.getBlock('bad'),null);assert.deepEqual(s.runtime.getBlocks(),before);
 assert.equal(s.runtime.getDocumentMutationIdentity(),stamp);assert.equal(s.runtime.getBlockSourceIdentity('a'),source);
 assert.equal(s.epoch,revision);assert.deepEqual(s.history.snapshot(),cursor);assert.equal(cursor.canRedo,true);
 s.history.redo();assert.equal(s.runtime.getBlock('a').source,'3');
}
// Four original failed staged-review admission probes, plus the write-through probe below.
const unsupported=[
 ['Map',()=>Object.freeze(new Map([['tag','original']]))],
 ['Set',()=>Object.freeze(new Set(['original']))],
 ['Date',()=>Object.freeze(new Date(0))],
 ['function',()=>Object.assign(()=>null,{mutable:'original'})],
 ['frozen-function',()=>Object.freeze(Object.assign(()=>null,{nested:{mutable:'original'}}))],
 ['WeakMap',()=>Object.freeze(new WeakMap())],
 ['WeakSet',()=>Object.freeze(new WeakSet())],
 ['ArrayBuffer',()=>Object.freeze(new ArrayBuffer(8))],
 ['DataView',()=>Object.freeze(new DataView(new ArrayBuffer(8)))],
];
for(const [name,create] of unsupported) {
 test(`R1 Diagnostic-like ${name} admission rejects atomically`,()=>rejectAtomically(create()));
 test(`R1 Value-like ${name} admission rejects atomically`,()=>rejectAtomically(create(),'value'));
}
test('R1 original public Diagnostic/Map write-through is prevented at admission',()=>{
 const {runtime}=fixture(),map=Object.freeze(new Map([['tag','original']]));
 const supplied=Object.freeze({...diagnostic('REVIEW'),extra:map});
 assert.throws(()=>{
  runtime.addBlock({id:'bad',type:'text',source:'text',metadata:{supplied}});
  runtime.getBlock('bad').metadata.supplied.extra.set('tag','write-through');
 },TypeError);
 assert.equal(runtime.getBlock('bad'),null);assert.equal(map.get('tag'),'original');
});
test('R1 read-only pass-through also rejects a mutable Map behind frozen Diagnostic',()=>{
 const map=Object.freeze(new Map([['tag','original']]));
 const supplied=Object.freeze({...diagnostic('REVIEW'),extra:map});
 const view=createRuntimeReadonlyViews()(supplied);
 assert.throws(()=>view.extra.set('tag','forged'),TypeError);assert.equal(map.get('tag'),'original');
});
test('R1 frozen cyclic Diagnostic envelope is rejected without losing redo',()=>{
 const cyclic={};cyclic.self=cyclic;Object.freeze(cyclic);rejectAtomically(cyclic);
});
test('R1 frozen cyclic Value-like envelope is rejected',()=>{
 const cyclic={};cyclic.self=cyclic;Object.freeze(cyclic);rejectAtomically(cyclic,'value');
});
test('R1 accessors nested in frozen Diagnostic are rejected without execution',()=>{
 let reads=0;const extra=Object.freeze(Object.defineProperty({},'x',{get(){reads++;return 1;},enumerable:true}));
 rejectAtomically(extra);assert.equal(reads,0);
});
for(const mode of ['hidden','symbol','custom-array-prototype'])test(`R1 unsupported frozen Diagnostic ${mode} data is rejected`,()=>{
 let extra={};
 if(mode==='hidden')Object.defineProperty(extra,'x',{value:()=>null});
 if(mode==='symbol')extra[Symbol('mutable')]=()=>null;
 if(mode==='custom-array-prototype'){extra=[];Object.setPrototypeOf(extra,{mutable:{x:1}});}
 Object.freeze(extra);rejectAtomically(extra);
});
test('R1 genuine immutable Values and Diagnostics retain identity, prototype and validation',()=>{
 const {runtime}=fixture(),v=list([integer()]),d=diagnostic('REVIEW',{nested:{items:[1,2]}});
 runtime.addBlock({id:'good',type:'text',source:'text',metadata:{v,d}});
 const stored=runtime.getBlock('good').metadata;
 for(const key of ['v','d']){
  const original=key==='v'?v:d;assert.equal(stored[key],original);assert.equal(Object.getPrototypeOf(stored[key]),Object.getPrototypeOf(original));
 }
 assert.ok(isValue(stored.v));assert.ok(isDiagnostic(stored.d));
 assert.throws(()=>stored.d.parameters.nested.items.push(3),TypeError);
});
test('R1 shared acyclic frozen data does not falsely count as a cycle',()=>{
 const {runtime}=fixture(),shared=Object.freeze({x:1});
 const supplied=Object.freeze({...diagnostic('REVIEW'),extra:Object.freeze({a:shared,b:shared})});
 runtime.addBlock({id:'good',type:'text',metadata:{supplied}});
 assert.equal(runtime.getBlock('good').metadata.supplied,supplied);
});

for(const method of ['prepareBlock','insertBlock'])test(`R1 ${method} shares atomic input rejection`,()=>{
 const s=fixture(),stamp=s.runtime.getDocumentMutationIdentity(),epoch=s.epoch,history=s.history.snapshot();
 const input={id:'bad',type:'text',metadata:{supplied:Object.freeze({...diagnostic('REVIEW'),extra:Object.freeze(new Map())})}};
 assert.throws(()=>s.runtime[method](input,0),/S97C_INPUT_INVALID/);
 assert.equal(s.runtime.getBlock('bad'),null);assert.equal(s.runtime.getDocumentMutationIdentity(),stamp);
 assert.equal(s.epoch,epoch);assert.deepEqual(s.history.snapshot(),history);
});
