import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeSelectedCase,isExactInteger} from '../browser/p0021-selected-worker-cases.mjs';
const read = name=>readFileSync(new URL(name,import.meta.url),'utf8');
test('Slice 13 literal fixture uses actual Semantic IR compiler and selected evaluator',()=>{
 const v=makeSelectedCase();assert.equal(v.selection.evaluationRequest.evaluatorId,'probe.scalar.add');
 assert.deepEqual(v.selection.evaluationRequest.inputs.map(x=>x.data.expr.value),['2','3']);
});
test('Slice 13 provider fixture preserves specific provider identity',()=>{
 const v=makeSelectedCase({kind:'provider'});assert.equal(v.envelope.providers[0].providerId,'writer-a');
 assert.deepEqual(v.selection.providerIds,[{name:'a',providerId:'writer-a'}]);
});
test('Slice 13 exact result assertion rejects incorrect mathematics',()=>{
 const ok={blockId:'b',status:'success',value:{valueVersion:1,kind:'expression',data:{expr:{op:'integer',value:'5'}}}};
 assert.equal(isExactInteger(ok,5),true);assert.equal(isExactInteger(ok,6),false);
 assert.equal(isExactInteger({...ok,status:'failure'},5),false);
});
test('Slice 13 browser page actually loads module and provides manual run control',()=>{
 const html=read('../browser/p0021-selected-worker-smoke.html');
 assert.match(html,/type="module" src="\.\/p0021-selected-worker-smoke\.mjs"/);
 assert.match(html,/id="run"/);
});
test('Slice 13 smoke uses real module Worker, not a mocked evaluator',()=>{
 const code=read('../browser/p0021-selected-worker-smoke.mjs');
 assert.match(code,/new Worker\(/);assert.match(code,/selected-pyodide-worker\.js/);
 assert.match(code,/client\.evaluate\(/);assert.doesNotMatch(code,/MockWorker|fakePyodide/);
});
