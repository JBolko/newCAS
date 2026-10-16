import test from 'node:test';
import assert from 'node:assert/strict';
import {compileAttestedDocumentExpressionIR as compile} from '../../src/js/semantics/compile-attested-document-expression-ir.js';
import {evaluateAttestedDocumentIR as execute} from '../../src/js/semantics/evaluate-attested-document-ir.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {expression,functionValue} from '../../src/js/values/value.js';
import {binderIdentity} from '../../src/js/semantics/identity.js';
const i=n=>expression({op:'integer',value:String(n)});
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({operationId:id,evaluatorId:`probe.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
const num=v=>BigInt(v.data.expr.value);
const evaluate=async (_env,sel)=>{
 const [a,b]=sel.evaluationRequest.inputs.map(num);
 const op=sel.evaluationRequest.evaluatorId.replace('probe.','');
 return {blockId:sel.blockId,status:'success',value:i(op==='add'?a+b:op==='multiply'?a*b:a**b)};
};
const ast={lit:n=>({type:'Literal',value:n}),v:name=>({type:'Variable',name}),fn:(name,...args)=>({type:'FunctionCall',name,args}),bin:(op,left,right)=>({type:'BinaryExpression',op,left,right})};
const ref=(name,providerId)=>({name,binding:{kind:'provider-reference',providerId}});
const cal=(name,providerId)=>({name,providerId,classification:'document-writer',candidates:['document-writer']});
const envelope=providers=>({protocol:'newcas.semantic-evaluation.v1',blockId:'out',revision:'rev',taskScopeId:'task',source:'IR-only',providers});
const run=(statement,{refs=[],calls=[],writers=[],providers=[],applyFunction=async()=>{throw Error('no functions');}}={})=>{
 const ir=compile(statement,{entry:{parseError:null,references:refs,calls},blockId:'out',specs,writers});
 return execute({ir,envelope:envelope(providers),specs,evaluate,applyFunction});
};
const provider=(name,id,value)=>({name,providerId:id,value});
test('general IR assignment evaluates a*b+1 without source execution',async()=>{
 const stmt={type:'Assignment',name:'c',value:ast.bin('+',ast.bin('*',ast.v('a'),ast.v('b')),ast.lit(1))};
 const result=await run(stmt,{refs:[ref('a','A'),ref('b','B')],writers:[{name:'c',writerId:'out'}],providers:[provider('a','A',i(2)),provider('b','B',i(3))]});
 assert.equal(num(result),7n);
});
test('a long variable name ab is NOT multiplied into a and b',async()=>{
 assert.equal(num(await run(ast.bin('+',ast.v('ab'),ast.lit(1)),{refs:[ref('ab','AB')],providers:[provider('ab','AB',i(11))]})),12n);
});
test('nested f(g(4)) executes over provider-bound IR, no source name resolution',async()=>{
 const f=functionValue([{identity:binderIdentity('param-f','x')}],i(0));
 const g=functionValue([{identity:binderIdentity('param-g','x')}],i(0));
 const seen=[];
 const result=await run(ast.fn('f',ast.fn('g',ast.lit(4))),{
  calls:[cal('f','F'),cal('g','G')],providers:[provider('f','F',f),provider('g','G',g)],
  applyFunction:async ({fn,args})=>{seen.push(fn===f?'f':'g');return i(fn.data.parameters[0].identity.id==='param-g'?num(args[0])*3n:num(args[0])**2n+2n);}
 });
 assert.equal(num(result),146n);assert.deepEqual(seen,['g','f']);
});
test('repeated f(f(2)) reuses attested provider, nested argument arrives as a Value',async()=>{
 const f=functionValue([{identity:binderIdentity('param-f','x')}],i(0));
 const seen=[];
 const result=await run(ast.fn('f',ast.fn('f',ast.lit(2))),{
  calls:[cal('f','F')],providers:[provider('f','F',f)],
  applyFunction:async ({args})=>{seen.push(num(args[0]));return i(num(args[0])**2n+1n);}
 });
 assert.equal(num(result),26n);assert.deepEqual(seen,[2n,5n]);
});
test('invalid provider identities and unexpected providers fail closed',async()=>{
 await assert.rejects(run(ast.v('x'),{refs:[ref('x','X')],providers:[provider('x','WRONG',i(2))]}),/unknown provider identity/);
 await assert.rejects(run(ast.lit(2),{providers:[provider('x','X',i(2))]}),/unused provider/);
});
test('IR writer identity is checked at execution boundary',async()=>{
 const ir=compile({type:'Assignment',name:'x',value:ast.lit(3)},{entry:{parseError:null,references:[],calls:[]},blockId:'out',specs,writers:[{name:'x',writerId:'out'}]});
 await assert.rejects(execute({ir,envelope:{...envelope([]),blockId:'other'},specs,evaluate,applyFunction:async()=>i(0)}),/writer identity mismatch/);
});
