// Normative stress-tests på bindingsniveau + strukturelle egenskaber ved afhængighedsgrafen.
// Dækker finding F7 (binder-bevidsthed). Se README for finding-numrene.
import test from 'node:test';
import assert from 'node:assert/strict';
import {makeRuntime, bindingFacts, parse} from './lib/fixtures.mjs';
import {BINDING_CASES} from './lib/binding-cases.mjs';
import {knownGap} from './lib/gaps.mjs';
import {mulberry32, genValidSource} from './lib/fuzz.mjs';
import {deriveSourceSemanticSnapshot} from '../../src/js/semantics/derive-source-semantic-snapshot.js';

for (const c of BINDING_CASES) {
  const body = () => {
    const rt = makeRuntime(c.blocks);
    const task = c.task ?? 'default';
    const before = bindingFacts(rt, task).facts;
    if (c.act) c.act(rt);
    const facts = bindingFacts(rt, task).facts;
    c.check({before, facts, rt});
  };
  const name = `${c.id} ${c.title}`;
  if (c.gap) knownGap(c.gap, name, body); else test(name, body);
}

test('#14/#41 (semantisk lag direkte): parse-invalid midterblok er ingen writer, og b binder a1', () => {
  for (const bad of ['a :=', 'a := )(']) {
    const s = deriveSourceSemanticSnapshot(
      [{id: 'a1', source: 'a := 4'}, {id: 'bad', source: bad}, {id: 'b', source: 'b := a+1'}], parse, 'default');
    assert.deepEqual(s.writers.map(w => w.writerId), ['a1', 'b'], `writers for "${bad}"`);
    assert.notEqual(s.blocks.find(b => b.blockId === 'bad').parseError, null);
    assert.equal(s.blocks.find(b => b.blockId === 'b').references[0].binding.providerId, 'a1');
  }
  // NB: DocumentRuntime kan ikke repræsentere dokumentet (finding F2) – se 02-front-door-robustness.
});

test('grafen er en DAG per konstruktion: alle kanter går fra tidligere til senere blok i samme opgave', () => {
  const rand = mulberry32(2026);
  for (let docNo = 0; docNo < 150; docNo += 1) {
    const blocks = Array.from({length: 12}, (_, i) => [`b${i}`, genValidSource(rand), rand() < 0.7 ? 't1' : 't2']);
    const rt = makeRuntime(blocks);
    for (const task of ['t1', 't2']) {
      const order = rt.blocks.filter(b => b.taskId === task).map(b => b.id);
      if (!order.length) continue;
      const {analysis} = bindingFacts(rt, task);
      for (const id of order) {
        for (const down of analysis.graph.getAllDownstream(id)) {
          assert.ok(order.indexOf(down) > order.indexOf(id), `kant ${id} → ${down} går baglæns (dokument ${docNo})`);
        }
      }
    }
  }
});
