/** S94e browser-only arithmetic fixture; NOT the Pyodide backend.
 * Real Web Worker exercises actual message transport and lifecycle.
 * Only preselected add/multiply/power inputs are accepted; no source parsing.
 */
import {expression} from '../../src/js/values/value.js';
import {PROTOCOL} from '../../src/js/evaluation/worker-evaluation-protocol.js';
self.addEventListener('message',event=>{
  const msg=event.data;
  if (msg?.protocol!==PROTOCOL || msg.kind!=='evaluate') return;
  if (self.name==='hang') return;
  const base={protocol:PROTOCOL,kind:'result',requestId:msg.requestId,
    revision:msg.revision,blockId:msg.blockId};
  const fail=code=>self.postMessage({...base,outcome:{blockId:msg.blockId,
    status:'failure',code,message:code}});
  const sel=msg.selection;
  const operation=sel?.operationSpec?.operationId;
  const values=sel?.evaluationRequest?.inputs;
  if(!['add','multiply','power'].includes(operation) || !Array.isArray(values) || values.length!==2 ||
     values.some(v=>v?.kind!=='expression'||v?.data?.expr?.op!=='integer')){
    fail('INVALID_TEST_SELECTION');return;
  }
  const [a,b]=values.map(v=>BigInt(v.data.expr.value));
  const result=operation==='add'?a+b:operation==='multiply'?a*b:a**b;
  self.postMessage({...base,outcome:{blockId:msg.blockId,status:'success',
    value:expression({op:'integer',value:String(result)})}});
});
