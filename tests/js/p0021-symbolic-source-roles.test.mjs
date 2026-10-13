/** P0021 Slice 22: symbolic source arguments through the existing P0019 role resolver.
 * Intentionally no Python/Worker claims. Document bindings remain caller-owned.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { compileSelectedSourceAst } from '../../src/js/semantics/compile-selected-source-ast.js';
import { operationSpec } from '../../src/js/operations/operation-spec.js';
import { LexicalIdentityScope, binderIdentity, sameIdentity } from '../../src/js/semantics/identity.js';
import { providerReference } from '../../src/js/semantics/semantic-ir.js';

const v = name => ({type:'Variable',name});
const n = value => ({type:'Literal',value});
const bin = (op,left,right) => ({type:'BinaryExpression',op,left,right});
const pow = (base,exponent) => ({type:'PowerExpression',base,exponent});
const fn = (name,...args) => ({type:'FunctionCall',name,args});
const V = name => ({name,role:'value'});
const S = name => ({name,role:'symbolic'});
const scoped = (name,scopeOver) => ({name,role:'scoped',scopeOver});
const spec = (name,...args) => operationSpec({operationId:name,evaluatorId:`probe.${name}`,arguments:args});
const specs = new Map([
  ['add',spec('add',V('left'),V('right'))],
  ['power',spec('power',V('base'),V('exponent'))],
  ['sin',spec('sin',V('angle'))],
  ['diff',spec('diff',V('expression'),S('variable'))],
  ['integrate',spec('integrate',V('integrand'),S('variable'),V('lower'),V('upper'))],
  ['derivativeProbe',spec('derivativeProbe',V('expression'),S('variable'))],
  ['sumScoped',spec('sumScoped',V('body'),scoped('binder',['body']),V('start'),V('end'))],
]);
const scope = new LexicalIdentityScope('task-A');
const compile = (ast, {bind = () => providerReference('writer-x17'), ...options} = {}) => {
  let next = 0;
  return compileSelectedSourceAst(ast, {
    specs, lexicalScope:scope,
    resolveVariable:bind,
    makeLocalId:({operationId,index,name}) => `block-9:${operationId}:${index}:${name}:${++next}`,
    ...options,
  });
};

test('P0021 S22: diff(x^2,x) shadows x := 17 before resolving the source expression', () => {
  const queried=[];
  const ir=compile(fn('diff',pow(v('x'),n(2)),v('x')), {bind:name=>{queried.push(name);return providerReference('writer-x17')}});
  assert.equal(ir.callee.operationId,'diff');
  const expressionX=ir.args[0].args[0];
  const targetX=ir.args[1];
  assert.equal(expressionX.kind,'semantic-reference');
  assert.equal(targetX.kind,'semantic-reference');
  assert.ok(sameIdentity(expressionX.identity,targetX.identity));
  assert.equal(targetX.identity.kind,'operation-local');
  assert.deepEqual(queried,[],'document writer lookup must not see bound x');
});

test('P0021 S22: diff(A,x) preserves materialized A by provider identity', () => {
  const seen=[];
  const ir=compile(fn('diff',v('A'),v('x')),{bind:name=>{seen.push(name);return providerReference('writer-materialized-A')}});
  assert.equal(ir.args[0].kind,'provider-reference');
  assert.equal(ir.args[0].providerId,'writer-materialized-A');
  assert.equal(ir.args[1].identity.kind,'operation-local');
  assert.deepEqual(seen,['A']);
});

test('P0021 S22: integrate(x,x,1,x) binds source integrand but not upper bound', () => {
  const seen=[];
  const ir=compile(fn('integrate',v('x'),v('x'),n(1),v('x')),{bind:name=>{seen.push(name);return providerReference('writer-x17')}});
  assert.ok(sameIdentity(ir.args[0].identity,ir.args[1].identity));
  assert.equal(ir.args[2].kind,'value');
  assert.equal(ir.args[3].providerId,'writer-x17');
  assert.deepEqual(seen,['x']);
});

test('P0021 S22: nested selected value-role calls inherit symbolic operand scope', () => {
  const ir=compile(fn('diff',fn('sin',bin('+',v('x'),n(1))),v('x')));
  const x=ir.args[0].args[0].args[0];
  assert.ok(sameIdentity(x.identity,ir.args[1].identity));
});

test('P0021 S22: symbolic role works for another operation name without hardcoding diff', () => {
  const ir=compile(fn('derivativeProbe',pow(v('x'),n(2)),v('x')));
  assert.ok(sameIdentity(ir.args[0].args[0].identity,ir.args[1].identity));
});

test('P0021 S22: symbolic local x does not leak into surrounding ordinary x', () => {
  const ir=compile(bin('+',v('x'),fn('diff',pow(v('x'),n(2)),v('x'))));
  assert.equal(ir.args[0].providerId,'writer-x17');
  assert.equal(ir.args[1].args[0].args[0].identity.kind,'operation-local');
});

test('P0021 S22: caller-supplied lexical binder is shadowed within symbolic call only', () => {
  const outer=scope.push([binderIdentity('fn-param-x','x')]);
  const ir=compile(bin('+',v('x'),fn('diff',v('x'),v('x'))),{lexicalScope:outer});
  assert.equal(ir.args[0].identity.kind,'binder');
  assert.equal(ir.args[1].args[0].identity.kind,'operation-local');
  assert.ok(sameIdentity(ir.args[1].args[0].identity,ir.args[1].args[1].identity));
});

test('P0021 S22: symbolic target must be an actual source Variable, not evaluated literal', () => {
  let calls=0;
  assert.throws(()=>compile(fn('diff',v('x'),n(2)),{bind:()=>{calls++;return providerReference('writer-x17')}}),/symbolic argument.*requires a variable/);
  assert.equal(calls,0);
});

test('P0021 S22: symbolic call requires document-supplied scope and identity allocator', () => {
  assert.throws(()=>compile(fn('diff',v('x'),v('x')),{lexicalScope:null}),/scope/i);
  assert.throws(()=>compile(fn('diff',v('x'),v('x')),{makeLocalId:null}),/identity/i);
});

test('P0021 S22: scoped argument role is not silently treated as value', () => {
  assert.throws(()=>compile(fn('sumScoped',v('k'),v('k'),n(1),n(3))),/scoped|unsupported/);
});

test('P0021 S22: ordinary x remains a document-owned binding outside symbolic operators', () => {
  const ir=compile(pow(v('x'),n(2)));
  assert.equal(ir.args[0].providerId,'writer-x17');
});

test('P0021 S22: selected IR and operation-local identities remain frozen', () => {
  const ir=compile(fn('diff',v('x'),v('x')));
  assert.equal(Object.isFrozen(ir),true);
  assert.equal(Object.isFrozen(ir.args),true);
  assert.equal(Object.isFrozen(ir.args[1].identity),true);
});

test('P0021 S22: symbolic target name must pass canonical source validation', () => {
  let allocations=0;
  assert.throws(()=>compile(fn('diff',v('x'),v('2x')),{makeLocalId:()=>{allocations++;return 'invalid'}}),/invalid symbolic variable name/);
  assert.equal(allocations,0);
});
