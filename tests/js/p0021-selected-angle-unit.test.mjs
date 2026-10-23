import test from 'node:test';
import assert from 'node:assert/strict';
import {withSelectedAngleUnit} from '../../src/js/semantics/with-selected-angle-unit.js';
import {createSelectedPyodideRuntime} from '../../src/js/evaluation/selected-pyodide-runtime.js';
const selection = id => ({operationSpec:{evaluatorId:id},evaluationRequest:{evaluatorId:id,options:{}}});
test('angle policy requires explicit deg or rad',()=>{for(const unit of [undefined,'auto','degrees',null])assert.throws(()=>withSelectedAngleUnit(()=>{},unit),/explicit/)});
test('selected sine carries deg, no mutation',async()=>{const input=selection('probe.scalar.sin');let sent;await withSelectedAngleUnit(async(e,s)=>{sent=s},'deg')({},input);assert.deepEqual(sent.evaluationRequest.options,{angleUnit:'deg'});assert.deepEqual(input.evaluationRequest.options,{})});
test('selected sine carries rad',async()=>{let sent;await withSelectedAngleUnit(async(e,s)=>{sent=s},'rad')({},selection('probe.scalar.sin'));assert.equal(sent.evaluationRequest.options.angleUnit,'rad')});
test('addition and multiplication are not modified by angle policy',async()=>{for(const id of ['probe.scalar.add','probe.scalar.multiply']){const original=selection(id);let sent;await withSelectedAngleUnit(async(e,s)=>{sent=s},'deg')({},original);assert.strictEqual(sent,original)}});
test('sine rejects unexpected preconfigured options',async()=>{let invoked=false;const s=selection('probe.scalar.sin');s.evaluationRequest.options={angleUnit:'rad'};assert.throws(()=>withSelectedAngleUnit(()=>{invoked=true},'deg')({},s),/unexpected/);assert.equal(invoked,false)});
test('sine rejects mismatched request evaluator',()=>{const s=selection('probe.scalar.sin');s.evaluationRequest.evaluatorId='probe.scalar.add';assert.throws(()=>withSelectedAngleUnit(()=>{},'deg')({},s),/unexpected/)});
test('worker runtime loads sine and trigonometric contract modules',async()=>{const paths=[];const py={FS:{mkdirTree(){},writeFile:(p)=>paths.push(p)},loadPackage:async()=>{},runPythonAsync:async()=>'',globals:{set(){},delete(){}}};const r=createSelectedPyodideRuntime({loadPyodide:async()=>py,fetchText:async()=>'',indexURL:'test'});await r.init();for(const name of ['scalar_trigonometry.py','_trigonometric_argument.py','_unary_value_contract.py'])assert.ok(paths.some(p=>p.endsWith(name)));assert.deepEqual(paths.slice().sort(), [
'/newcas/src/__init__.py',
'/newcas/src/python/__init__.py',
'/newcas/src/python/adapters/__init__.py',
'/newcas/src/python/adapters/sympy_value_adapter.py',
'/newcas/src/python/adapters/statistics_value_adapter.py',
'/newcas/src/python/evaluator/__init__.py',
'/newcas/src/python/evaluator/_binary_expression_contract.py',
'/newcas/src/python/evaluator/_unary_value_contract.py',
'/newcas/src/python/evaluator/_trigonometric_argument.py',
'/newcas/src/python/evaluator/list_mean.py',
'/newcas/src/python/evaluator/list_statistics.py',
'/newcas/src/python/evaluator/container_list.py',
'/newcas/src/python/evaluator/scalar_operations.py',
'/newcas/src/python/evaluator/scalar_differentiation.py',
'/newcas/src/python/evaluator/scalar_multiplication.py',
'/newcas/src/python/evaluator/scalar_power.py',
'/newcas/src/python/evaluator/scalar_exponential.py',
'/newcas/src/python/evaluator/scalar_logarithms.py',
'/newcas/src/python/evaluator/scalar_trigonometry.py',
'/newcas/src/python/evaluator/selected_gateway_bridge.py',
].sort())});
test('worker runtime rejects missing angleUnit before Python gateway dispatch',async()=>{let pythonCalls=0;const py={FS:{mkdirTree(){},writeFile(){}},loadPackage:async()=>{},runPythonAsync:async()=>{pythonCalls++;return ''},globals:{set(){},delete(){}}};const r=createSelectedPyodideRuntime({loadPyodide:async()=>py,fetchText:async()=>'',indexURL:'test'});const env={};await assert.rejects(()=>r.evaluateSelected(env,selection('probe.scalar.sin')),/angleUnit/);assert.equal(pythonCalls,1)});
