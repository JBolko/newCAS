/** P0021 S95d: semantic-only DocumentRuntime is explicit, without an engine-shaped sentinel. */
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
import {traceStaticGraph} from '../../tools/analyze/p0021-s95a-legacy-route-audit.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const create=()=>DocumentRuntime.createSemantic('s95d-document');
const row=(rt,id,source,taskId='pilot')=>rt.addBlock({id,type:'formula',taskId,source});
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({operationId:id,evaluatorId:`probe.scalar.${id}`,
  arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
const integer=n=>expression({op:'integer',value:String(n)});
const backend=async (_,selected)=>{
  const inputs=selected.evaluationRequest.inputs.map(v=>BigInt(v.data.expr.value));
  const op=selected.evaluationRequest.evaluatorId;
  const result=op.endsWith('.power')?inputs[0]**inputs[1]:op.endsWith('.multiply')?inputs[0]*inputs[1]:inputs[0]+inputs[1];
  return {blockId:selected.blockId,status:'success',value:integer(result)};
};
const run=async(rt,revision)=>{
  const {snapshot}=rt.deriveSemanticTask('pilot');
  const evaluate=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:backend,revision});
  return rt.evaluateAndCommitSemanticTask('pilot',{revision,getCurrentRevision:()=>revision,evaluate});
};

test('S95d explicit factory creates document without a legacy engine',()=>{
  const rt=create();
  assert.equal(rt.documentId,'s95d-document');
  assert.equal(rt.engine,null);
  assert.equal(rt.getBlocks().length,0);
  assert.throws(()=>{rt.engine={calculate(){return 'unsafe'}};},TypeError);
});
test('S95d old two-argument constructor still rejects missing engine',()=>{
  assert.throws(()=>new DocumentRuntime(null,'document'),/CASEngine/);
  assert.throws(()=>new DocumentRuntime(undefined,'document'),/CASEngine/);
});
test('S95d semantic factory validates document identity',()=>{
  assert.throws(()=>DocumentRuntime.createSemantic(''),/documentId/);
  assert.throws(()=>DocumentRuntime.createSemantic(17),/documentId/);
});
test('S95d hidden construction token cannot be forged with caller options',()=>{
  assert.throws(()=>new DocumentRuntime(null,'doc',{semanticOnly:true}),/construction|CASEngine/);
});
test('S95d source and structural mutations remain document-owned',()=>{
  const rt=create();row(rt,'a','a:=2');row(rt,'result','a+1');
  const before=rt.getBlock('a').calculation.generation;
  rt.setBlockSource('a','a:=5');
  assert.equal(rt.getBlock('a').source,'a:=5');
  assert.equal(rt.getBlock('a').calculation.generation,before+1);
  assert.equal(rt.getBlocks().length,2);
});
test('S95d semantic-only legacy calculate is fail-closed',async()=>{
  const rt=create();
  await assert.rejects(rt.calculate([{type:'Number',value:1}]),/LEGACY_ENGINE_UNAVAILABLE/);
});
test('S95d semantic-only legacy getTaskState and resetTask are fail-closed',async()=>{
  const rt=create();
  await assert.rejects(rt.getTaskState(),/LEGACY_ENGINE_UNAVAILABLE/);
  await assert.rejects(rt.resetTask(),/LEGACY_ENGINE_UNAVAILABLE/);
});
test('S95d calculateBlock rejects BEFORE changing source or calculation slot',async()=>{
  const rt=create();row(rt,'a','a:=2');
  const state=structuredClone(rt.getBlock('a').calculation);
  await assert.rejects(rt.calculateBlock('a'),/LEGACY_ENGINE_UNAVAILABLE/);
  assert.deepEqual(rt.getBlock('a').calculation,state);
  assert.equal(rt.getBlock('a').source,'a:=2');
});
test('S95d recalculateFrom and recalculateDirty reject BEFORE mutating',async()=>{
  const rt=create();row(rt,'a','a:=2');
  const before=structuredClone(rt.getBlock('a').calculation);
  await assert.rejects(rt.recalculateFrom('a'),/LEGACY_ENGINE_UNAVAILABLE/);
  await assert.rejects(rt.recalculateDirty('pilot'),/LEGACY_ENGINE_UNAVAILABLE/);
  assert.deepEqual(rt.getBlock('a').calculation,before);
});
test('S95d semantic-only document supports attested selected function IR end-to-end in Node',async()=>{
  const rt=create();row(rt,'a','a:=2');row(rt,'f','f(t):=t^2+a');row(rt,'out','f(3)');
  assert.equal((await run(rt,'r1')).kind,'complete');
  assert.equal(rt.getBlock('out').calculation.result.data.expr.value,'11');
  rt.setBlockSource('a','a:=5');
  assert.equal((await run(rt,'r2')).kind,'complete');
  assert.equal(rt.getBlock('out').calculation.result.data.expr.value,'14');
});
test('S95d semantic-only document protects outcomes across stale revisions',async()=>{
  const rt=create();row(rt,'a','a:=2');
  let release;
  const pending=new Promise(resolve=>release=resolve);
  const current=()=> 'r1';
  const running=rt.evaluateAndCommitSemanticTask('pilot',{revision:'r1',getCurrentRevision:current,
    evaluate:async task=>{await pending;return {blockId:task.blockId,status:'success',value:integer(2)}}});
  await Promise.resolve();rt.setBlockSource('a','a:=5');release();
  assert.equal((await running).kind,'stale');
  assert.equal(rt.getBlock('a').calculation.result,null);
});
test('S95d browser pilot uses engine-free constructor and only the selected Worker path',()=>{
  const file='tests/browser/p0021-slice-95b-selected-ui-pilot.mjs';
  const js=read(file);
  assert.match(js,/DocumentRuntime\.createSemantic\('s95b-pilot'\)/);
  assert.doesNotMatch(js,/LEGACY_CALLED|legacy-shaped constructor argument|new DocumentRuntime\(/);
  const graph=traceStaticGraph(ROOT,file);
  assert.deepEqual(graph.unresolved,[]);
  for(const legacy of ['src/js/cas-engine.js','src/js/transformer.js'])
    assert.equal(graph.modules.includes(legacy),false);
  assert.match(js,/selected-pyodide-worker\.js/);
});
