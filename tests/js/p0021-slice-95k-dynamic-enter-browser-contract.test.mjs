/** S95k — browser Enter integration, with existing DocumentRuntime and Pyodide seam. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {createFormulaEditingSession} from '../../src/js/editing/create-formula-editing-session.js';
import {createSemanticCalculateAction,submitFormulaEditorEnter} from '../../src/js/ui/create-semantic-calculate-action.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {expression} from '../../src/js/values/value.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {traceStaticGraph} from '../../tools/analyze/p0021-s95a-legacy-route-audit.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const html=read('tests/browser/p0021-slice-95f-dynamic-document.html');
const source=read('tests/browser/p0021-slice-95f-dynamic-document.mjs');

test('S95k existing variable-length browser pilot exposes explicit Enter acceptance',()=>{
  assert.match(html,/id="accept-95k"/);
  assert.match(source,/accept-95k/);
  assert.match(source,/S95k Enter \+ EditingSession \+ rigtig Pyodide/);
  assert.match(source,/lastEnterPromise/);
  assert.match(source,/uiBusyDepth/);
  assert.match(source,/KeyboardEvent\('keydown'/);
});
test('S95k browser uses existing EditingSession and S95e action, not a new evaluator',()=>{
  assert.match(source,/createFormulaEditingSession/);
  assert.match(source,/submitFormulaEditorEnter/);
  assert.match(source,/createSemanticCalculateAction/);
  assert.match(source,/createSupervisedSemanticTaskSession/);
  assert.match(source,/selected-pyodide-worker\.js/);
  assert.match(source,/renderSemanticCalculation/);
});
test('S95k browser source changes only on Calculate or explicit Enter, not input events',()=>{
  assert.match(source,/addEventListener\('input'/);
  assert.match(source,/editing\.replaceSource\(event\.target\.value\)/);
  assert.match(source,/addEventListener\('keydown'/);
  assert.match(source,/submitFormulaEditorEnter\(/);
  const inputHandler=source.split("addEventListener('input',")[1]?.split("addEventListener('keydown',")[0];
  assert.ok(inputHandler);
  assert.doesNotMatch(inputHandler,/setBlockSource|\.calculate\(/);
});
test('S95k browser preserves source IDs from authoritative DocumentRuntime',()=>{
  assert.match(source,/editing\.begin\(blockId\)/);
  assert.match(source,/runtime\.getBlock\(line\.dataset\.blockId\)/);
  assert.doesNotMatch(source,/Math\.random\(|Date\.now\(|\.children\.length\s*\+\s*1/);
});
test('S95k Enter avoids modified keys, IME, auto-repeat, and unhandled promise rejection',()=>{
  for(const clause of ['event.shiftKey','event.ctrlKey','event.metaKey','event.isComposing','event.repeat'])
    assert.ok(source.includes(clause),clause);
  assert.match(source,/lastEnterPromise\.catch\(\(\)=>\{\}\)/);
});
test('S95k test pilot remains isolated from legacy/static imports and .ncas format',()=>{
  const graph=traceStaticGraph(ROOT,'tests/browser/p0021-slice-95f-dynamic-document.mjs');
  assert.deepEqual(graph.unresolved,[]);
  for(const bad of ['src/js/cas-engine.js','src/js/transformer.js','src/js/main.js'])
    assert.equal(graph.modules.includes(bad),false,bad);
  assert.match(html,/Ikke elev-UI/);
  assert.doesNotMatch(source,/innerHTML\s*=|outerHTML\s*=|\beval\s*\(/);
});
test('S95k selected semantic task still evaluates downstream function on a single-block Enter',async()=>{
  const runtime=DocumentRuntime.createSemantic('s95k-node');
  for(const [id,source] of [['a','a:=2'],['f','f(t):=t^2+a'],['r3','f(3)'],['r4','f(4)']])
    runtime.addBlock({id,type:'formula',taskId:'T',source});
  const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({
    operationId:id,evaluatorId:`probe.scalar.${id}`,
    arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
  const backend=async (_unused,request)=>{
    const [a,b]=request.evaluationRequest.inputs.map(v=>BigInt(v.data.expr.value));
    const operation=request.evaluationRequest.evaluatorId;
    const n=operation.endsWith('.power')?a**b:operation.endsWith('.multiply')?a*b:a+b;
    return {blockId:request.blockId,status:'success',value:expression({op:'integer',value:String(n)})};
  };
  let revision='r0';
  const session={run:()=>{
    const {snapshot}=runtime.deriveSemanticTask('T');
    const evaluate=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate:backend,revision});
    return runtime.evaluateAndCommitSemanticTask('T',{revision,getCurrentRevision:()=>revision,evaluate});
  }};
  const calculateAction=createSemanticCalculateAction({runtime,session,taskId:'T',
    getCurrentRevision:()=>revision,advanceRevision:()=>{revision+='+';}});
  const editingSession=createFormulaEditingSession({runtime,taskId:'T'});
  editingSession.begin('a');editingSession.replaceSource('a:=5');
  let stopped=false;
  const out=await submitFormulaEditorEnter({event:{key:'Enter',preventDefault(){stopped=true;}},
    editingSession,calculateAction});
  assert.equal(out.kind,'complete');assert.equal(stopped,true);
  assert.equal(runtime.getBlock('r3').calculation.result.data.expr.value,'14');
  assert.equal(runtime.getBlock('r4').calculation.result.data.expr.value,'21');
  assert.equal(runtime.getBlocks().length,4);
  assert.equal(editingSession.snapshot(),null);
});
