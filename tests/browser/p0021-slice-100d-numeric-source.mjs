import {runNumericSourceCases} from '../helpers/s100d-numeric-source-cases.mjs';
import {createWorkerEvaluationClient} from '../../src/js/evaluation/worker-evaluation-protocol.js';
const worker=new Worker(new URL('../../src/js/evaluation/selected-pyodide-worker.js',import.meta.url),{type:'module'});
let revision;
const client=createWorkerEvaluationClient({worker,getCurrentRevision:()=>revision,supervision:{timeoutMs:180000,maxPending:1}});
try{window.s100dResult=await runNumericSourceCases((env,selection)=>{revision=env.revision;return client.evaluate(env,selection);});}
catch(error){window.s100dResult={fail:1,error:String(error.stack??error)};}
finally{client.close();worker.terminate();document.getElementById('result').textContent=JSON.stringify(window.s100dResult,null,2);}
