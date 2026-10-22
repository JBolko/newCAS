import {runFrequencyCases} from '../helpers/s100i-frequency-cases.mjs';
import {runQuartileCases} from '../helpers/s100h-quartiles-cases.mjs';
import {runOrderStatisticsCases} from '../helpers/s100g-order-statistics-cases.mjs';
import {runPopulationStatisticsCases} from '../helpers/s100e-statistics-cases.mjs';
import {runSampleStatisticsCases} from '../helpers/s100f-sample-statistics-cases.mjs';
import {createWorkerEvaluationClient} from '../../src/js/evaluation/worker-evaluation-protocol.js';
const worker=new Worker(new URL('../../src/js/evaluation/selected-pyodide-worker.js',import.meta.url),{type:'module'});
let revision;
const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=>revision,supervision:{timeoutMs:180000,maxPending:1}});
const evaluate=(env,selection)=>{revision=env.revision;return client.evaluate(env,selection);};
try{
  const s100i=await runFrequencyCases(evaluate),s100h=await runQuartileCases(evaluate),s100g=await runOrderStatisticsCases(evaluate),
    s100e=await runPopulationStatisticsCases(evaluate),s100f=await runSampleStatisticsCases(evaluate);
  window.s100iResult={pass:s100i.pass+s100h.pass+s100g.pass+s100e.pass+s100f.pass,fail:0,s100i,s100h,s100g,s100e,s100f};
}catch(error){window.s100iResult={fail:1,error:String(error.stack??error)};}
finally{client.close();worker.terminate();document.getElementById('result').textContent=JSON.stringify(window.s100iResult);}
