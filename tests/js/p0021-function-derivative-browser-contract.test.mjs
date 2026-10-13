import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileSelectedFunctionDerivative} from '../../src/js/semantics/compile-selected-function-derivative.js';
import {binderIdentity} from '../../src/js/semantics/identity.js';
import {functionValue,expression} from '../../src/js/values/value.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
const js=readFileSync(new URL('../browser/p0021-function-derivative-worker-smoke.mjs',import.meta.url),'utf8');
const html=readFileSync(new URL('../browser/p0021-function-derivative-worker-smoke.html',import.meta.url),'utf8');
const rev='slice35-function-derivative-v1';
test('browser fixture uses actual Worker transport and selected derivative compiler',()=>{
 assert.match(js,/compileSelectedFunctionDerivative\(/);
 assert.match(js,/createWorkerEvaluationClient\(/);
 assert.match(js,/new Worker\(/);
 assert.match(js,/client\.evaluate\(env,selection\)/);
 assert.doesNotMatch(js,/mockWorker|fakePyodide|evaluateSelected\s*:/);
});
test('browser revision is versioned at html and Worker URLs',()=>{
 assert.ok(html.includes(rev));assert.ok(js.includes('selected-pyodide-worker.js?v='+rev));
 assert.ok(html.includes('p0021-function-derivative-worker-smoke.mjs?v='+rev));
});
test('fixture tests original lexical binder and mathematical values',()=>{
 assert.match(js,/binderIdentity\(/);assert.match(js,/symbolRef/);
 assert.match(js,/436n/);assert.match(js,/JSON\.stringify\(node\.identity\)/);
});
test('real compiler produces selected differentiation request retaining binder',()=>{
 const identity=binderIdentity('slice35:local','x');const ref={op:'symbolRef',identity};
 const fn=functionValue([{identity}],expression({op:'pow',base:ref,exponent:{op:'integer',value:'3'}}),[]);
 const envelope={protocol:'newcas.semantic-evaluation.v1',revision:'r35',blockId:'b',taskScopeId:'t',source:'f',providers:[]};
 const spec=operationSpec({operationId:'diff',evaluatorId:'probe.symbolic.diff',arguments:[{name:'expression',role:'value'},{name:'variable',role:'symbolic'}]});
 const s=compileSelectedFunctionDerivative({fn,envelope,spec});
 assert.deepEqual(s.evaluationRequest.inputs[1].data.expr,ref);assert.equal(s.evaluationRequest.evaluatorId,'probe.symbolic.diff');
});
