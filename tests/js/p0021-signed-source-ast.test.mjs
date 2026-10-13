import test from 'node:test';
import assert from 'node:assert/strict';
import {compileSelectedSourceAst as compile} from '../../src/js/semantics/compile-selected-source-ast.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
const spec=(id,n)=>operationSpec({operationId:id,evaluatorId:`probe.scalar.${id}`,arguments:Array.from({length:n},(_,i)=>({name:`arg${i}`,role:'value'}))});
const specs=new Map([['add',2],['multiply',2],['power',2]].map(([n,a])=>[n,spec(n,a)]));
const lit=n=>({type:'Literal',value:n});
const pow=(a,b)=>({type:'PowerExpression',base:a,exponent:b});
const bin=(op,left,right)=>({type:'BinaryExpression',op,left,right});
const neg=x=>({type:'UnaryExpression',op:'-',argument:x});
const c=x=>compile([x],{specs});
const name=x=>x.callee.operationId;
const val=x=>x.value?.data?.expr?.value;
test('P0021 signs: -2^2 negates the *power*, not its base',()=>{
 const v=c(neg(pow(lit(2),lit(2))));
 assert.equal(name(v),'multiply');assert.equal(val(v.args[0]),'-1');assert.equal(name(v.args[1]),'power');
});
test('P0021 signs: (-2)^2 has a negative base, not a negated power',()=>{
 const v=c(pow(neg(lit(2)),lit(2)));
 assert.equal(name(v),'power');assert.equal(name(v.args[0]),'multiply');assert.equal(val(v.args[0].args[0]),'-1');
});
test('P0021 signs: odd powers still have different IR trees',()=>{
 const left=c(neg(pow(lit(2),lit(3))));const right=c(pow(neg(lit(2)),lit(3)));
 assert.notDeepEqual(left,right);
});
test('P0021 signs: subtraction uses selected add/multiply only',()=>{
 const v=c(bin('-',lit(20),lit(8)));assert.equal(name(v),'add');assert.equal(name(v.args[1]),'multiply');assert.equal(val(v.args[1].args[0]),'-1');
});
test('P0021 signs: division uses selected multiply/power inverse',()=>{
 const v=c(bin('/',lit(20),lit(5)));assert.equal(name(v),'multiply');assert.equal(name(v.args[1]),'power');assert.equal(val(v.args[1].args[1]),'-1');
});
test('P0021 signs: nested precedence can compose without reevaluating source',()=>{
 const v=c(bin('+',neg(pow(lit(2),lit(2))),bin('*',lit(4),lit(5))));assert.equal(name(v),'add');assert.equal(name(v.args[0]),'multiply');
});
test('P0021 signs: unsigned literal precision constraint remains',()=>assert.throws(()=>c(lit(1.1)),/safe integer/));
test('P0021 signs: unknown unary operations cannot pass',()=>assert.throws(()=>c({type:'UnaryExpression',op:'~',argument:lit(1)}),/unsupported unary/));
test('P0021 signs: operation catalogue must explicitly include lowering operators',()=>assert.throws(()=>compile(neg(lit(2)),{specs:new Map()}),/unselected operation multiply/));
test('P0021 signs: results are immutable Semantic IR',()=>{const v=c(neg(lit(2)));assert.equal(Object.isFrozen(v),true);assert.equal(Object.isFrozen(v.args[0].value),true)});
