import test from 'node:test';
import assert from 'node:assert/strict';
import {withSelectedAngleUnit} from '../../src/js/semantics/with-selected-angle-unit.js';
import {createSelectedPyodideRuntime} from '../../src/js/evaluation/selected-pyodide-runtime.js';
const selection=(name)=>({operationSpec:{evaluatorId:`probe.scalar.${name}`},evaluationRequest:{evaluatorId:`probe.scalar.${name}`,options:{}}});
for(const name of ['sin','cos','tan']) {
 test(`P0021 trig ${name} propagates explicit deg`,async()=>{
  const initial=selection(name);let seen;
  await withSelectedAngleUnit(async(e,s)=>{seen=s},'deg')({},initial);
  assert.deepEqual(seen.evaluationRequest.options,{angleUnit:'deg'});
  assert.deepEqual(initial.evaluationRequest.options,{});
 });
 test(`P0021 trig ${name} rejects missing angle before Python`,async()=>{
  let evaluations=0;
  const py={FS:{mkdirTree(){},writeFile(){}},loadPackage:async()=>{},runPythonAsync:async()=>{evaluations++;return '{}'},globals:{set(){},delete(){}}};
  const runtime=createSelectedPyodideRuntime({loadPyodide:async()=>py,fetchText:async()=>'',indexURL:'test'});
  await assert.rejects(()=>runtime.evaluateSelected({},selection(name)),/angleUnit/);
  assert.equal(evaluations,1);
 });
}
test('P0021 trig family reuses same Python module and explicit handler selection',async()=>{
 const paths=[];let entry;
 const py={FS:{mkdirTree(){},writeFile:(p)=>paths.push(p)},loadPackage:async()=>{},runPythonAsync:async(code)=>{entry=code;return '{}'},globals:{set(){},delete(){}}};
 const runtime=createSelectedPyodideRuntime({loadPyodide:async()=>py,fetchText:async()=>'',indexURL:'test'});
 await runtime.evaluateSelected({}, {...selection('cos'),evaluationRequest:{...selection('cos').evaluationRequest,options:{angleUnit:'rad'}}});
 assert.equal(paths.filter(p=>p.endsWith('/scalar_trigonometry.py')).length,1);
 assert.match(entry,/evaluate_cosine_request/);
 assert.match(entry,/evaluate_tangent_request/);
 assert.doesNotMatch(entry,/run_in_task|eval\(/);
});
test('P0021 nontrigonometric operations preserve original selection',async()=>{
 const selected=selection('add');let seen;
 await withSelectedAngleUnit(async(e,s)=>{seen=s},'rad')({},selected);
 assert.strictEqual(seen,selected);
});
