/** S98b: falsify the global f(3)=9 fallback using actual supervised Pyodide. */
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {isDiagnostic} from '../../src/js/diagnostics/diagnostic.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {createSupervisedSemanticTaskSession} from '../../src/js/semantics/create-supervised-semantic-task-session.js';

const results=[],workerCalls=[],sessions=[];
const check=(condition,message)=>{if(!condition)throw new Error(message);};
const runtime=DocumentRuntime.createSemantic('s98b-browser');
const number=id=>runtime.getBlock(id).calculation.result?.data?.expr?.value;
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({operationId:id,
  evaluatorId:`probe.scalar.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
let epoch=0;
const revision=()=>String(epoch),advanceRevision=()=>{epoch++;};
function sessionFor(taskId) {
  const session=createSupervisedSemanticTaskSession({runtime,taskId,getCurrentRevision:revision,advanceRevision,
    supervision:{timeoutMs:180000,maxPending:1},
    createWorker:()=>new Worker(new URL('../../src/js/evaluation/selected-pyodide-worker.js',import.meta.url),{type:'module'}),
    createEvaluate:({snapshot,revision,cachedOutcomes,evaluateSelected})=>
      createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,revision,cachedOutcomes,
        evaluate:async(envelope,selection)=>{
          workerCalls.push({taskId,blockId:envelope.blockId,evaluatorId:selection.operationSpec.evaluatorId});
          return await evaluateSelected(envelope,selection); // No synthesized mathematical outcomes.
        }}),
  });
  sessions.push(session);return session;
}
function add(taskId,rows) {
  for(const [id,source] of rows)runtime.addBlock({id,type:'formula',taskId,source});
}
function localFailure(taskId,id,consumer) {
  const block=runtime.getBlock(id),slot=block.calculation;
  check(slot.status==='error' && slot.result===null,`${id}: no FunctionValue or result`);
  const diagnostic=slot.error?.diagnostic;
  check(slot.error.code==='unsupported-operation' && isDiagnostic(diagnostic),`${id}: structured local failure`);
  check(diagnostic.code==='unsupported-operation' && diagnostic.parameters.operationId==='lexical-call' && diagnostic.parameters.name==='f',`${id}: exact diagnostic`);
  const {snapshot,analysis}=runtime.deriveSemanticTask(taskId),entry=snapshot.blocks.find(b=>b.blockId===id);
  check(snapshot.writers.some(w=>w.writerId===id),'structural function writer retained');
  check(entry.calls.length===1 && entry.calls[0].classification==='lexical-binder' && entry.calls[0].providerId===null,'callee remains local');
  check(analysis.graph.getUpstream(id).length===0 && analysis.bindings.get(id).size===0,'no document f dependency');
  check(analysis.bindings.get(consumer).get(parse(block.source)[0].name)===id,'consumer binds nearest structural writer');
  const downstream=runtime.getBlock(consumer).calculation;
  check(downstream.status==='error' && downstream.result===null && downstream.error.code==='UPSTREAM_FAILED','no success fallback');
  check(!workerCalls.some(c=>c.blockId===id || c.blockId===consumer),'unsupported callable and consumer never reach backend');
  return diagnostic;
}

try {
  add('with-f',[
    ['a-f','f(x):=x^2'],['a-old-g','g(x):=x+1'],['a-g','g(f):=f(3)'],['a-A','A:=g(100)'],
    ['a-d',"d(f):=f'(3)"],['a-D','D:=d(100)'],['a-dd',"dd(f):=f''(3)"],['a-DD','DD:=dd(100)'],
    ['a-h','h(x):=x^2+1'],['a-H','H:=h(3)'],['a-k','k(x):=f(x)+1'],['a-K','K:=k(3)'],
    ['a-check','check:=f(3)'],['a-c','c:=2'],['a-p','p(x):=c*x+1'],['a-later-c','c:=100'],['a-C','C:=p(3)'],
  ]);
  add('without-f',[
    ['b-g','g(f):=f(3)'],['b-A','A:=g(100)'],['b-d',"d(f):=f'(3)"],['b-D','D:=d(100)'],
    ['b-dd',"dd(f):=f''(3)"],['b-DD','DD:=dd(100)'],['b-check','check:=2+3'],
  ]);
  const withF=sessionFor('with-f'),withoutF=sessionFor('without-f');
  check((await withF.run()).kind==='complete','task with prior f completes');
  check(number('a-A')!=='9','F4: A must never be 9 from document f(3)');
  const first=localFailure('with-f','a-g','a-A');
  check(runtime.getBlock('a-old-g').calculation.status==='success','older g really has a FunctionValue');
  check(number('a-A')!== '101','older successful g must not be used');
  results.push('PASS: exact F4 source has local unsupported-operation, no false edge or A=9; newer failed g remains writer instead of older successful g');

  check((await withoutF.run()).kind==='complete','task without prior f completes');
  const second=localFailure('without-f','b-g','b-A');
  check(JSON.stringify(first)===JSON.stringify(second),'same diagnostic with and without document f');
  check(number('b-check')==='5' && workerCalls.some(c=>c.blockId==='b-check'),'without-f task really calculated with SymPy');
  results.push('PASS: absence of document f changes neither lexical binding nor structured diagnostic; independent real SymPy control=5');

  for(const [task,prefix] of [['with-f','a'],['without-f','b']]) {
    localFailure(task,`${prefix}-d`,`${prefix}-D`);
    localFailure(task,`${prefix}-dd`,`${prefix}-DD`);
  }
  results.push('PASS: first and second prime callable syntax preserve lexical f and structured failure in both tasks, without backend dispatch');

  check(number('a-H')==='10' && number('a-K')==='10' && number('a-C')==='7' && number('a-check')==='9','real local arithmetic, composition, immutable capture and document f');
  check(['a-H','a-K','a-C','a-check'].every(id=>workerCalls.some(c=>c.blockId===id)),'positive controls really reached production Worker');
  results.push('PASS: ordinary lexical arithmetic=10, legitimate document composition=10, captured scalar=7, and explicit global f(3)=9 via real SymPy');

  const gToken=runtime.getBlockSourceIdentity('a-g'),gSlot=runtime.getBlock('a-g').calculation;
  const bToken=runtime.getBlockSourceIdentity('b-g'),bSlot=runtime.getBlock('b-g').calculation;
  advanceRevision();runtime.setBlockSource('a-f','f(x):=x+100');
  check(runtime.getBlockSourceIdentity('a-g')===gToken && runtime.getBlock('a-g').calculation===gSlot,'irrelevant document f edit does not dirty lexical g');
  check((await withF.run()).kind==='complete','real recalculation after document f edit');
  check(number('a-check')==='103' && number('a-K')==='104' && number('a-H')==='10' && number('a-C')==='7','only legitimate callable dependencies change');
  localFailure('with-f','a-g','a-A');
  check(runtime.getBlockSourceIdentity('b-g')===bToken && runtime.getBlock('b-g').calculation===bSlot,'other task remains untouched');
  results.push('PASS: changing document f recalculates legitimate calls to 103/104 while lexical g stays local and failed; independent task and captured 7 stay unchanged');
  document.getElementById('diagnostics').textContent=JSON.stringify({withDocumentF:first,withoutDocumentF:second},null,2);
  window.s98bResult={pass:results.length,fail:0,todo:0,skip:0,results,workerCalls};
} catch(error) {
  window.s98bResult={pass:results.length,fail:1,todo:0,skip:0,results,workerCalls,error:String(error.stack??error)};
} finally {
  for(const session of sessions)session.close();
  document.getElementById('result').textContent=JSON.stringify(window.s98bResult,null,2);
}
