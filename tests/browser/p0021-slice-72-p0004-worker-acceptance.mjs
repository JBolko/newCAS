/** Slice 72: manual real-browser acceptance for P0004 and the selected Worker. */
import {createWorkerEvaluationClient} from '../../src/js/evaluation/worker-evaluation-protocol.js';
import {makeSelectedCase,isExactInteger} from './p0021-selected-worker-cases.mjs';

const CDN='https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';
const run=document.getElementById('run');
const status=document.getElementById('status');
const output=document.getElementById('output');
const write=s=>{output.textContent+=`${s}\n`;};
const deadline=(ms,label)=>{
  let id;
  const promise=new Promise((_,reject)=>{id=setTimeout(()=>reject(new Error(`${label}: timeout (${ms} ms)`)),ms);});
  return {promise,clear:()=>clearTimeout(id)};
};
const within=async(promise,ms,label)=>{
  const timer=deadline(ms,label);
  try{return await Promise.race([promise,timer.promise]);}finally{timer.clear();}
};

run.addEventListener('click',async()=>{
  run.disabled=true;output.textContent='';status.className='pending';status.textContent='Arbejder…';
  let worker,client,workerError;
  try{
    write('1. Faktiske versioner i separat Pyodide-instans');
    // This probe is independent of the new Worker; it tests the selected CDN package itself.
    const versions=await within((async()=>{
      const {loadPyodide}=await import(`${CDN}pyodide.mjs`);
      const py=await loadPyodide({indexURL:CDN});
      await py.loadPackage('sympy');
      const details=JSON.parse(await py.runPythonAsync(`import json,sys,sympy\njson.dumps({'python':list(sys.version_info[:3]),'sympy':sympy.__version__})`));
      return {pyodide:py.version,...details};
    })(),180000,'Pyodide/SymPy-start');
    write(JSON.stringify(versions));
    if(versions.pyodide!=='314.0.7'||versions.sympy!=='1.14.0'||JSON.stringify(versions.python)!=='[3,14,2]')
      throw new Error('FAIL: faktisk indlæste versioner afviger fra P0004');
    write('PASS: Pyodide 314.0.7 / Python 3.14.2 / SymPy 1.14.0');

    write('2. Opretter den nye selected Pyodide Worker');
    worker=new Worker(new URL('../../src/js/evaluation/selected-pyodide-worker.js',import.meta.url),{type:'module'});
    workerError=e=>write(`WORKER ERROR: ${e.message??'ukendt fejl'}`);
    worker.addEventListener('error',workerError);
    const revision='slice-72-acceptance';
    client=createWorkerEvaluationClient({worker,getCurrentRevision:()=>revision});
    const literal=makeSelectedCase({revision});
    const first=await within(client.evaluate(literal.envelope,literal.selection),180000,'Første Worker-kald');
    if(!isExactInteger(first,5))throw new Error(`2+3 gav forkert resultat: ${JSON.stringify(first)}`);
    write('PASS: ny Worker udfører 2+3 = 5 gennem valgt Semantic IR/OperationSpec');

    const provider=makeSelectedCase({revision,kind:'provider'});
    const second=await within(client.evaluate(provider.envelope,provider.selection),60000,'Provider-Worker-kald');
    if(!isExactInteger(second,7))throw new Error(`a+3 gav forkert resultat: ${JSON.stringify(second)}`);
    write('PASS: attesteret provider a=4 giver a+3 = 7');

    const altered=structuredClone(provider.selection);
    altered.providerIds[0].providerId='wrong-writer';
    const third=await within(client.evaluate(provider.envelope,altered),60000,'Tamper-Worker-kald');
    if(third?.status!=='failure')throw new Error(`Manipuleret provider blev ikke afvist: ${JSON.stringify(third)}`);
    write('PASS: forkert provider-identitet afvises');
    status.className='pass';status.textContent='PASS — versioner og tre ægte Worker-integrationstests';
  }catch(error){
    status.className='fail';status.textContent='FAIL — se log og browserens Console/Network';
    write(`FEJL: ${error?.stack??error}`);
  }finally{
    try{client?.close();}finally{if(workerError)worker?.removeEventListener('error',workerError);worker?.terminate();run.disabled=false;}
  }
});
