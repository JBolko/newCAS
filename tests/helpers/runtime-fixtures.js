/** Test-only setup through supported runtime entrypoints; no private access. */
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {expression} from '../../src/js/values/value.js';
export async function seedLegacyCalculation(runtime,id,{result={type:'success'},status='success'}={}) {
 const engine=runtime.engine,calculate=engine.calculate;
 engine.calculate=async()=>{if(status==='error')throw Error('fixture error');return result;};
 try {await DocumentRuntime.prototype.calculateBlock.call(runtime,id);}
 catch(error){if(status!=='error')throw error;}
 finally {engine.calculate=calculate;}
 if(status==='dirty')runtime.markBlockDirty(id);
}
export async function failLegacyCalculation(runtime,id,message) {
 const engine=runtime.engine,calculate=engine.calculate;
 engine.calculate=async()=>{throw Error(message);};
 try{return await DocumentRuntime.prototype.calculateBlock.call(runtime,id);}
 finally{engine.calculate=calculate;}
}
export async function seedSemanticTask(runtime,taskId,{generation=0,value=expression({op:'integer',value:'1'})}={}) {
 for(const b of runtime.getBlocks().filter(b=>b.type==='formula'&&b.taskId===taskId))
  for(let n=b.calculation.generation;n<generation;n++)runtime.setBlockSource(b.id,b.source);
 return runtime.evaluateAndCommitSemanticTask(taskId,{revision:'fixture',getCurrentRevision:()=> 'fixture',
  evaluate:async task=>({blockId:task.blockId,status:'success',value})});
}
export const snapshotData=data=>JSON.parse(JSON.stringify(data));
