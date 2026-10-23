import {createWorkerEvaluationClient} from '../../src/js/evaluation/worker-evaluation-protocol.js';
import {runValueTransportCases,runValueRuntimeCases} from '../helpers/s100m2-transport-cases.mjs';
const fixtures=await(await fetch('../fixtures/statistics-value-v2.json')).json();
const worker=new Worker(new URL('../../src/js/evaluation/selected-pyodide-worker.js',import.meta.url),{type:'module'});
let revision,workerCalls=0;
const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=>revision,supervision:{timeoutMs:180000,maxPending:1}});
const evaluate=(env,selection)=>{revision=env.revision;workerCalls++;return client.evaluate(env,selection);};
try{
  const transport=await runValueTransportCases(evaluate,fixtures),runtime=await runValueRuntimeCases(evaluate,fixtures);
  window.s100m2Result={pass:transport.pass+runtime.pass,fail:0,workerCalls,transport,runtime};
}catch(error){window.s100m2Result={fail:1,workerCalls,error:String(error.stack??error)};}
finally{client.close();worker.terminate();document.getElementById('result').textContent=JSON.stringify(window.s100m2Result);}
