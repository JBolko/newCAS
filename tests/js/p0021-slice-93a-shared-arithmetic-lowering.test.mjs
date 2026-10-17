/** S93a: compare both existing compiler entry points on the common arithmetic
 * subset. They retain distinct authority for lexical vs attested name binding.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {compileSelectedSourceAst} from '../../src/js/semantics/compile-selected-source-ast.js';
import {compileAttestedDocumentExpressionIR} from '../../src/js/semantics/compile-attested-document-expression-ir.js';
import {operationSpec} from '../../src/js/operations/operation-spec.js';
import {providerReference} from '../../src/js/semantics/semantic-ir.js';
import {createSelectedArithmeticLowering} from '../../src/js/semantics/lower-selected-arithmetic.js';

const spec = name => operationSpec({operationId:name,evaluatorId:`probe.${name}`,
  arguments:[{name:'a',role:'value'},{name:'b',role:'value'}]});
const specs = new Map(['add','multiply','power'].map(name=>[name,spec(name)]));
const lit = value => ({type:'Literal',value});
const ref = name => ({type:'Variable',name});
const bin = (op,left,right) => ({type:'BinaryExpression',op,left,right});
const pow = (base,exponent) => ({type:'PowerExpression',base,exponent});
const neg = argument => ({type:'UnaryExpression',op:'-',argument});

function both(ast, names=[]) {
  const lookup = name => {
    if (!names.includes(name)) throw new Error(`unexpected source variable ${name}`);
    return providerReference(`provider-${name}`);
  };
  const selected = compileSelectedSourceAst(ast,{specs,resolveVariable:lookup});
  const entry={parseError:null,calls:[],references:names.map(name=>({name,
    binding:{kind:'provider-reference',providerId:`provider-${name}`}}))};
  const attested = compileAttestedDocumentExpressionIR(ast,{entry,blockId:'expression-1',specs});
  return {selected,attested};
}

test('S93a: arithmetic compilation is byte-identical across both paths for the common subset',()=>{
  const trees=[
    lit(0),
    bin('+',lit(2),lit(3)),
    bin('-',neg(lit(7)),lit(5)),
    bin('/',lit(3),pow(lit(2),lit(4))),
    bin('*',bin('+',lit(2),lit(3)),neg(bin('-',lit(8),lit(4)))),
    pow(neg(lit(2)),bin('+',lit(1),lit(2))),
    bin('+',bin('*',ref('a'),ref('b')),pow(ref('c'),lit(2))),
  ];
  for(const ast of trees){
    const names=ast===trees[6]?['a','b','c']:[];
    const {selected,attested}=both(ast,names);
    assert.deepEqual(selected,attested);
    assert.equal(JSON.stringify(selected),JSON.stringify(attested));
    assert.equal(Object.isFrozen(selected),true);
    assert.equal(Object.isFrozen(attested),true);
  }
});

test('S93a: both compilers reject unsupported operators, non-exact literals and missing capabilities',()=>{
  for(const ast of [bin('%',lit(3),lit(2)),bin('^',lit(3),lit(2)),
    lit(1.25),lit(-1),lit(Number.MAX_SAFE_INTEGER+1),lit(Infinity)]) {
    assert.throws(()=>both(ast),TypeError);
  }
  const noPower = new Map([['add',spec('add')],['multiply',spec('multiply')]]);
  assert.throws(()=>compileSelectedSourceAst(pow(lit(2),lit(3)),{specs:noPower}),/unselected operation power/);
  assert.throws(()=>compileAttestedDocumentExpressionIR(pow(lit(2),lit(3)),{
    entry:{parseError:null,references:[],calls:[]},blockId:'out',specs:noPower
  }),/unsupported operation power/);
});

test('S93a: unsupported unary syntax is rejected before inspecting its child or invoking document resolution',()=>{
  let reads=0;
  const invalid={type:'UnaryExpression',op:'!',argument:ref('a')};
  assert.throws(()=>compileSelectedSourceAst(invalid,{specs,resolveVariable:()=>{reads++;return providerReference('p');}}),/unsupported unary/);
  assert.equal(reads,0);
  assert.throws(()=>compileAttestedDocumentExpressionIR(invalid,{
    entry:{parseError:null,references:[],calls:[]},blockId:'out',specs}),/unsupported unary/);
});

test('S93a: arithmetic helper is pure and cannot choose an operation without caller selection',()=>{
  assert.throws(()=>createSelectedArithmeticLowering(),/selected-operation callback/);
  const requested=[];
  const lowered=createSelectedArithmeticLowering((name,args)=>{
    requested.push(name);
    if(name==='power') throw new TypeError('capability missing');
    return compileSelectedSourceAst(bin('+',lit(1),lit(2)),{specs});
  });
  assert.equal(Object.isFrozen(lowered),true);
  assert.throws(()=>lowered.power(providerReference('a'),providerReference('b')),/capability missing/);
  assert.deepEqual(requested,['power']);
  assert.throws(()=>lowered.binary('+',null,providerReference('b')),/lowered operand must be Semantic IR/);
  const dishonest = createSelectedArithmeticLowering(()=>undefined);
  assert.throws(()=>dishonest.binary('+',providerReference('a'),providerReference('b')),/lowered operand must be Semantic IR/);
});
