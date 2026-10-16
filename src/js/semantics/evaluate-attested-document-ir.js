/** P0021 Slice 74 — execute resolver-attested document IR, without source-AST traversal.
 * Provider identity is selected before invocation by P0020/Slice73; neither
 * operation selection nor function invocation may resolve a source name.
 * This is a reusable evaluation primitive; runtime batch wiring is later.
 */
import {isSemanticIRNode,call,operationReference,valueLiteral} from './semantic-ir.js';
import {evaluateNestedSelectedCalls} from './evaluate-nested-selected-calls.js';
import {isValue} from '../values/value.js';
const fail = reason => {throw new TypeError(`P0021 attested IR execution: ${reason}`);};
export async function evaluateAttestedDocumentIR({ir,envelope,specs,evaluate,applyFunction}={}) {
  if(!isSemanticIRNode(ir) || !envelope || !Array.isArray(envelope.providers) ||
     !(specs instanceof Map) || typeof evaluate!=='function' || typeof applyFunction!=='function')
    fail('IR, gateway envelope, operation map, and both evaluators required');
  if(ir.kind==='define' && ir.writerId!==envelope.blockId)fail('writer identity mismatch');
  const providers=new Map();
  for(const p of envelope.providers){
    if(!p || typeof p.providerId!=='string' || !p.providerId || providers.has(p.providerId) || !isValue(p.value))
      fail('invalid or duplicate provider');
    providers.set(p.providerId,p.value);
  }
  const seen=new Set();
  const visit=async node=>{
    if(!isSemanticIRNode(node))fail('invalid recursive IR');
    switch(node.kind){
      case 'value':if(!isValue(node.value))fail('invalid literal Value');return node.value;
      case 'provider-reference':{
        if(!providers.has(node.providerId))fail('unknown provider identity');
        seen.add(node.providerId);return providers.get(node.providerId);
      }
      case 'call':{
        const callee=node.callee;
        if(callee?.kind!=='provider-reference' && callee?.kind!=='operation-reference')fail('unselected callee');
        const args=[];
        for(const arg of node.args)args.push(await visit(arg));
        if(callee.kind==='provider-reference'){
          const fn=await visit(callee);
          if(fn.kind!=='function')fail('provider is not callable');
          const result=await applyFunction({fn,args,envelope:{...envelope,providers:[]},specs,evaluate});
          if(!isValue(result))fail('invalid function result');
          return result;
        }
        if(!specs.has(callee.operationId))fail('unselected operation');
        const selected=call(operationReference(callee.operationId),args.map(valueLiteral));
        const result=await evaluateNestedSelectedCalls({ir:selected,envelope:{...envelope,providers:[]},specs,evaluate});
        if(!isValue(result))fail('invalid operation result');
        return result;
      }
      default:fail(`unsupported IR node ${node.kind}`);
    }
  };
  const result=await visit(ir.kind==='define'?ir.body:ir);
  if(seen.size!==providers.size)fail('unused provider');
  return result;
}
