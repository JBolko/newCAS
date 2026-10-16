/** P0021 Slice 73: lower one P0020-attested document expression to Semantic IR.
 * This is COMPILATION ONLY: no evaluator, provider lookup, task state or fallback.
 * Repeated callable occurrences intentionally share the attested name/provider.
 */
import {expression} from '../values/value.js';
import {isOperationSpec} from '../operations/operation-spec.js';
import {valueLiteral,providerReference,operationReference,call,define} from './semantic-ir.js';

const fail = m => {throw new TypeError(`P0021 attested IR: ${m}`);};
const operators = Object.freeze({'+':'add','*':'multiply'});
export function compileAttestedDocumentExpressionIR(statement,{entry,blockId,specs,writers=[]}={}) {
  if (!entry || !Array.isArray(entry.references) || !Array.isArray(entry.calls) ||
      !(specs instanceof Map) || typeof blockId!=='string' || !blockId) fail('attested entry, block identity and specs required');
  if (entry.parseError!==null && entry.parseError!==undefined) fail('invalid source');
  const reads = new Map(), callables = new Map();
  for(const ref of entry.references){
    if(ref.binding?.kind!=='provider-reference' || typeof ref.binding.providerId!=='string' || !ref.binding.providerId)fail('unresolved read');
    if(reads.has(ref.name) && reads.get(ref.name)!==ref.binding.providerId)fail('conflicting reads');
    reads.set(ref.name,ref.binding.providerId);
  }
  for(const item of entry.calls){
    if(item.classification!=='document-writer' || item.candidates?.length!==1 ||
        item.candidates[0]!=='document-writer' || typeof item.providerId!=='string' || !item.providerId)
      fail('unresolved callable');
    if(callables.has(item.name) && callables.get(item.name)!==item.providerId)fail('conflicting calls');
    if(reads.has(item.name) && reads.get(item.name)!==item.providerId)fail('conflicting read/call');
    callables.set(item.name,item.providerId);
  }
  const selected=(name,args)=>{
    const spec=specs.get(name);
    if(!isOperationSpec(spec) || spec.operationId!==name ||
        spec.arguments?.length!==args.length || spec.arguments.some(a=>a.role!=='value'))fail(`unsupported operation ${name}`);
    return call(operationReference(name),args);
  };
  const lit=n=>valueLiteral(expression({op:'integer',value:String(n)}));
  const neg=n=>selected('multiply',[lit(-1),n]);
  const seenCalls=new Set(), seenReads=new Set();
  const visit=n=>{
    if(!n || typeof n!=='object')fail('invalid node');
    switch(n.type){
      case 'Literal':if(!Number.isSafeInteger(n.value) || n.value<0)fail('only nonnegative integer literals');return lit(n.value);
      case 'Variable':{
        if(!reads.has(n.name))fail(`unattested variable ${n.name}`);
        seenReads.add(n.name);return providerReference(reads.get(n.name));
      }
      case 'FunctionCall':{
        if(!callables.has(n.name) || !Array.isArray(n.args))fail(`unattested callable ${n.name}`);
        seenCalls.add(n.name);return call(providerReference(callables.get(n.name)),n.args.map(visit));
      }
      case 'UnaryExpression':if(n.op!=='-')fail('unsupported unary operator');return neg(visit(n.argument));
      case 'PowerExpression':return selected('power',[visit(n.base),visit(n.exponent)]);
      case 'BinaryExpression':{
        const lhs=visit(n.left),rhs=visit(n.right);
        if(operators[n.op])return selected(operators[n.op],[lhs,rhs]);
        if(n.op==='-')return selected('add',[lhs,neg(rhs)]);
        if(n.op==='/')return selected('multiply',[lhs,selected('power',[rhs,lit(-1)])]);
        fail('unsupported binary operator');
      }
      default:fail(`unsupported node ${n.type}`);
    }
  };
  if(!statement || typeof statement!=='object')fail('statement required');
  let result;
  if(statement.type==='Assignment'){
    if(!Array.isArray(writers) || !writers.some(w=>w.writerId===blockId && w.name===statement.name))
      fail('unattested writer');
    result=define(blockId,visit(statement.value));
  } else result=visit(statement);
  if(seenCalls.size!==callables.size || seenReads.size!==reads.size)fail('unconsumed attestations');
  return result;
}
