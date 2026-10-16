/** P0021 Slice 66 — nested source expressions using P0020's attested bindings.
 * No callable name lookup, Python task scope or persistent registry.
 */
import {createValueEvaluator} from './create-value-evaluator.js';
import {evaluateSelectedFunctionApplication} from './evaluate-selected-function-application.js';
import {evaluateNestedSelectedCalls} from './evaluate-nested-selected-calls.js';
import {call,operationReference,valueLiteral} from './semantic-ir.js';
import {expression,isValue} from '../values/value.js';

const fail = message => {throw new TypeError(`P0021 composed expression: ${message}`);};
const OPS = Object.freeze({'+':'add','*':'multiply'});
export function createSourceComposedExpressionTaskEvaluator({snapshot,blockId,parse,specs,evaluate,getProviderOutcome,revision}={}) {
  if (!snapshot || !Array.isArray(snapshot.blocks) || typeof parse!=='function' ||
      !(specs instanceof Map) || typeof evaluate!=='function') fail('explicit source and evaluator required');
  return createValueEvaluator({revision,getProviderOutcome,invoke:async envelope=>{
    if(envelope.blockId!==blockId || envelope.taskScopeId!==snapshot.taskScopeId) fail('document scope mismatch');
    const entry=snapshot.blocks.find(b=>b.blockId===blockId);
    if(!entry || entry.parseError!==null) fail('unknown or invalid block');
    const parsed=parse(envelope.source);
    if(!Array.isArray(parsed) || parsed.length!==1) fail('one statement required');
    const statement=parsed[0];
    if(statement.type==='Assignment' && !snapshot.writers?.some(w=>w.writerId===blockId && w.name===statement.name))
      fail('unattested assignment writer');
    const root=statement.type==='Assignment'?statement.value:statement;
    if(statement.type!=='Assignment' && !['FunctionCall','Variable','BinaryExpression','PowerExpression','UnaryExpression','Literal'].includes(statement.type)) fail('unsupported statement');
    const providers=new Map(envelope.providers.map(p=>[p.name,p]));
    if(providers.size!==envelope.providers.length) fail('duplicate providers');
    const expected=new Map();
    for(const ref of entry.references??[]) {
      if(ref.binding?.kind!=='provider-reference') fail('unresolved variable');
      if(expected.has(ref.name)&&expected.get(ref.name)!==ref.binding.providerId) fail('conflicting variables');
      expected.set(ref.name,ref.binding.providerId);
    }
    // P0020 supplies one resolved callable fact per source name; nested
    // occurrences reuse that exact fact, never a new name-resolution pass.
    const calls=entry.calls??[];
    for(const item of calls){
      if(item.classification!=='document-writer' || item.candidates?.length!==1 || item.candidates[0]!=='document-writer' || !item.providerId)
        fail('unresolved or ambiguous callable');
      if(expected.has(item.name) && expected.get(item.name)!==item.providerId) fail('conflicting callable identity');
      expected.set(item.name,item.providerId);
    }
    if(expected.size!==providers.size) fail('unexpected provider set');
    for(const [name,id] of expected){const p=providers.get(name);if(!p||p.providerId!==id||!isValue(p.value))fail('provider identity mismatch');}
    const evalOperation=async (name,args)=>{
      if(!specs.has(name)) fail(`unselected operation ${name}`);
      const ir=call(operationReference(name),args.map(valueLiteral));
      const result=await evaluateNestedSelectedCalls({envelope:{...envelope,providers:[]},ir,specs,evaluate});
      if(!isValue(result)||result.kind!=='expression')fail('expression result required');
      return result;
    };
    const usedCalls=new Set();
    const visit=async node=>{
      if(!node || typeof node!=='object')fail('invalid expression node');
      switch(node.type){
        case 'Literal':
          if(!Number.isSafeInteger(node.value)||node.value<0)fail('selected nonnegative integers only');
          return expression({op:'integer',value:String(node.value)});
        case 'Variable':{
          const p=providers.get(node.name);
          if(!p || !entry.references?.some(r=>r.name===node.name && r.binding?.providerId===p.providerId))fail('unresolved variable');
          if(p.value.kind!=='expression')fail('expression variable required');
          return p.value;
        }
        case 'FunctionCall':{
          // Select by the *attested occurrence*, not a runtime lookup by name.
          const selected=calls.find(c=>c.name===node.name);
          if(!selected)fail('call binding not attested');
          usedCalls.add(selected.name);
          const p=providers.get(selected.name);
          if(!p || p.providerId!==selected.providerId || p.value.kind!=='function')fail('callable provider mismatch');
          const args=[];
          for(const arg of node.args??[])args.push(await visit(arg));
          return evaluateSelectedFunctionApplication({fn:p.value,args,envelope:{...envelope,providers:[]},specs,evaluate});
        }
        case 'UnaryExpression':
          if(node.op!=='-')fail('unsupported unary expression');
          return evalOperation('multiply',[expression({op:'integer',value:'-1'}),await visit(node.argument)]);
        case 'PowerExpression':return evalOperation('power',[await visit(node.base),await visit(node.exponent)]);
        case 'BinaryExpression':{
          const left=await visit(node.left),right=await visit(node.right);
          if(OPS[node.op])return evalOperation(OPS[node.op],[left,right]);
          if(node.op==='-')return evalOperation('add',[left,await evalOperation('multiply',[expression({op:'integer',value:'-1'}),right])]);
          if(node.op==='/')return evalOperation('multiply',[left,await evalOperation('power',[right,expression({op:'integer',value:'-1'})])]);
          fail('unsupported binary operation');
        }
        default: fail(`unsupported nested node ${node.type}`);
      }
    };
    const value=await visit(root);
    if(usedCalls.size!==calls.length)fail('unconsumed source calls');
    return {blockId,status:'success',value};
  }});
}
