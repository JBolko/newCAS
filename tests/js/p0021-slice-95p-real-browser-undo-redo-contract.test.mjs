import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {createDocumentHistorySession} from '../../src/js/editing/create-document-history-session.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {expression} from '../../src/js/values/value.js';
import {parse} from '../../src/js/parser.mjs';
import {traceStaticGraph} from '../../tools/analyze/p0021-s95a-legacy-route-audit.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('tests/browser/p0021-slice-95f-dynamic-document.html');
const script=read('tests/browser/p0021-slice-95f-dynamic-document.mjs');

test('95p adds Undo/Redo browser proof without replacing older regressions',()=>{
 for(const label of ['accept-95f','accept-95k','accept-95m','accept-95p'])
   assert.match(html,new RegExp(`id="${label}"`));
 assert.match(script,/\$\('accept-95p'\)\.addEventListener/);
 assert.match(script,/createDocumentHistorySession/);
 assert.match(script,/S95p Undo\/Redo \+ rigtig Pyodide/);
});
test('95p browser uses the existing IR, supervisor, renderer, EditingSession and runtime',()=>{
 for(const marker of ['createSupervisedSemanticTaskSession','createSemanticCalculateAction',
   'createFormulaEditingSession','renderSemanticCalculation','selected-pyodide-worker.js',
   'createDocumentHistorySession']) assert.ok(script.includes(marker),marker);
 const graph=traceStaticGraph(root,'tests/browser/p0021-slice-95f-dynamic-document.mjs');
 assert.deepEqual(graph.unresolved,[]);
 for(const legacy of ['src/js/cas-engine.js','src/js/transformer.js','src/js/main.js'])
   assert.equal(graph.modules.includes(legacy),false,legacy);
});
test('95p UI does not implement its own authoritative document history',()=>{
 assert.doesNotMatch(script,/\b(?:new Function|eval)\s*\(/);
 assert.doesNotMatch(script,/\bhistoryStack\b|\bundoStack\b|\bredoStack\b/);
 const start=script.indexOf("$('accept-95p').addEventListener");
 const end=script.indexOf('function noteDone()',start);
 const accept=script.slice(start,end);
 assert.ok(start>=0 && end>start);
 for(const primitive of ["kind:'insert'","kind:'move'","kind:'remove'","kind:'source'"])
   assert.ok(accept.includes(primitive),primitive);
 assert.doesNotMatch(accept,/\.setBlockSource\(|\.insertBlock\(|\.removeBlock\(|\.moveBlock\(/);
});
test('95p unit backend: real symbolic binding changes survive Undo/Redo and branch',async()=>{
 const runtime=DocumentRuntime.createSemantic('s95p');
 for(const [id,source] of [['a','a:=2'],['f','f(t):=t^2+a'],['r3','f(3)'],['r4','f(4)']])
   runtime.addBlock({id,type:'formula',taskId:'T',source});
 let tick=0;const rev=()=>`rev-${tick}`;
 const history=createDocumentHistorySession({runtime,getCurrentRevision:rev,
   advanceRevision:()=>{tick++;}});
 const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({
   operationId:id,evaluatorId:`probe.scalar.${id}`,
   arguments:[{name:'a',role:'value'},{name:'b',role:'value'}],
 })]));
 async function calculate(){
   const {snapshot}=runtime.deriveSemanticTask('T');
   const evaluate=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,revision:rev(),
     evaluate:async (_env,req)=>{
       const [a,b]=req.evaluationRequest.inputs.map(x=>BigInt(x.data.expr.value));
       const id=req.evaluationRequest.evaluatorId;
       const n=id.endsWith('power')?a**b:id.endsWith('multiply')?a*b:a+b;
       return {blockId:req.blockId,status:'success',value:expression({op:'integer',value:String(n)})};
     }});
   assert.equal((await runtime.evaluateAndCommitSemanticTask('T',{
     revision:rev(),getCurrentRevision:rev,evaluate})).kind,'complete');
   return [runtime.getBlock('r3').calculation.result.data.expr.value,
     runtime.getBlock('r4').calculation.result.data.expr.value];
 }
 assert.deepEqual(await calculate(),['11','18']);
 history.execute([{kind:'insert',blockId:'boost',index:1,taskId:'T',source:'a:=5'}]);
 assert.deepEqual(await calculate(),['14','21']);
 history.undo();assert.deepEqual(await calculate(),['11','18']);
 history.redo();assert.deepEqual(await calculate(),['14','21']);
 history.execute([{kind:'move',blockId:'boost',index:4}]);
 assert.deepEqual(await calculate(),['11','18']);
 history.undo();assert.deepEqual(await calculate(),['14','21']);
 history.execute([{kind:'remove',blockId:'boost'}]);
 assert.deepEqual(await calculate(),['11','18']);
 history.undo();assert.deepEqual(await calculate(),['14','21']);
 history.execute([{kind:'source',blockId:'boost',source:'a:=8'}]);
 assert.deepEqual(await calculate(),['17','24']);
 history.undo();assert.deepEqual(await calculate(),['14','21']);
 history.execute([{kind:'source',blockId:'boost',source:'a:=6'}]);
 assert.equal(history.snapshot().canRedo,false);
 assert.deepEqual(await calculate(),['15','22']);
});
test('95p abandoned in-flight result after edit and Undo may not commit',async()=>{
 const runtime=DocumentRuntime.createSemantic('s95p-async');
 runtime.addBlock({id:'a',type:'formula',taskId:'T',source:'2'});
 let rev=0;const revision=()=>`r${rev}`;
 const history=createDocumentHistorySession({runtime,getCurrentRevision:revision,
   advanceRevision:()=>{rev++;}});
 let release;const pending=new Promise(resolve=>release=resolve);
 const late=runtime.evaluateAndCommitSemanticTask('T',{
   revision:revision(),getCurrentRevision:revision,
   evaluate:async task=>{await pending;return {blockId:task.blockId,status:'success',
     value:expression({op:'integer',value:'999'})};},
 });
 await Promise.resolve();
 history.execute([{kind:'source',blockId:'a',source:'3'}]);
 history.undo();
 assert.equal(runtime.getBlock('a').source,'2');
 assert.equal(rev,2,'Undo must advance epoch rather than restore older revision');
 release();
 assert.equal((await late).kind,'stale');
 assert.equal(runtime.getBlock('a').calculation.result,null);
});
