/** Browser-only smoke: genuine Worker + genuine Pyodide/SymPy. */
import { createWorkerEvaluationClient } from '../../src/js/evaluation/worker-evaluation-protocol.js';
import { makeSelectedCase, isExactInteger } from './p0021-selected-worker-cases.mjs';
const runButton = document.getElementById('run');
const status = document.getElementById('status');
const log = document.getElementById('log');
const write = message => { log.textContent += `${message}\n`; };
const TIMEOUT_MS = 120000; // browser smoke only; not an execution cancellation mechanism
runButton.addEventListener('click', async () => {
  runButton.disabled = true; log.textContent = ''; status.textContent = 'Starter Web Worker og indlæser Pyodide/SymPy…';
  status.className = '';
  const worker = new Worker(new URL('../../src/js/evaluation/selected-pyodide-worker.js', import.meta.url), {type:'module'});
  const revision = 'smoke-1';
  const client = createWorkerEvaluationClient({worker,getCurrentRevision:()=>revision});
  const onError = event => write(`Worker-fejl: ${event.message ?? 'ukendt fejl'}`);
  worker.addEventListener('error',onError);
  let timeoutId;
  const deadline = new Promise((_,reject)=> {timeoutId=setTimeout(()=>reject(Error('Timeout ved Worker/Pyodide-init (120 s)')),TIMEOUT_MS);});
  try {
    const run = async () => {
      const a = makeSelectedCase({revision});
      write('Tester Semantic IR → OperationSpec → Worker → SymPy: 2+3');
      const actual = await client.evaluate(a.envelope,a.selection);
      if (!isExactInteger(actual,5)) throw Error(`Forkert resultat: ${JSON.stringify(actual)}`);
      write('PASS: 2+3 = 5, exact ExpressionValue');
      const b = makeSelectedCase({revision,kind:'provider'});
      write('Tester samme vej med præcis provider-identitet: a=4; a+3');
      const actual2 = await client.evaluate(b.envelope,b.selection);
      if (!isExactInteger(actual2,7)) throw Error(`Forkert provider-resultat: ${JSON.stringify(actual2)}`);
      write('PASS: 4+3 = 7 med provider writer-a');
      const corrupted = makeSelectedCase({revision,kind:'provider'});
      // JSON clone, since compiler selection is immutable.
      const altered = structuredClone(corrupted.selection);
      altered.providerIds[0].providerId='wrong-writer';
      write('Tester at Python afviser ændret provider-attestation');
      const refused = await client.evaluate(corrupted.envelope,altered);
      if (refused.status !== 'failure') throw Error('Tampered provider blev ikke afvist');
      write(`PASS: ændret provider afvist (${refused.code ?? 'failure'})`);
    };
    await Promise.race([run(),deadline]);
    status.className='pass';status.textContent='PASS — tre browser-integrationstjek, herunder rigtig SymPy-beregning.';
  } catch(error) {
    status.className='fail';status.textContent='FAIL — se log og browserens Developer Tools';
    write(`FEJL: ${error?.stack ?? error}`);
  } finally {
    clearTimeout(timeoutId);client.close();worker.removeEventListener('error',onError);worker.terminate();runButton.disabled=false;
  }
});
