/** S93f: former S93e RED pressure promoted to mandatory GREEN tests.
 * These checks inspect derived semantic references; they do NOT execute SymPy.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {parse} from '../../src/js/parser.mjs';
import {deriveSourceSemanticSnapshot} from '../../src/js/semantics/derive-source-semantic-snapshot.js';

function snapshot(...sources) {
  return deriveSourceSemanticSnapshot(
    sources.map((source,i)=>({id:`block-${i}`,source})), parse,'s93e-task');
}
const references = (s,i) => s.blocks[i].references.map(x=>[x.name,x.binding.kind,x.binding.providerId ?? null]);

// A symbolic target must not become a document read, neither in its target
// position nor in the mathematically governed expression preceding it.
test('S93f GREEN: integrate(x^2,x) does not capture a prior document x',()=>{
  const s=snapshot('x:=17','integrate(x^2,x)');
  assert.equal(s.blocks[1].parseError,null);
  assert.deepEqual(references(s,1),[]);
});

test('S93f GREEN: tangentline(x^2,x,2) binds its variable locally, not to document x',()=>{
  const s=snapshot('x:=17','tangentline(x^2,x,2)');
  assert.equal(s.blocks[1].parseError,null);
  assert.deepEqual(references(s,1),[]);
});

test('S93f GREEN: a different free variable remains a provider while symbolic x stays local',()=>{
  const s=snapshot('x:=17','y:=3','integrate(x*y,x)');
  assert.equal(s.blocks[2].parseError,null);
  assert.deepEqual(references(s,2),[['y','provider-reference','block-1']]);
});
