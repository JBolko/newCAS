import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {createFormulaEditingSession} from '../../src/js/editing/create-formula-editing-session.js';
import {createFormulaStructuralAction} from '../../src/js/editing/create-formula-structural-action.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {expression} from '../../src/js/values/value.js';
import {parse} from '../../src/js/parser.mjs';
import {traceStaticGraph} from '../../tools/analyze/p0021-s95a-legacy-route-audit.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('tests/browser/p0021-slice-95f-dynamic-document.html');
const js=read('tests/browser/p0021-slice-95f-dynamic-document.mjs');

test('S95m uses the same existing test page with an explicit structural browser acceptance button',()=>{
  assert.match(html,/id="accept-95m"/);
  assert.match(js,/S95m strukturelle handlinger \+ rigtig Pyodide/);
  assert.match(js,/\$\('accept-95m'\)\.addEventListener/);
});
test('S95m delegates structural edits to existing DocumentRuntime and editing action',()=>{
  assert.match(js,/createFormulaStructuralAction/);
  assert.match(js,/editingSession:editing/);
  for(const kind of ['insert','move','remove']) assert.match(js,new RegExp(`kind:'${kind}'`));
  assert.match(js,/createFormulaEditingSession/);
  assert.match(js,/createSemanticCalculateAction/);
  assert.match(js,/selected-pyodide-worker\.js/);
  assert.doesNotMatch(js,/\b(?:eval|new Function)\s*\(/);
});
test('S95m browser still contains S95f and S95k acceptance buttons',()=>{
  for(const id of ['accept-95f','accept-95k','accept-95m'])assert.match(html,new RegExp(`id="${id}"`));
});
test('S95m selected browser has no static legacy imports',()=>{
  const graph=traceStaticGraph(root,'tests/browser/p0021-slice-95f-dynamic-document.mjs');
  assert.deepEqual(graph.unresolved,[]);
  for(const name of ['src/js/cas-engine.js','src/js/transformer.js','src/js/main.js'])
    assert.equal(graph.modules.includes(name),false,name);
});
test('S95m unit backend: insertion, move and deletion recompute captured functions from document order',async()=>{
  const runtime=DocumentRuntime.createSemantic('s95m-contract');
  for(const [id,source] of [['a','a:=2'],['f','f(t):=t^2+a'],['r3','f(3)'],['r4','f(4)']])
    runtime.addBlock({id,type:'formula',taskId:'T',source});
  let count=0;const revision=()=>`rev-${count}`;
  const editing=createFormulaEditingSession({runtime,taskId:'T'});
  const structure=createFormulaStructuralAction({runtime,taskId:'T',editingSession:editing,
    getCurrentRevision:revision,advanceRevision:()=>{count++;}});
  const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({
    operationId:id,evaluatorId:`probe.scalar.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}],
  })]));
  const calculate=async()=>{
    const {snapshot}=runtime.deriveSemanticTask('T');
    const evaluate=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,revision:revision(),
      evaluate:async (_env,request)=>{
        const [a,b]=request.evaluationRequest.inputs.map(v=>BigInt(v.data.expr.value));
        const id=request.evaluationRequest.evaluatorId;
        const n=id.endsWith('power')?a**b:id.endsWith('multiply')?a*b:a+b;
        return {blockId:request.blockId,status:'success',value:expression({op:'integer',value:String(n)})};
      },
    });
    assert.equal((await runtime.evaluateAndCommitSemanticTask('T',{
      revision:revision(),getCurrentRevision:revision,evaluate})).kind,'complete');
    return [runtime.getBlock('r3').calculation.result.data.expr.value,
      runtime.getBlock('r4').calculation.result.data.expr.value];
  };
  assert.deepEqual(await calculate(),['11','18']);
  structure.apply({kind:'insert',blockId:'boost',index:1,source:'a:=5'});
  assert.deepEqual(await calculate(),['14','21']);
  const identity=runtime.getBlock('boost');
  structure.apply({kind:'move',blockId:'boost',index:4});
  assert.equal(runtime.getBlock('boost'),identity);
  assert.deepEqual(await calculate(),['11','18']);
  structure.apply({kind:'remove',blockId:'boost'});
  assert.equal(runtime.getBlock('boost'),null);
  assert.deepEqual(await calculate(),['11','18']);
});
test('S95m selected browser never writes authoritative source during ordinary input event',()=>{
  const segment=js.split("addEventListener('input',")[1]?.split("addEventListener('keydown',")[0];
  assert.ok(segment);
  assert.doesNotMatch(segment,/\.insertBlock\(|\.removeBlock\(|\.moveBlock\(|\.setBlockSource\(/);
});
