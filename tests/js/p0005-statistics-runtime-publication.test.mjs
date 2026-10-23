import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {decodeValue} from '../../src/js/values/value.js';
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {runValueRuntimeCases} from '../helpers/s100m2-transport-cases.mjs';
const fixtures=JSON.parse(readFileSync(new URL('../fixtures/statistics-value-v2.json',import.meta.url),'utf8'));
const python='import json,sys\nfrom src.python.evaluator.selected_gateway_bridge import evaluate_selected_gateway\nfrom src.python.evaluator.container_list import evaluate_list_request\np=json.load(sys.stdin)\nprint(json.dumps(evaluate_selected_gateway(p["envelope"],p["selection"],evaluate_list_request)))';
test('S100m2 generic runtime publishes v2, binds providers, invalidates and rejects stale generations',async()=>{
  const result=await runValueRuntimeCases(async(envelope,selection)=>{
    const child=spawnSync('python',['-c',python],{input:JSON.stringify({envelope,selection}),encoding:'utf8'});
    assert.equal(child.status,0,child.stderr);
    const out=JSON.parse(child.stdout);if(out.status==='success')out.value=decodeValue(JSON.stringify(out.value));return out;
  },fixtures);
  assert.equal(result.fail,0);assert.equal(result.pass,3);assert(result.requests>=7);
});
test('S100m2 generic runtime refuses an entire malformed success batch before publication',async()=>{
  const doc=DocumentRuntime.createSemantic('malformed-batch');
  doc.addBlock({id:'a',type:'formula',source:'A:=1',taskId:'T'});doc.addBlock({id:'b',type:'formula',source:'list(A)',taskId:'T'});
  const good=decodeValue(JSON.stringify(fixtures[0].value));
  const bad=structuredClone(fixtures[0].value);bad.data.variant='unknown';
  await assert.rejects(doc.evaluateAndCommitSemanticTask('T',{revision:'r',getCurrentRevision:()=> 'r',evaluate:async env=>({blockId:env.blockId,status:'success',value:env.blockId==='a'?good:bad})}),/invalid semantic Value/);
  assert.equal(doc.getBlock('a').calculation.result,null);assert.equal(doc.getBlock('b').calculation.result,null);
});
