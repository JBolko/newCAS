import test from 'node:test';
import assert from 'node:assert/strict';
import {createSelectedPyodideRuntime} from '../../src/js/evaluation/selected-pyodide-runtime.js';

const selection=(name,options={})=>({operationSpec:{evaluatorId:`probe.scalar.${name}`},evaluationRequest:{evaluatorId:`probe.scalar.${name}`,options}});
const fixture=()=>{
 const paths=[];let body='',entered=0;
 const py={FS:{mkdirTree(){},writeFile:p=>paths.push(p)},loadPackage:async()=>{},runPythonAsync:async(code)=>{entered++;body=code;return '{}';},globals:{set(){},delete(){}}};
 return {paths, getBody:()=>body, getEntered:()=>entered, runtime:createSelectedPyodideRuntime({loadPyodide:async()=>py,fetchText:async()=>'',indexURL:'test'})};
};
for(const [name,handler,module] of [
 ['power','evaluate_power_request','scalar_power.py'],
 ['exp','evaluate_exp_request','scalar_exponential.py'],
 ['ln','evaluate_ln_request','scalar_logarithms.py'],
 ['log10','evaluate_log10_request','scalar_logarithms.py'],
]) {
 test(`P0021 Slice 18: ${name} is dispatched by exact selected evaluator`,async()=>{
  const f=fixture();await f.runtime.evaluateSelected({},selection(name));
  assert.match(f.getBody(),new RegExp(handler));
  assert.equal(f.paths.filter(p=>p.endsWith('/'+module)).length,1);
  assert.doesNotMatch(f.getBody(),/run_in_task|eval\(/);
 });
 test(`P0021 Slice 18: ${name} rejects nonempty options before evaluation`,async()=>{
  const f=fixture();await assert.rejects(()=>f.runtime.evaluateSelected({},selection(name,{angleUnit:'rad'})),/empty options/);
  assert.equal(f.getEntered(),1); // initial Python sys.path setup only
 });
}
test('P0021 Slice 18: all four handlers are selected in a single static whitelist',async()=>{
 const f=fixture();await f.runtime.evaluateSelected({},selection('power'));
 const b=f.getBody();for(const name of ['power','exp','ln','log10'])assert.match(b,new RegExp(`probe\.scalar\.${name}`));
 assert.equal(f.paths.filter(p=>p.endsWith('/scalar_logarithms.py')).length,1);
});
test('P0021 Slice 18: genuinely unsupported evaluator is rejected before Python',async()=>{
 const f=fixture();await assert.rejects(()=>f.runtime.evaluateSelected({},selection('factorial')),/unsupported selected evaluator/);
 assert.equal(f.getEntered(),1);
});
