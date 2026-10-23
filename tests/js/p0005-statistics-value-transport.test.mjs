import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorkerEvaluationClient,createWorkerEvaluationHandler,PROTOCOL} from '../../src/js/evaluation/worker-evaluation-protocol.js';
import {createSelectedPyodideRuntime} from '../../src/js/evaluation/selected-pyodide-runtime.js';
import {expression,listV2,decodeValue,encodeValue,isValue} from '../../src/js/values/value.js';
const fixtures=JSON.parse(readFileSync(new URL('../fixtures/statistics-value-v2.json',import.meta.url),'utf8'));
const group=()=>structuredClone(fixtures[0].value);
function payload(inputs=[group()],providers=[]) {
  const envelope={protocol:'newcas.semantic-evaluation.v1',revision:'r1',blockId:'b',taskScopeId:'T',source:'list(A)',providers};
  return {envelope,selection:{revision:'r1',blockId:'b',taskScopeId:'T',source:envelope.source,
    providerIds:providers.map(({name,providerId})=>({name,providerId})),
    evaluationRequest:{evaluationRequestVersion:1,evaluatorId:'probe.container.list',inputs,instruction:{},options:{}},
    operationSpec:{operationSpecVersion:1,operationId:'list',evaluatorId:'probe.container.list',signatures:[{arguments:[{name:'item',role:'value',variadic:true}]}]}}};
}
function harness(evaluateSelected=async env=>({blockId:env.blockId,status:'success',value:expression({op:'integer',value:'1'})})) {
  const sent=[],listeners=new Set();
  const handler=createWorkerEvaluationHandler({evaluateSelected,postMessage:m=>listeners.forEach(fn=>fn({data:structuredClone(m)}))});
  const worker={postMessage:m=>{sent.push(m);queueMicrotask(()=>handler({data:structuredClone(m)}));},addEventListener:(type,fn)=>{if(type==='message')listeners.add(fn);},removeEventListener:(type,fn)=>listeners.delete(fn)};
  return {sent,client:createWorkerEvaluationClient({worker,getCurrentRevision:()=> 'r1'}),deliver:m=>listeners.forEach(fn=>fn({data:m}))};
}
for(const location of ['input','provider']) test(`S100m2 validates typed ${location} before dispatch`,async()=>{
  const bad=group();bad.data.classes[0].count.data.expr.value='-1';
  const p=payload(location==='input'?[bad]:[],location==='provider'?[{name:'A',providerId:'a',value:bad}]:[]);
  const h=harness();try{
    const out=await h.client.evaluate(p.envelope,p.selection);
    assert.equal(out.code,'invalid-value-encoding');assert.equal(out.status,'failure');assert.equal(h.sent.length,0);
  }finally{h.client.close();}
});
test('S100m2 Worker ingress independently rejects invalid Values',async()=>{
  const p=payload();p.selection.evaluationRequest.inputs[0].data.variant='unknown';
  const messages=[];let calls=0;
  const handler=createWorkerEvaluationHandler({evaluateSelected:async()=>{calls++;},postMessage:m=>messages.push(m)});
  await handler({data:{protocol:PROTOCOL,kind:'evaluate',requestId:'x',revision:'r1',blockId:'b',...p}});
  assert.equal(calls,0);assert.equal(messages[0].outcome.code,'unsupported-value-encoding');
  assert.equal(messages[0].outcome.diagnostic.code,messages[0].outcome.code);
});
test('S100m2 deep materialized v2 is budgeted before JSON protocol snapshot',async()=>{
  let raw=group();for(let i=0;i<2000;i++)raw={valueVersion:2,kind:'list',data:{items:[raw]}};
  const h=harness();try{const p=payload([raw]);const out=await h.client.evaluate(p.envelope,p.selection);
    assert.equal(out.code,'value-codec-resource-limit');assert.equal(h.sent.length,0);
  }finally{h.client.close();}
});
test('S100m2 response rehydrates v2 with canonical metadata and deep immutability',async()=>{
  const raw=decodeValue(JSON.stringify(fixtures.find(f=>f.name==='derived-result').value));
  const h=harness(async env=>({blockId:env.blockId,status:'success',value:listV2([raw])}));
  try{const p=payload();const out=await h.client.evaluate(p.envelope,p.selection);
    assert(isValue(out.value));assert(Object.isFrozen(out.value.data.items[0].data.provenance.inputs));
    assert.equal(encodeValue(out.value.data.items[0]),encodeValue(raw));
  }finally{h.client.close();}
});
test('S100m2 invalid response still rejects INVALID_WORKER_VALUE with no extra parameters',async()=>{
  const h=harness(()=>new Promise(()=>{}));const p=payload();
  try{const pending=h.client.evaluate(p.envelope,p.selection);
    h.deliver({protocol:PROTOCOL,kind:'result',requestId:'evaluation-1',revision:'r1',blockId:'b',outcome:{blockId:'b',status:'success',value:{valueVersion:99,kind:'list',data:{items:[]}}}});
    await assert.rejects(pending,error=>error.code==='INVALID_WORKER_VALUE'&&error.diagnostic.code===error.code&&Object.keys(error.diagnostic.parameters).length===0);
  }finally{h.client.close();}
});
test('S100m2 oversized response is refused before JSON snapshot and never becomes a success',async()=>{
  let raw=group();for(let i=0;i<2000;i++)raw={valueVersion:2,kind:'list',data:{items:[raw]}};
  const h=harness(()=>new Promise(()=>{}));const p=payload();
  try{const pending=h.client.evaluate(p.envelope,p.selection);
    h.deliver({protocol:PROTOCOL,kind:'result',requestId:'evaluation-1',revision:'r1',blockId:'b',outcome:{blockId:'b',status:'success',value:raw}});
    await assert.rejects(pending,e=>e.code==='INVALID_WORKER_VALUE'&&e.diagnostic.code===e.code);
  }finally{h.client.close();}
});
test('S100m2 arbitrary backend exceptions are not reclassified as trusted codec failures',async()=>{
  const h=harness(async()=>{const error=new Error('invalid-value-encoding');error.diagnostic={diagnosticVersion:1,code:'invalid-value-encoding',parameters:{path:'/',reason:'leaf-shape'}};throw error;});
  try{const p=payload();const out=await h.client.evaluate(p.envelope,p.selection);assert.equal(out.code,'WORKER_EVALUATION_ERROR');assert.equal(out.diagnostic,undefined);}finally{h.client.close();}
});
test('S100m2 options data is not recursively interpreted as Value fields',async()=>{
  const p=payload();p.selection.evaluationRequest.options={opaque:{valueVersion:99}};
  const h=harness();try{assert.equal((await h.client.evaluate(p.envelope,p.selection)).status,'success');}finally{h.client.close();}
});
test('S100m2 Pyodide bootstrap installs the existing Python codec',async()=>{
  const written=[];const py={loadPackage:async()=>{},FS:{mkdirTree(){},writeFile:path=>written.push(path)},runPythonAsync:async()=>{},globals:{set(){},delete(){}}};
  const runtime=createSelectedPyodideRuntime({indexURL:'https://example.invalid/',loadPyodide:async()=>py,fetchText:async()=>''});
  await runtime.init();assert(written.includes('/newcas/src/python/adapters/statistics_value_adapter.py'));
});
test('S100m2 direct Pyodide Value ingress rejects before loading Python',async()=>{
  let loads=0;const runtime=createSelectedPyodideRuntime({indexURL:'test/',loadPyodide:async()=>{loads++;throw Error('must not load');},fetchText:async()=>''});
  const p=payload();p.selection.evaluationRequest.inputs[0].data.variant='unknown';
  await assert.rejects(runtime.evaluateSelected(p.envelope,p.selection),e=>e.diagnostic?.code==='unsupported-value-encoding');
  assert.equal(loads,0);
});
