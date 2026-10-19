/** P0021 S95e — UI action delegates to existing document and evaluation layers. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {expression} from '../../src/js/values/value.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {createSemanticCalculateAction} from '../../src/js/ui/create-semantic-calculate-action.js';
import {traceStaticGraph} from '../../tools/analyze/p0021-s95a-legacy-route-audit.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const make=()=>{
  const runtime=DocumentRuntime.createSemantic('s95e');
  runtime.addBlock({id:'a',type:'formula',taskId:'pilot',source:'a:=2'});
  runtime.addBlock({id:'f',type:'formula',taskId:'pilot',source:'f(t):=t^2+a'});
  runtime.addBlock({id:'out',type:'formula',taskId:'pilot',source:'f(3)'});
  runtime.addBlock({id:'other',type:'formula',taskId:'second',source:'b:=4'});
  runtime.addBlock({id:'note',type:'text',source:'note'});
  let rev='v0';let revChanges=0;let runs=0;
  let run=async()=>({kind:'complete'});
  const session={run:()=>{runs++;return run();}};
  const advanceRevision=()=>{rev=`v${++revChanges}`;};
  const action=createSemanticCalculateAction({runtime,session,taskId:'pilot',getCurrentRevision:()=>rev,advanceRevision});
  return {runtime,session,action,setRun:f=>run=f,get revision(){return rev;},get revisions(){return revChanges;},get runs(){return runs;}};
};
const rows=(a='a:=2', f='f(t):=t^2+a', out='f(3)')=>[
  {blockId:'a',source:a},{blockId:'f',source:f},{blockId:'out',source:out}];

// Constructor/boundary tests

test('S95e requires an existing document, session, and revision authority',()=>{
  assert.throws(()=>createSemanticCalculateAction(),/S95E_ACTION_CONTRACT/);
  assert.throws(()=>createSemanticCalculateAction({runtime:{},session:{}}),/S95E_ACTION_CONTRACT/);
});
test('S95e unchanged drafts do not bump document revisions, still invoke selected task',async()=>{
  const s=make();
  assert.deepEqual(await s.action.calculate(rows()),{kind:'complete'});
  assert.equal(s.revisions,0);assert.equal(s.runs,1);
  assert.equal(s.runtime.getBlock('a').calculation.generation,0);
});
test('S95e changed source commits on Calculate, before session, with one revision advance',async()=>{
  const s=make();
  s.setRun(async()=>{assert.equal(s.runtime.getBlock('a').source,'a:=5');assert.equal(s.revision,'v1');return {kind:'complete'};});
  assert.equal((await s.action.calculate(rows('a:=5'))).kind,'complete');
  assert.equal(s.revisions,1);assert.equal(s.runtime.getBlock('a').source,'a:=5');
  assert.equal(s.runtime.getBlock('a').calculation.generation,1);
});
test('S95e multiple draft changes advance revision once, preserve statement order',async()=>{
  const s=make();
  await s.action.calculate(rows('a:=5','f(t):=t^2+2*a','f(4)'));
  assert.equal(s.revisions,1);assert.equal(s.runtime.getBlock('a').source,'a:=5');
  assert.equal(s.runtime.getBlock('f').source,'f(t):=t^2+2*a');
  assert.equal(s.runtime.getBlock('out').source,'f(4)');
});
test('S95e invalid tail is rejected before any early draft is committed',async()=>{
  const s=make();
  await assert.rejects(s.action.calculate([{blockId:'a',source:'a:=5'},{blockId:'absent',source:'z:=1'}]),/S95E_BLOCK_NOT_IN_TASK/);
  assert.equal(s.runtime.getBlock('a').source,'a:=2');assert.equal(s.revisions,0);assert.equal(s.runs,0);
});
test('S95e foreign task and text block cannot be modified through formula action',async()=>{
  const s=make();
  for(const blockId of ['other','note']) {
    await assert.rejects(s.action.calculate([{blockId:'a',source:'a:=5'},{blockId,source:'x:=1'}]),/S95E_BLOCK_NOT_IN_TASK/);
  }
  assert.equal(s.runtime.getBlock('a').source,'a:=2');assert.equal(s.revisions,0);
});
test('S95e rejects duplicates, malformed sources and empty draft sets without mutation',async()=>{
  const s=make();
  for(const proposed of [[],null,[{blockId:'a',source:'a:=5'},{blockId:'a',source:'a:=6'}],
    [{blockId:'a',source:null}], [{blockId:'a',source:17}], [{blockId:'',source:'a:=5'}]]) {
    await assert.rejects(s.action.calculate(proposed),/S95E_DRAFTS_INVALID/);
  }
  assert.equal(s.runtime.getBlock('a').source,'a:=2');assert.equal(s.revisions,0);assert.equal(s.runs,0);
});
test('S95e incomplete mathematical source is kept exactly as typed, without parsing or fallback',async()=>{
  const s=make();
  await s.action.calculate([{blockId:'a',source:'f('}]);
  assert.equal(s.runtime.getBlock('a').source,'f(');
  assert.equal(s.revisions,1);
});
test('S95e refuses an unchanged revision BEFORE mutating authoritative sources',async()=>{
  const s=make();
  const action=createSemanticCalculateAction({runtime:s.runtime,session:s.session,taskId:'pilot',
    getCurrentRevision:()=>s.revision,advanceRevision:()=>undefined});
  await assert.rejects(action.calculate(rows('a:=9')),/S95E_REVISION_UNCHANGED/);
  assert.equal(s.runtime.getBlock('a').source,'a:=2');assert.equal(s.runs,0);
});
test('S95e concurrent UI Calculate does not mutate while first run is in flight',async()=>{
  const s=make();let release;
  const pending=new Promise(resolve=>release=resolve);
  s.setRun(()=>pending);
  const first=s.action.calculate(rows('a:=5'));
  await assert.rejects(s.action.calculate(rows('a:=6')),/S95E_ACTION_ALREADY_RUNNING/);
  assert.equal(s.runtime.getBlock('a').source,'a:=5');assert.equal(s.revisions,1);assert.equal(s.runs,1);
  release({kind:'complete'});await first;
  await s.action.calculate(rows('a:=6'));
  assert.equal(s.runtime.getBlock('a').source,'a:=6');assert.equal(s.revisions,2);
});
test('S95e session failure propagates and does not trigger a hidden Worker restart or retry',async()=>{
  const s=make();
  const err=Object.assign(new Error('worker unavailable'),{diagnostic:{code:'WORKER_TIMEOUT'}});
  s.setRun(async()=>{throw err;});
  await assert.rejects(s.action.calculate(rows('a:=7')),actual=>actual===err);
  assert.equal(s.runs,1);assert.equal(s.runtime.getBlock('a').source,'a:=7');
  await assert.rejects(s.action.calculate(rows('a:=7')),actual=>actual===err);
  assert.equal(s.runs,2);assert.equal(s.revisions,1);
});
test('S95e action changes no calculation slots itself',async()=>{
  const s=make();let before=structuredClone(s.runtime.getBlock('out').calculation);
  await s.action.calculate(rows());
  assert.deepEqual(s.runtime.getBlock('out').calculation,before);
});
test('S95e existing selected IR evaluator calculates 11 then 14 through semantic-only document',async()=>{
  const s=make();
  const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({
    operationId:id,evaluatorId:`probe.scalar.${id}`,
    arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
  const backend=async (_,selected)=>{
    const [a,b]=selected.evaluationRequest.inputs.map(v=>BigInt(v.data.expr.value));
    const id=selected.evaluationRequest.evaluatorId;
    const value=id.endsWith('.power')?a**b:id.endsWith('.multiply')?a*b:a+b;
    return {blockId:selected.blockId,status:'success',value:expression({op:'integer',value:String(value)})};
  };
  let revision='v0';
  const session={run:()=>{
    const {snapshot}=s.runtime.deriveSemanticTask('pilot');
    const evaluate=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:backend,revision});
    return s.runtime.evaluateAndCommitSemanticTask('pilot',{
      revision,getCurrentRevision:()=>revision,evaluate});
  }};
  const action=createSemanticCalculateAction({runtime:s.runtime,session,taskId:'pilot',
    getCurrentRevision:()=>revision,advanceRevision:()=>{revision+='+';}});
  assert.equal((await action.calculate(rows())).kind,'complete');
  assert.equal(s.runtime.getBlock('out').calculation.result.data.expr.value,'11');
  assert.equal((await action.calculate(rows('a:=5'))).kind,'complete');
  assert.equal(s.runtime.getBlock('out').calculation.result.data.expr.value,'14');
});
test('S95e pilot static import remains isolated from legacy engine and main.js remains unchanged',()=>{
  const graph=traceStaticGraph(ROOT,'tests/browser/p0021-slice-95b-selected-ui-pilot.mjs');
  assert.deepEqual(graph.unresolved,[]);
  assert.ok(graph.modules.includes('src/js/ui/create-semantic-calculate-action.js'));
  for(const bad of ['src/js/cas-engine.js','src/js/transformer.js'])
    assert.equal(graph.modules.includes(bad),false);
  const main=fs.readFileSync(path.join(ROOT,'src/js/main.js'),'utf8');
  assert.match(main,/import\s*\{\s*CASEngine\s*\}/);
  assert.doesNotMatch(main,/createSemanticCalculateAction/);
});
