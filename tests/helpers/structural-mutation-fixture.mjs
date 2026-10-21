/** Public runtime setup and detached observations for S98d; no private access. */
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {expression} from '../../src/js/values/value.js';
import {diagnostic} from '../../src/js/diagnostics/diagnostic.js';
import {snapshotData} from './runtime-fixtures.js';

export async function structuralFixture(legacy=false) {
  const runtime=legacy?new DocumentRuntime({calculate:async()=>{throw Error('UNEXPECTED_LEGACY_EVALUATION');}},'s98d'):
    DocumentRuntime.createSemantic('s98d');
  for(const [id,source,taskId] of [
    ['a','a:=2','T'],['f','f(x):=x+a','T'],['b','b:=f(3)','T'],['c','c:=b+1','T'],
    ['ua','a:=10','U'],['ub','a+1','U'],
  ])runtime.addBlock({id,type:'formula',taskId,source});
  runtime.addBlock({id:'text',type:'text',text:'paragraph',metadata:{items:[1,2]}});
  for(const taskId of ['T','U'])await runtime.evaluateAndCommitSemanticTask(taskId,{
    revision:'fixture',getCurrentRevision:()=> 'fixture',evaluate:async task=>task.blockId==='c'?
      {blockId:task.blockId,status:'failure',code:'unsupported-operation',message:'unsupported-operation',
        diagnostic:diagnostic('unsupported-operation',{operationId:'fixture'})}:
      {blockId:task.blockId,status:'success',value:expression({op:'integer',value:'5'})},
  });
  return runtime;
}

export const structuralEdits={
  add:rt=>rt.addBlock({id:'new',type:'formula',taskId:'T',source:'tail:=7',metadata:{items:[3]}}),
  insert:rt=>rt.insertBlock({id:'new',type:'formula',taskId:'T',source:'a:=7',metadata:{items:[3]}},1),
  move:rt=>rt.moveBlock('a',3),
  remove:rt=>rt.removeBlock('a'),
};

export function structuralState(runtime) {
  return {
    blocks:snapshotData(runtime.getBlocks()),
    tasks:['T','U'].map(taskId=>{
      const {snapshot,analysis}=runtime.deriveSemanticTask(taskId);
      const legacy=runtime.dependencyAnalysis.get(taskId);
      return {taskId,snapshot:snapshotData(snapshot),
        bindings:[...analysis.bindings].map(([id,names])=>[id,[...names]]),
        semanticEdges:snapshot.blocks.map(b=>[b.blockId,analysis.graph.getUpstream(b.blockId)]),
        legacyBindings:[...legacy.bindings].map(([id,names])=>[id,[...names]]),
        legacyEdges:snapshot.blocks.map(b=>[b.blockId,runtime.getDependencyGraph(taskId).getUpstream(b.blockId)])};
    }),
  };
}
