import test from 'node:test';
import assert from 'node:assert/strict';
import {compileSelectedSymbolicDiff} from '../../src/js/semantics/compile-selected-symbolic-diff.js';
import {compileSelectedSourceAst} from '../../src/js/semantics/compile-selected-source-ast.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {LexicalIdentityScope,freeSymbolIdentity} from '../../src/js/semantics/identity.js';
import {providerReference,semanticReference,operationReference,call} from '../../src/js/semantics/semantic-ir.js';
import {expression} from '../../src/js/values/value.js';
const role=(name,role='value')=>({name,role});
const make=(operationId,evaluatorId,args)=>operationSpec({operationId,evaluatorId,arguments:args});
const diff=make('diff','probe.symbolic.diff',[role('expression'),role('variable','symbolic')]);
const specs=new Map([['diff',diff],['power',make('power','probe.scalar.pow',[role('base'),role('exponent')])],['add',make('add','probe.scalar.add',[role('left'),role('right')])]]);
const v=name=>({type:'Variable',name}); const n=value=>({type:'Literal',value});
const source=(expr,resolveVariable=()=>providerReference('p-x'))=>compileSelectedSourceAst(expr,{specs,lexicalScope:new LexicalIdentityScope('task'),resolveVariable,makeLocalId:({name})=>'local:'+name});
const env=(providers=[])=>({protocol:'newcas.semantic-evaluation.v1',revision:'r1',blockId:'b1',taskScopeId:'task',source:'diff(x^2,x)',providers});
const iv=x=>expression({op:'integer',value:String(x)});
const d=(left,target)=>({type:'FunctionCall',name:'diff',args:[left,v(target)]});
const power=(base,exponent)=>({type:'PowerExpression',base,exponent});

test('diff(x^2,x) transports one local identity and does not consume x:=17',()=>{
 const ir=source(d(power(v('x'),n(2)),'x'));
 const s=compileSelectedSymbolicDiff(env(),ir,diff);
 const [expr,target]=s.evaluationRequest.inputs.map(x=>x.data.expr);
 assert.equal(expr.op,'pow');assert.deepEqual(expr.base,target);
 assert.equal(target.identity.kind,'operation-local');assert.equal(s.providerIds.length,0);
 assert.ok(Object.isFrozen(s));
});
test('diff(A,x) retains materialized A and does not relabel its symbols',()=>{
 const a=expression({op:'pow',base:{op:'symbolRef',identity:freeSymbolIdentity('other-task','x')},exponent:{op:'integer',value:'2'}});
 const ir=source(d(v('A'),'x'),()=>providerReference('p-A'));
 const s=compileSelectedSymbolicDiff(env([{name:'A',providerId:'p-A',value:a}]),ir,diff);
 assert.deepEqual(s.evaluationRequest.inputs[0],a);
 assert.notDeepEqual(s.evaluationRequest.inputs[0].data.expr.base.identity,s.evaluationRequest.inputs[1].data.expr.identity);
});
test('different task-scoped display-identical symbols retain distinct identities',()=>{
 const x1=freeSymbolIdentity('task-A','x'),x2=freeSymbolIdentity('task-B','x');
 const ir=call(operationReference('diff'),[semanticReference(x1),semanticReference(x2)]);
 const s=compileSelectedSymbolicDiff(env(),ir,diff);
 assert.notDeepEqual(s.evaluationRequest.inputs[0].data.expr.identity,s.evaluationRequest.inputs[1].data.expr.identity);
});
test('unattested or unused provider fails closed',()=>{
 const ir=source(d(v('A'),'x'),()=>providerReference('p-A'));
 assert.throws(()=>compileSelectedSymbolicDiff(env(),ir,diff),/missing expression provider/);
 assert.throws(()=>compileSelectedSymbolicDiff(env([{name:'A',providerId:'p-A',value:iv(5)},{name:'B',providerId:'p-B',value:iv(6)}]),ir,diff),/unused provider/);
});
test('selected symbolic target must be explicit reference',()=>{
 const ir=call(operationReference('diff'),[semanticReference(freeSymbolIdentity('task','x')),providerReference('p-x')]);
 assert.throws(()=>compileSelectedSymbolicDiff(env([{name:'x',providerId:'p-x',value:iv(17)}]),ir,diff),/explicit identity/);
});
test('unknown nested operations fail closed',()=>{
 const ir=call(operationReference('diff'),[call(operationReference('solve'),[semanticReference(freeSymbolIdentity('task','x'))]),semanticReference(freeSymbolIdentity('task','x'))]);
 assert.throws(()=>compileSelectedSymbolicDiff(env(),ir,diff),/unsupported symbolic expression/);
});
