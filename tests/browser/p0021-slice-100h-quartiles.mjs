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
  const h=await runQuartileCases(evaluate);
  const g=await runOrderStatisticsCases(evaluate);
  const e=await runPopulationStatisticsCases(evaluate);
  const f=await runSampleStatisticsCases(evaluate);
  window.s100hResult={pass:h.pass+g.pass+e.pass+f.pass,fail:0,s100h:h,s100g:g,s100e:e,s100f:f};
}catch(error){window.s100hResult={fail:1,error:String(error.stack??error)};}
finally{client.close();worker.terminate();document.getElementById('result').textContent=JSON.stringify(window.s100hResult);}
