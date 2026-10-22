import test from 'node:test';
import assert from 'node:assert/strict';
import {createSelectedPyodideRuntime} from '../../src/js/evaluation/selected-pyodide-runtime.js';
const envelope = {protocol:'newcas.semantic-evaluation.v1',revision:'r1',blockId:'b1',taskScopeId:'t1',source:'2+3',providers:[]};
const selection = {operationSpec:{evaluatorId:'probe.scalar.add'},evaluationRequest:{evaluatorId:'probe.scalar.add'}};
function fixture({failLoad=false}={}) {
 const calls=[], fs=new Map(), vars=new Map(); let loads=0;
 const py = {FS:{mkdirTree:p=>calls.push(['mkdir',p]),writeFile:(p,s)=>fs.set(p,s)},
  globals:{set:(k,v)=>vars.set(k,v),delete:k=>vars.delete(k)},
  loadPackage:async n=>calls.push(['package',n]),
  runPythonAsync:async code=>{calls.push(['python',code]); if(code.includes('evaluate_selected_gateway')) {const o=JSON.parse(vars.get('_newcas_request_json'));return JSON.stringify({blockId:o.envelope.blockId,status:'success',value:{valueVersion:1,kind:'expression',data:{expr:{op:'integer',value:'5'}}}});} return '';}}
 const runtime=createSelectedPyodideRuntime({indexURL:'test/',loadPyodide:async()=>{loads++;if(failLoad && loads===1)throw Error('network');return py;},fetchText:async file=>`# ${file}`});
 return {runtime,calls,fs,vars,get loads(){return loads}};
}
test('P0021 Pyodide initializes once and loads SymPy',async()=>{const f=fixture();await Promise.all([f.runtime.init(),f.runtime.init()]);assert.equal(f.loads,1);assert.equal(f.calls.filter(x=>x[0]==='package').length,1)});
test('P0021 Pyodide loads only explicitly whitelisted Python modules',async()=>{const f=fixture();await f.runtime.init();assert.ok(f.fs.has('/newcas/src/python/evaluator/selected_gateway_bridge.py'));assert.ok(f.fs.has('/newcas/src/python/adapters/sympy_value_adapter.py'));assert.deepEqual([...f.fs.keys()].sort(), [
 '/newcas/src/__init__.py',
 '/newcas/src/python/__init__.py',
 '/newcas/src/python/adapters/__init__.py',
 '/newcas/src/python/adapters/sympy_value_adapter.py',
 '/newcas/src/python/evaluator/__init__.py',
 '/newcas/src/python/evaluator/_binary_expression_contract.py',
 '/newcas/src/python/evaluator/_unary_value_contract.py',
 '/newcas/src/python/evaluator/_trigonometric_argument.py',
 '/newcas/src/python/evaluator/list_mean.py',
 '/newcas/src/python/evaluator/list_statistics.py',
 '/newcas/src/python/evaluator/container_list.py',
 '/newcas/src/python/evaluator/scalar_trigonometry.py',
 '/newcas/src/python/evaluator/scalar_multiplication.py',
 '/newcas/src/python/evaluator/scalar_power.py',
 '/newcas/src/python/evaluator/scalar_exponential.py',
 '/newcas/src/python/evaluator/scalar_logarithms.py',
 '/newcas/src/python/evaluator/scalar_operations.py',
 '/newcas/src/python/evaluator/scalar_differentiation.py',
 '/newcas/src/python/evaluator/selected_gateway_bridge.py',
].sort())});
test('P0021 Pyodide calls real Python gateway entry, not legacy run_in_task',async()=>{const f=fixture();await f.runtime.evaluateSelected(envelope,selection);const code=f.calls.filter(x=>x[0]==='python').at(-1)[1];assert.match(code,/evaluate_selected_gateway/);assert.doesNotMatch(code,/run_in_task/)});
test('P0021 transport passes source, revision and provider identity unchanged',async()=>{const f=fixture();const out=await f.runtime.evaluateSelected(envelope,selection);assert.deepEqual(out.blockId,'b1');assert.equal(out.value.data.expr.value,'5')});
test('P0021 unselected operation is refused before Python',async()=>{const f=fixture();await assert.rejects(()=>f.runtime.evaluateSelected(envelope,{...selection,operationSpec:{evaluatorId:'other'}}),/unsupported selected evaluator/);assert.equal(f.calls.filter(x=>x[0]==='python').length,1)});
test('P0021 temporary request is cleaned after success',async()=>{const f=fixture();await f.runtime.evaluateSelected(envelope,selection);assert.equal(f.vars.size,0)});
test('P0021 failed init may retry',async()=>{const f=fixture({failLoad:true});await assert.rejects(()=>f.runtime.init(),/network/);await f.runtime.init();assert.equal(f.loads,2)});
test('P0021 no persistent Python document/task state created',async()=>{const f=fixture();await f.runtime.evaluateSelected(envelope,selection);assert.ok(![...f.fs.keys()].some(k=>k.includes('core/scope')))});
