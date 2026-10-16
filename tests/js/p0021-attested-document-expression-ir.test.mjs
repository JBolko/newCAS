import test from 'node:test';
import assert from 'node:assert/strict';
import {compileAttestedDocumentExpressionIR as compile} from '../../src/js/semantics/compile-attested-document-expression-ir.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
const specs=new Map(['add','multiply','power'].map(id=>[id,operationSpec({operationId:id,evaluatorId:`probe.${id}`,arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]})]));
const variable=name=>({type:'Variable',name});
const literal=value=>({type:'Literal',value});
const app=(name,...args)=>({type:'FunctionCall',name,args});
const bin=(op,left,right)=>({type:'BinaryExpression',op,left,right});
const ref=(name,providerId)=>({name,binding:{kind:'provider-reference',providerId}});
const cal=(name,providerId)=>({name,providerId,classification:'document-writer',candidates:['document-writer']});
const entry=(references=[],calls=[],writers=[])=>({parseError:null,references,calls,writers});
const build=(ast,att=entry(),writers=[])=>compile(ast,{entry:att,blockId:'out',specs,writers});
test('composed calls lower to nested provider-reference IR, not function name lookup',()=>{
 const ir=build(app('f',app('g',literal(4))),entry([], [cal('f','provider-f'),cal('g','provider-g')]));
 assert.equal(ir.kind,'call');assert.equal(ir.callee.kind,'provider-reference');assert.equal(ir.callee.providerId,'provider-f');
 assert.equal(ir.args[0].callee.providerId,'provider-g');assert.ok(Object.isFrozen(ir.args));
});
test('repeated f(f(2)) consumes one attestation and reuses provider identity',()=>{
 const ir=build(app('f',app('f',literal(2))),entry([], [cal('f','same-f')]));
 assert.equal(ir.callee.providerId,'same-f');assert.equal(ir.args[0].callee.providerId,'same-f');
});
test('assignment a*b+1 uses independent attested identifiers (ab remains one name)',()=>{
 const ast={type:'Assignment',name:'c',value:bin('+',bin('*',variable('a'),variable('b')),literal(1))};
 const ir=build(ast,entry([ref('a','id-a'),ref('b','id-b')]),[{name:'c',writerId:'out'}]);
 assert.equal(ir.kind,'define');assert.equal(ir.body.kind,'call');
 assert.equal(ir.body.args[0].args[0].providerId,'id-a');assert.equal(ir.body.args[0].args[1].providerId,'id-b');
 assert.throws(()=>build(variable('ab'),entry([ref('a','id-a'),ref('b','id-b')])),/unattested variable/);
});
test('fails closed for unattested or ambiguous callable and mismatched writers',()=>{
 assert.throws(()=>build(app('g',literal(2)),entry()),/unattested callable/);
 assert.throws(()=>build(app('f',literal(2)),entry([], [{...cal('f','f'),candidates:['document-writer','builtin']}])),/unresolved callable/);
 assert.throws(()=>build({type:'Assignment',name:'x',value:literal(2)},entry()),/unattested writer/);
});
test('rejects unconsumed bindings and unsupported operations, no fallback',()=>{
 assert.throws(()=>build(literal(2),entry([ref('x','id-x')])),/unconsumed attestations/);
 assert.throws(()=>build(bin('%',literal(4),literal(2))),/unsupported binary operator/);
 assert.throws(()=>build(bin('^',literal(4),literal(2))),/unsupported binary operator/);
});
