import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import peggy from 'peggy';

const parser = peggy.generate(readFileSync('docs/Grammatik.pegjs', 'utf8'));
const parse = source => parser.parse(source)[0];

test('P0018 canonical decimals use dot', () => {
  assert.deepEqual(parse('1.5'), { type:'Literal', value:1.5 });
});
test('P0018 canonical comma means argument separator', () => {
  const call=parse('f(1,5)');
  assert.equal(call.type,'FunctionCall');
  assert.deepEqual(call.args.map(x=>x.value),[1,5]);
});
test('P0018 semicolon argument separator remains supported', () => {
  assert.deepEqual(parse('f(1;5)').args.map(x=>x.value),[1,5]);
});
test('P0018 decimal numbers can occur in multiple arguments', () => {
  assert.deepEqual(parse('f(1.5,2.5)').args.map(x=>x.value),[1.5,2.5]);
});
test('P0018 decimal comma requires explicit locale preprocessing', () => {
  assert.throws(()=>parse('1,5'));
});
test('P0018 scalar quantity supports unit brackets', () => {
  const ast=parse('5[m]');
  assert.equal(ast.type,'Quantity');
  assert.equal(ast.value,5);
  assert.equal(ast.unit,'m');
});
test('P0018 compound unit brackets remain intact', () => {
  const ast=parse('3.5[m/s^2]');
  assert.equal(ast.type,'Quantity');
  assert.equal(ast.value,3.5);
  assert.equal(ast.unit,'m/s^2');
});
test('P0018 unit conversion arrow remains intact', () => {
  const ast=parse('5[m]->[cm]');
  assert.equal(ast.type,'Conversion');
  assert.equal(ast.expr.type,'Quantity');
  assert.equal(ast.targetUnit,'cm');
});
test('P0018 bracket vectors remain separate from unit brackets', () => {
  const ast=parse('[1,2]');
  assert.equal(ast.type,'Vector');
  assert.equal(ast.components.length,2);
});
test('P0018 identifier indexing remains separate from unit brackets', () => {
  const ast=parse('v[1]');
  assert.equal(ast.type,'Access');
  assert.equal(ast.container,'v');
});
