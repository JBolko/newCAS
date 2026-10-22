import {runPopulationStatisticsCases} from '../helpers/s100e-statistics-cases.mjs';
import {runSampleStatisticsCases} from '../helpers/s100f-sample-statistics-cases.mjs';
import {createWorkerEvaluationClient} from '../../src/js/evaluation/worker-evaluation-protocol.js';
const worker=new Worker(new URL('../../src/js/evaluation/selected-pyodide-worker.js',import.meta.url),{type:'module'});
let revision;
const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=>revision,supervision:{timeoutMs:180000,maxPending:1}});
const evaluate=(env,selection)=>{revision=env.revision;return client.evaluate(env,selection);};
try{
  const populationRegression=await runPopulationStatisticsCases(evaluate);
  window.s100fResult={...await runSampleStatisticsCases(evaluate),populationRegression};
}catch(error){window.s100fResult={fail:1,error:String(error.stack??error)};}
finally{client.close();worker.terminate();document.getElementById('result').textContent=JSON.stringify(window.s100fResult,null,2);}
