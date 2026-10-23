import {DocumentRuntime} from '../../src/js/document-runtime.js';
import {findSelectedOperationSpec} from '../../src/js/operations/selected-operation-catalog.js';
import {compileSelectedValueCall} from '../../src/js/semantics/compile-selected-value-call.js';
import {call,operationReference,valueLiteral,providerReference} from '../../src/js/semantics/semantic-ir.js';
import {decodeValue,encodeValue,isValue,expression} from '../../src/js/values/value.js';
import {sourceListSpecs} from './s100c-source-list-cases.mjs';
import {createValueEvaluator} from '../../src/js/semantics/create-value-evaluator.js';
const check=(ok,label)=>{if(!ok)throw Error(label);};
export function selectedFixtureCall(env,operation,inputs){
  const spec=findSelectedOperationSpec(operation)??sourceListSpecs().get(operation);
  return compileSelectedValueCall(env,call(operationReference(operation),inputs.map(valueLiteral)),spec);
}
export async function runValueTransportCases(evaluate,fixtures){
  const results=[];let requests=0;
  async function invoke(operation,inputs){
    const env={protocol:'newcas.semantic-evaluation.v1',revision:`m2-wire-${++requests}`,blockId:'wire',taskScopeId:'T',source:'materialized Value fixture',providers:[]};
    return evaluate(env,selectedFixtureCall(env,operation,inputs));
  }
  for(const f of fixtures){
    const value=decodeValue(JSON.stringify(f.value)),before=encodeValue(value);
    const first=await invoke('list',[value]);
    check(first.status==='success',f.name+' first roundtrip: '+JSON.stringify(first));
    check(isValue(first.value)&&Object.isFrozen(first.value.data.items),'immutable returned ListV2');
    const returned=first.value.data.items[0];
    check(encodeValue(returned)===f.canonical,f.name+' canonical bytes preserved');
    const second=await invoke('list',[first.value]);
    check(second.status==='success'&&encodeValue(second.value.data.items[0])===encodeValue(first.value),f.name+' returned Value reused as request');
    check(encodeValue(value)===before,'input snapshot unchanged');
    results.push(f.name+' opaque roundtrip/reuse');
  }
  const one=expression({op:'integer',value:'1'}),two=expression({op:'integer',value:'2'});
  for(const items of [[],[one,two]]){
    const out=await invoke('list',items);
    check(out.status==='success'&&out.value.valueVersion===1,'v1-only list keeps v1 output');
  }
  results.push('v1-only and empty list outputs remain v1');
  const invalidPartition=structuredClone(fixtures[0].value);
  invalidPartition.data.classes[0].upper=structuredClone(invalidPartition.data.classes[0].lower);
  const represented=decodeValue(JSON.stringify(invalidPartition));
  const opaque=await invoke('list',[represented]);
  check(opaque.status==='success'&&encodeValue(opaque.value.data.items[0])===encodeValue(represented),'transport is not a mathematical partition certificate');
  results.push('shape validity remains distinct from mathematical validity');
  const grouped=decodeValue(JSON.stringify(fixtures[0].value)),estimate=decodeValue(JSON.stringify(fixtures.find(f=>f.name==='symbolic-result').value));
  const wrapped=decodeValue(JSON.stringify({valueVersion:2,kind:'list',data:{items:[fixtures[1].value]}}));
  const operations=['mean','variance','standard_deviation','sample_variance','sample_standard_deviation','median','min','max','quartiles','five_number_summary','observation_values','absolute_frequencies','relative_frequencies','cumulative_absolute_frequencies','cumulative_relative_frequencies'];
  for(const op of ['add',...operations])for(const value of [grouped,estimate,wrapped]){
    const out=await invoke(op,op==='add'?[value,one]:[value]);
    check(out.status==='failure'&&out.code==='type-mismatch',op+' rejects wrapper: '+JSON.stringify(out));
    check(out.diagnostic?.parameters.actualKind===value.kind,op+' retains actualKind');
  }
  results.push('scalar + all 15 discrete statistics reject both wrappers and lists of wrappers');
  const root=await invoke('power',[expression({op:'rational',numerator:'409',denominator:'4'}),expression({op:'rational',numerator:'1',denominator:'2'})]);
  const expected=decodeValue(JSON.stringify(fixtures.find(f=>f.name==='symbolic-result').value.data.value));
  check(root.status==='success'&&encodeValue(root.value)===encodeValue(expected),'real SymPy computes sqrt(409)/2 exactly');
  results.push('real selected SymPy power calculation, distinct from fixture transport');
  return{pass:results.length,fail:0,requests,fixtureRoundtrips:fixtures.length*2,mathCalls:1,rejectionCalls:48,results};
}

export async function runValueRuntimeCases(evaluate,fixtures){
  const runtime=DocumentRuntime.createSemantic('s100m2'),results=[];
  let revision,epoch=0,requests=0,hold=false,started,release;
  const calc=id=>runtime.getBlock(id).calculation;
  const rootFor=env=>{
    const raw=structuredClone(fixtures[0].value);
    raw.data.classes[0].count.data.expr.value=String(9007199254740993n+BigInt(env.source.match(/\d+/)[0]));
    return decodeValue(JSON.stringify(raw));
  };
  const evaluateFixture=async env=>{
    // These are already materialized test sources, not a new source constructor.
    if(env.blockId==='data'||env.blockId==='other')return{blockId:env.blockId,status:'success',value:rootFor(env)};
    const ir=call(operationReference('list'),env.providers.map(p=>providerReference(p.providerId)));
    const selected=compileSelectedValueCall(env,ir,findSelectedOperationSpec('list'));
    requests++;
    const out=await evaluate(env,selected);
    if(hold&&env.blockId==='use'){
      started();await new Promise(resolve=>{release=resolve;});
    }
    return out;
  };
  const run=taskId=>{
    revision=`m2-runtime-${++epoch}`;
    return runtime.evaluateAndCommitDirtySemanticTask(taskId,{revision,getCurrentRevision:()=>revision,createEvaluate:({cachedOutcomes})=>{
      const known=new Map([...cachedOutcomes].map(([id,record])=>[id,record.outcome]));
      return createValueEvaluator({revision,getProviderOutcome:id=>known.get(id)??null,invoke:async env=>{
        const out=await evaluateFixture(env);if(out.status==='success')known.set(env.blockId,out);return out;
      }});
    }});
  };
  for(const row of [['data','A:=1','T'],['use','B:=list(A)','T'],['again','list(B)','T'],['other','A:=2','U'],['otherUse','list(A)','U']])runtime.addBlock({id:row[0],source:row[1],taskId:row[2],type:'formula'});
  check(runtime.deriveSemanticTask('T').analysis.bindings.get('use').get('A')==='data','provider binding belongs to runtime');
  check((await run('T')).kind==='complete'&&calc('data').result.kind==='statistics','standalone complete StatisticsValue published');
  check(calc('use').result?.valueVersion===2&&isValue(calc('again').result),'typed provider -> list Worker -> nested returned Value: '+JSON.stringify({use:calc('use').error,again:calc('again').error}));
  await run('U');const other=calc('otherUse').result;
  const old=calc('data').result,before=encodeValue(old),generation=calc('use').generation;
  results.push('full typed publication and provider reuse through real list path');
  runtime.setBlockSource('data','A:=3');
  check(calc('use').status==='dirty'&&calc('again').result===null&&calc('use').generation>generation,'edit clears downstream and advances calculation generation');
  check((await run('T')).kind==='complete','recalculation complete');
  check(calc('use').result.data.items[0].data.classes[0].count.data.expr.value==='9007199254740996','new source fixture propagated');
  check(encodeValue(old)===before&&Object.isFrozen(old.data.classes),'old snapshot unchanged');
  check(calc('otherUse').result===other,'other task retains its own provider/result');
  results.push('edit/invalidation/new generation, preserved snapshot and task isolation');
  runtime.setBlockSource('data','A:=4');hold=true;
  const dispatched=new Promise(resolve=>{started=resolve;});
  const pending=run('T');await dispatched;
  runtime.setBlockSource('data','A:=5');hold=false;release();
  const stale=await pending;
  check(stale.kind!=='complete'&&calc('data').result===null&&calc('use').result===null,'stale generation cannot publish any part of batch');
  check((await run('T')).kind==='complete'&&calc('use').result.data.items[0].data.classes[0].count.data.expr.value==='9007199254740998','latest generation recomputes');
  results.push('held real transport result rejected after source/generation edit, then recomputed');
  return{pass:results.length,fail:0,requests,staleKind:stale.kind,results};
}
