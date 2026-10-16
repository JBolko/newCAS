/** P0021 S82: manual browser proof against the actual DocumentRuntime IR batch.
 * This intentionally tests selected-operation semantics with a deterministic JS
 * backend; it is NOT proof of full Python execution for nested source functions.
 */
import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {parse} from '../../src/js/parser.mjs';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {expression} from '../../src/js/values/value.js';
import {createRuntimeFunctionBatchEvaluator} from '../../src/js/semantics/create-runtime-function-batch-evaluator.js';

const runButton=document.querySelector('#run');
const status=document.querySelector('#status');
const log=document.querySelector('#log');
const write=s=>{log.textContent+=`${s}\n`;};
const assert=(condition,label)=>{if(!condition)throw new Error(`FAIL: ${label}`);write(`PASS: ${label}`);};
const integer=n=>expression({op:'integer',value:String(n)});
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({
  operationId:id,evaluatorId:`probe.scalar.${id}`,
  arguments:[{name:'a',role:'value'},{name:'b',role:'value'}],
})]));
let operations=0;
const evaluate=async (_envelope,selected)=>{
  operations++;
  const [a,b]=selected.evaluationRequest.inputs.map(v=>BigInt(v.data.expr.value));
  const id=selected.evaluationRequest.evaluatorId;
  if(!['probe.scalar.add','probe.scalar.multiply','probe.scalar.power'].includes(id))
    throw new Error(`Unexpected selected operation ${id}`);
  return {blockId:selected.blockId,status:'success',value:integer(
    id.endsWith('.power')?a**b:id.endsWith('.multiply')?a*b:a+b)};
};
function task(rt,id,a){
  for(const [suffix,source] of [
    ['a',`a:=${a}`],['f','f(t):=t^2+a'],['g','g(t):=3t'],
    ['result','f(g(4))'],['assigned','answer:=f(g(4))+1'],['read','answer'],
  ]) rt.addBlock({id:`${id}-${suffix}`,taskId:id,type:'formula',source});
}
const value=(rt,id)=>rt.getBlock(id).calculation.result?.data?.expr?.value;
async function calculate(rt,id,revision){
  const {snapshot}=rt.deriveSemanticTask(id);
  const exec=createRuntimeFunctionBatchEvaluator({snapshot,parse,specs,evaluate,revision});
  return rt.evaluateAndCommitSemanticTask(id,{
    revision,getCurrentRevision:()=>revision,evaluate:exec,
  });
}
runButton.addEventListener('click',async()=>{
  runButton.disabled=true;log.textContent='';status.textContent='Kører…';status.className='pending';
  try{
    const rt=new DocumentRuntime({calculate:async()=>{throw Error('Legacy CASEngine invoked');}},'slice82');
    task(rt,'A',2);task(rt,'B',10);
    assert((await calculate(rt,'A','r1')).kind==='complete','A beregnes gennem aktiv DocumentRuntime-batch');
    assert(value(rt,'A-result')==='146'&&value(rt,'A-read')==='147','A: f(g(4))=146 og assignment=147');
    assert((await calculate(rt,'B','r1')).kind==='complete','B beregnes uafhængigt');
    assert(value(rt,'B-result')==='154'&&value(rt,'B-read')==='155','B: samme navne, andre providers giver 154 og 155');
    const preserved=value(rt,'B-read');
    rt.setBlockSource('A-a','a:=5');
    assert((await calculate(rt,'A','r2')).kind==='complete','Ændret capture genberegnes');
    assert(value(rt,'A-result')==='149'&&value(rt,'A-read')==='150','A: capture ændret til 5 → 149 og 150');
    assert(value(rt,'B-read')===preserved,'B-resultat ikke påvirket af A');
    assert(operations>0,'Attesterede OperationSpecs blev kaldt');
    write('Bemærk: aritmetisk backend er en JS-testdouble. Denne prøve tester ikke Python-Worker-kæden.');
    status.textContent='PASS — aktiv IR-browserintegration';status.className='pass';
  }catch(error){status.textContent='FAIL — se log';status.className='fail';write(String(error?.stack??error));}
  finally{runButton.disabled=false;}
});
