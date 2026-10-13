import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createSelectedPyodideRuntime} from '../../src/js/evaluation/selected-pyodide-runtime.js';
import {compileSelectedSymbolicDiff} from '../../src/js/semantics/compile-selected-symbolic-diff.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {operationReference,semanticReference,call} from '../../src/js/semantics/semantic-ir.js';
import {freeSymbolIdentity} from '../../src/js/semantics/identity.js';
const env={protocol:'newcas.semantic-evaluation.v1',revision:'r1',blockId:'b1',taskScopeId:'t1',source:'diff(x,x)',providers:[]};
const spec=operationSpec({operationId:'diff',evaluatorId:'probe.symbolic.diff',arguments:[{name:'expression',role:'value'},{name:'variable',role:'symbolic'}]});
const x=semanticReference(freeSymbolIdentity('t1','x'));
const selection=compileSelectedSymbolicDiff(env,call(operationReference('diff'),[x,x]),spec);
function fixture(){
 const fs=new Map(),vars=new Map(),executed=[];
 const py={FS:{mkdirTree:()=>{},writeFile:(p,s)=>fs.set(p,s)},globals:{set:(k,v)=>vars.set(k,v),delete:k=>vars.delete(k)},loadPackage:async()=>{},runPythonAsync:async code=>{
  executed.push(code);
  if(!code.includes('evaluate_selected_gateway'))return '';
  const payload=JSON.parse(vars.get('_newcas_request_json'));
  return JSON.stringify({blockId:payload.envelope.blockId,status:'success',value:payload.selection.evaluationRequest.inputs[0]});
 }};
 return {runtime:createSelectedPyodideRuntime({indexURL:'stub/',loadPyodide:async()=>py,fetchText:async p=>readFileSync(p,'utf8')}),fs,vars,executed};
}
test('symbolic diff selected request crosses Pyodide transport unchanged',async()=>{
 const f=fixture(); const result=await f.runtime.evaluateSelected(env,selection);
 assert.equal(result.status,'success');assert.deepEqual(result.value,selection.evaluationRequest.inputs[0]);
 assert.ok(f.fs.has('/newcas/src/python/evaluator/scalar_differentiation.py'));
 assert.match(f.executed.at(-1),/evaluate_diff_request/);
 assert.equal(f.vars.size,0);
});
test('worker runtime refuses an unselected symbolic evaluator',async()=>{
 const f=fixture();await assert.rejects(()=>f.runtime.evaluateSelected(env,{...selection,operationSpec:{...spec,evaluatorId:'other'}}),/unsupported selected evaluator/);
});
test('worker runtime refuses numeric substitution as differentiation target',async()=>{
 const f=fixture();const wrong=structuredClone(selection);
 wrong.evaluationRequest.inputs[1].data.expr={op:'integer',value:'17'};
 await assert.rejects(()=>f.runtime.evaluateSelected(env,wrong),/explicit symbolRef target/);
});
test('worker runtime rejects hidden symbolic options or instructions',async()=>{
 const f=fixture();for(const change of [{options:{angleUnit:'rad'}},{instruction:{order:2}}]){
  const wrong=structuredClone(selection);Object.assign(wrong.evaluationRequest,change);
  await assert.rejects(()=>f.runtime.evaluateSelected(env,wrong),/empty options\/instruction/);
 }
});
test('worker entry version-bumps runtime import to avoid stale browser module',()=>{
 const js=readFileSync('src/js/evaluation/selected-pyodide-worker.js','utf8');
 assert.match(js,/selected-pyodide-runtime\.js\?v=slice24-symbolic-diff-v1/);
});
