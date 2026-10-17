// Fælles opsætning: DocumentRuntime uden den gamle motor, specs og en blad-operation uden Python.
import {DocumentRuntime} from '../../../src/js/document-runtime.js';
import {parse} from '../../../src/js/parser.mjs';
import {operationSpec} from '../../../src/js/operations/operation-spec.js';
import {expression} from '../../../src/js/values/value.js';
import {identityKey} from '../../../src/js/semantics/identity.js';
import {createRuntimeFunctionBatchEvaluator} from '../../../src/js/semantics/create-runtime-function-batch-evaluator.js';

export {parse};

/** Den gamle CASEngine må ALDRIG blive kaldt af den semantiske vej. */
export const legacyEngineStub = Object.freeze({
  calculate: async () => { throw new Error('legacy CASEngine invoked'); },
  getTaskState: async () => { throw new Error('legacy CASEngine invoked'); },
  resetTask: async () => { throw new Error('legacy CASEngine invoked'); },
});

/** blocks: [[id, source, taskId?], …]  (taskId default 'default') */
export function makeRuntime(blocks = [], {documentId = 'pilot-doc'} = {}) {
  const rt = new DocumentRuntime(legacyEngineStub, documentId);
  for (const [id, source, taskId = 'default'] of blocks) {
    rt.addBlock({id, type: 'formula', source, taskId});
  }
  return rt;
}

const spec = (id, args, evaluatorId = `probe.scalar.${id}`) =>
  operationSpec({operationId: id, evaluatorId, arguments: args});
const binary = [{name: 'a', role: 'value'}, {name: 'b', role: 'value'}];

export const arithmeticSpecs = new Map(['add', 'multiply', 'power'].map(id => [id, spec(id, binary)]));
export const selectedSpecs = new Map([
  ...arithmeticSpecs,
  ['diff', spec('diff', [{name: 'expression', role: 'value'}, {name: 'variable', role: 'symbolic'}], 'probe.symbolic.diff')],
]);

export const integer = n => expression({op: 'integer', value: String(n)});

/** Blad-operation uden Python (samme BigInt-dobbelt som projektets egne scheduler-tests). */
export const bigintLeaf = async (_envelope, selected) => {
  const [a, b] = selected.evaluationRequest.inputs.map(v => BigInt(v.data.expr.value));
  const op = selected.evaluationRequest.evaluatorId;
  const value = op.endsWith('.power') ? a ** b : op.endsWith('.multiply') ? a * b : a + b;
  return {blockId: selected.blockId, status: 'success', value: integer(value)};
};

let revisionCounter = 0;
export const nextRevision = () => `pilot-rev-${++revisionCounter}`;

export const taskIds = rt => [...new Set(rt.blocks.filter(b => b.type === 'formula').map(b => b.taskId))];

export function createEvaluateFactory({leaf = bigintLeaf, specs = arithmeticSpecs, revision}) {
  return ({snapshot, cachedOutcomes}) =>
    createRuntimeFunctionBatchEvaluator({snapshot, parse, specs, evaluate: leaf, revision, cachedOutcomes});
}

/** Inkrementel evaluering af én opgave (kun beskidte blokke). */
export async function evaluateTask(rt, taskId, {leaf = bigintLeaf, specs = arithmeticSpecs} = {}) {
  const revision = nextRevision();
  return rt.evaluateAndCommitDirtySemanticTask(taskId, {
    revision,
    getCurrentRevision: () => revision,
    createEvaluate: createEvaluateFactory({leaf, specs, revision}),
  });
}

export async function evaluateAll(rt, options) {
  for (const taskId of taskIds(rt)) await evaluateTask(rt, taskId, options);
}

/** Stabil tekst-snapshot af alle blokkes tilstand: id → "success:<Value-JSON>" | "<status>:<fejlkode>". */
export function view(rt) {
  return Object.fromEntries(rt.blocks.filter(b => b.type === 'formula').map(b => {
    const c = b.calculation;
    return [b.id, c.status === 'success' ? `success:${JSON.stringify(c.result)}` : `${c.status}:${c.error?.code ?? ''}`];
  }));
}

/** Byg et nyt runtime ud fra nuværende kilder (kun kilder + rækkefølge + opgave) og evaluér fra bunden. */
export async function freshView(rt, options) {
  const blocks = rt.blocks.filter(b => b.type === 'formula').map(b => [b.id, b.source, b.taskId]);
  const fresh = makeRuntime(blocks);
  await evaluateAll(fresh, options);
  return view(fresh);
}

/** Bindings og kaldklassifikation pr. blok i én opgave – uden evaluering. */
export function bindingFacts(rt, taskId = 'default') {
  const {snapshot, analysis} = rt.deriveSemanticTask(taskId);
  const out = {};
  for (const b of snapshot.blocks) {
    const refs = {};
    const calls = {};
    for (const r of b.references) {
      refs[r.name] = r.binding.kind === 'provider-reference'
        ? r.binding.providerId
        : `FREE:${identityKey(r.binding.identity)}`;
    }
    for (const c of b.calls) calls[c.name] = {classification: c.classification, providerId: c.providerId};
    out[b.blockId] = {parseError: b.parseError !== null, refs, calls};
  }
  return {facts: out, snapshot, analysis};
}

export const isFree = binding => typeof binding === 'string' && binding.startsWith('FREE:');
