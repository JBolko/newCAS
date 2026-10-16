/** P0021 Slice 65: source-attested, provider-bound arithmetic assignment or read.
 * DocumentRuntime owns writer selection and results; this adapter owns neither.
 */
import {createValueEvaluator} from './create-value-evaluator.js';
import {compileSelectedSourceAst} from './compile-selected-source-ast.js';
import {evaluateNestedSelectedCalls} from './evaluate-nested-selected-calls.js';
import {providerReference} from './semantic-ir.js';
import {isValue} from '../values/value.js';

const fail = message => {throw new TypeError(`P0021 expression task: ${message}`);};
export function createSourceExpressionTaskEvaluator({snapshot,blockId,parse,specs,evaluate,getProviderOutcome,revision}={}) {
  if (!snapshot || !Array.isArray(snapshot.blocks) || !Array.isArray(snapshot.writers) ||
      typeof blockId!=='string' || !blockId || typeof parse!=='function' ||
      !(specs instanceof Map) || typeof evaluate!=='function') fail('source, evaluator and snapshot required');
  return createValueEvaluator({revision,getProviderOutcome,invoke:async envelope=>{
    const entry=snapshot.blocks.find(b=>b.blockId===blockId);
    if (!entry || entry.parseError!==null || envelope.blockId!==blockId || envelope.taskScopeId!==snapshot.taskScopeId)
      fail('invalid document block identity');
    const ast=parse(envelope.source);
    if (!Array.isArray(ast) || ast.length!==1) fail('exactly one statement required');
    const statement=ast[0];
    const assignment=statement?.type==='Assignment';
    if (!assignment && statement?.type!=='Variable') fail('only arithmetic assignments and variable reads supported');
    if (assignment && !snapshot.writers.some(w=>w.writerId===blockId && w.name===statement.name && w.taskScopeId===snapshot.taskScopeId))
      fail('source-attested assignment writer required');
    const expected=new Map(entry.references.filter(r=>r.binding?.kind==='provider-reference').map(r=>[r.name,r.binding.providerId]));
    if (expected.size!==envelope.providers.length) fail('unexpected provider set');
    for (const p of envelope.providers) if(expected.get(p.name)!==p.providerId || !isValue(p.value)) fail('provider attestation mismatch');
    const ir=compileSelectedSourceAst(assignment?statement.value:statement,{
      specs,
      resolveVariable:name=>{
        const id=expected.get(name);
        if(!id) fail(`unresolved document variable ${name}`);
        return providerReference(id);
      }
    });
    if(ir.kind==='provider-reference') {
      const value=envelope.providers.find(p=>p.providerId===ir.providerId)?.value;
      if(!isValue(value)) fail('missing provider Value');
      return {blockId,status:'success',value};
    }
    if(ir.kind==='value') return {blockId,status:'success',value:ir.value};
    if(ir.kind!=='call') fail('unsupported symbolic expression');
    const value=await evaluateNestedSelectedCalls({envelope,ir,specs,evaluate});
    if(!isValue(value)) fail('invalid arithmetic Value');
    return {blockId,status:'success',value};
  }});
}
