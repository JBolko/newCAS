import {proveExactRootTransport,runPopulationStatisticsCases} from '../helpers/s100e-statistics-cases.mjs';
import {createWorkerEvaluationClient} from '../../src/js/evaluation/worker-evaluation-protocol.js';
const worker=new Worker(new URL('../../src/js/evaluation/selected-pyodide-worker.js',import.meta.url),{type:'module'});
let revision;
const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=>revision,supervision:{timeoutMs:180000,maxPending:1}});
const evaluate=(env,selection)=>{revision=env.revision;return client.evaluate(env,selection);};
try{
  const gate=await proveExactRootTransport(evaluate);
  window.s100eResult=new URLSearchParams(location.search).has('gate-only')
    ? {pass:1,fail:0,todo:0,skip:0,requests:1,results:[gate]}
    : {...await runPopulationStatisticsCases(evaluate),gate};
}catch(error){window.s100eResult={fail:1,error:String(error.stack??error)};}
finally{client.close();worker.terminate();document.getElementById('result').textContent=JSON.stringify(window.s100eResult,null,2);}
