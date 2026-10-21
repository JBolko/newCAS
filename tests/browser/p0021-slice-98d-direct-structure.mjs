/** S98d direct API acceptance with actual supervised Worker results. */
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';
import {createSupervisedSemanticTaskSession} from '../../src/js/semantics/create-supervised-semantic-task-session.js';

const rt=DocumentRuntime.createSemantic('s98d-browser'),results=[],sessions=[],workerCalls=[];
const check=(ok,message)=>{if(!ok)throw Error(message);};
const state=()=>JSON.stringify(rt.getBlocks());
const number=id=>rt.getBlock(id).calculation.result?.data?.expr?.value;
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({operationId:id,
  evaluatorId:`probe.scalar.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
let epoch=0,delay=null;
const revision=()=>String(epoch),advanceRevision=()=>{epoch++;};
function sessionFor(taskId){
  const session=createSupervisedSemanticTaskSession({runtime:rt,taskId,getCurrentRevision:revision,advanceRevision,
    supervision:{timeoutMs:180000,maxPending:1},
    createWorker:()=>new Worker(new URL('../../src/js/evaluation/selected-pyodide-worker.js',import.meta.url),{type:'module'}),
    createEvaluate:({snapshot,revision,cachedOutcomes,evaluateSelected})=>
      createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,revision,cachedOutcomes,
        evaluate:async(envelope,selection)=>{
          workerCalls.push(envelope.blockId);
          const outcome=await evaluateSelected(envelope,selection);
          if(delay&&envelope.blockId==='r'){
            const pending=delay;delay=null;pending.started();await pending.gate;
          }
          return outcome;
        }}),
  });
  sessions.push(session);return session;
}
try{
  for(const [id,source,taskId] of [['a','a:=2','T'],['f','f(x):=x^2+a','T'],['r','f(3)','T'],
    ['ua','a:=100','U'],['ub','b:=a+1','U']])rt.addBlock({id,type:'formula',source,taskId});
  const main=sessionFor('T'),other=sessionFor('U');
  check((await main.run()).kind==='complete'&&(await other.run()).kind==='complete','initial real evaluation');
  check(number('r')==='11'&&number('ub')==='101','real initial results 11/101');
  results.push('PASS: direct add setup evaluated by real Workers in isolated tasks, results 11/101');

  const before=state(),stamp=rt.getDocumentMutationIdentity(),aView=rt.getBlock('a');
  const token=rt.getBlockSourceIdentity('a'),dirty=rt.markBlockDirty;
  let injected=0;
  rt.markBlockDirty=function(id){
    dirty.call(this,id);
    if(id==='f'){
      check(this.getBlock(id).calculation.status==='dirty','fault occurs after dirtying');
      injected++;throw Error('BROWSER_AFTER_DIRTY');
    }
  };
  advanceRevision();let failed=false;
  try{rt.removeBlock('a');}catch(e){failed=e.message==='BROWSER_AFTER_DIRTY';}
  finally{rt.markBlockDirty=dirty;}
  check(failed&&injected===1&&state()===before,'failed removal restores all real result slots and sources');
  check(rt.getDocumentMutationIdentity()===stamp&&rt.getBlock('a')===aView&&rt.getBlockSourceIdentity('a')===token,'rollback preserves authority identity');
  check(epoch===1,'host revision is not rolled back');
  results.push('PASS: fault after dirtying rolls back removal, live views, results and stamp; host epoch stays advanced');

  let nestedError;
  const unsubscribe=rt.subscribeSemanticChanges(()=>{try{rt.removeBlock('r');}catch(e){nestedError=e.message;}});
  advanceRevision();const affected=rt.insertBlock({id:'shadow',type:'formula',taskId:'T',source:'a:=5'},1);
  unsubscribe();
  check(nestedError==='S96A_REENTRANT_MUTATION'&&affected.has('r')&&rt.getBlock('r'),'nested removal blocked before return');
  check((await main.run()).kind==='complete'&&number('r')==='14','insert capture recalculates to real 14');
  check(number('ub')==='101','other task untouched');
  results.push('PASS: direct insert blocks nested listener removal and computes changed capture=14, other task=101');

  advanceRevision();rt.moveBlock('shadow',4);
  check((await main.run()).kind==='complete'&&number('r')==='11','move restores preceding writer/capture');
  const silent=rt.subscribeSemanticChanges(()=>{throw Error('OBSERVER');});
  advanceRevision();check(rt.removeBlock('shadow') instanceof Set,'semantic observer throw is isolated');silent();
  check((await main.run()).kind==='complete'&&number('r')==='11','post-listener document remains usable');
  const stable=rt.getDocumentMutationIdentity();
  check(rt.moveBlock('a',0).size===0&&rt.getDocumentMutationIdentity()===stable,'no-op preserves stamp');
  results.push('PASS: direct move/remove retain math=11, throwing observer isolation and genuine no-op semantics');

  advanceRevision();rt.setBlockSource('r','f(4)');
  let release,started;
  const ready=new Promise(r=>started=r),gate=new Promise(r=>release=r);
  delay={started,gate};
  const pending=main.run();await ready; // actual Worker response is held, not synthesized.
  advanceRevision();rt.removeBlock('a');release();
  check((await pending).kind==='stale'&&number('r')===undefined,'late actual Worker response cannot publish after removal');
  advanceRevision();const recreated=rt.addBlock({id:'a',type:'formula',taskId:'T',source:'a:=2'});
  check(recreated!==aView&&rt.getBlockSourceIdentity('a')!==token,'same ID has fresh incarnation/source identity');
  advanceRevision();rt.moveBlock('a',0);
  check((await main.run()).kind==='complete'&&number('r')==='18','fresh explicit run computes correct 18');
  check(number('ub')==='101','U result survived all direct edits');
  results.push('PASS: delayed real Worker result is stale after delete; same-ID recreate is fresh and explicit recalculation gives 18');
  window.s98dResult={pass:results.length,fail:0,todo:0,skip:0,results,workerCalls};
}catch(error){
  window.s98dResult={pass:results.length,fail:1,todo:0,skip:0,results,workerCalls,error:String(error.stack??error)};
}finally{
  for(const session of sessions)session.close();
  document.getElementById('result').textContent=JSON.stringify(window.s98dResult,null,2);
}
