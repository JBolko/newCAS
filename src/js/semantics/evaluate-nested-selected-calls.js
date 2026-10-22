/** P0021 Slice 14: postorder evaluation of explicitly selected value-role IR calls.
 * Every subcall is compiled by Slice 9 and dispatched by Slice 11. No Python
 * scope, source reparse, implicit operation selection or persistent state.
 */
import { compileSelectedValueCall } from './compile-selected-value-call.js';
import { isSemanticIRNode, valueLiteral, call, define } from './semantic-ir.js';
import {diagnostic} from '../diagnostics/diagnostic.js';

const freeze = value => {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freeze(item);
    Object.freeze(value);
  }
  return value;
};
const copy = value => freeze(JSON.parse(JSON.stringify(value)));

export async function evaluateNestedSelectedCalls({envelope, ir, specs, evaluate} = {}) {
  if (!isSemanticIRNode(ir)) throw new TypeError('immutable Semantic IR required');
  if (!envelope || !Array.isArray(envelope.providers)) throw new TypeError('gateway envelope required');
  if (!(specs instanceof Map) || typeof evaluate !== 'function') throw new TypeError('explicit OperationSpec map and evaluator required');
  const root = ir.kind === 'define' ? ir.body : ir;
  if (ir.kind === 'define' && ir.writerId !== envelope.blockId) throw new TypeError('writer identity mismatch');
  if (root.kind !== 'call') throw new TypeError('selected root call required');
  const available = new Map(envelope.providers.map(p => [p.providerId, p]));
  const evaluateNode = async (node, isRoot = false) => {
    if (node.kind !== 'call' || node.callee?.kind !== 'operation-reference') throw new TypeError('selected operation-reference call required');
    const spec = specs.get(node.callee.operationId);
    if (!spec) throw new TypeError(`unselected operation ${node.callee.operationId}`);
    const argumentsIR = [];
    for (const arg of node.args) {
      if (arg.kind === 'call') {
        const value = await evaluateNode(arg);
        argumentsIR.push(valueLiteral(copy(value)));
      } else if (arg.kind === 'value') {
        argumentsIR.push(arg);
      } else if (arg.kind === 'provider-reference') {
        if (!available.has(arg.providerId)) throw new TypeError('unknown provider identity');
        argumentsIR.push(arg);
      } else {
        throw new TypeError('symbolic/scoped or unresolved argument unsupported');
      }
    }
    const usedIds = new Set(argumentsIR.filter(x=>x.kind==='provider-reference').map(x=>x.providerId));
    const subEnvelope = {...envelope, providers:envelope.providers.filter(p => usedIds.has(p.providerId))};
    const selectedIR = isRoot && ir.kind === 'define'
      ? define(ir.writerId, call(node.callee, argumentsIR))
      : call(node.callee, argumentsIR);
    const selection = compileSelectedValueCall(subEnvelope, selectedIR, spec);
    const result = await evaluate(subEnvelope, selection);
    if (result?.status !== 'success' || result.blockId !== envelope.blockId || !result.value) {
      const error=new Error(`selected evaluation failed: ${result?.code ?? 'INVALID_OUTCOME'}`);
      const facts=result?.diagnostic;
      if(result?.status==='failure' && result.blockId===envelope.blockId &&
          facts?.diagnosticVersion===1 && facts.code===result.code && Object.hasOwn(facts,'parameters')) {
        try { error.diagnostic=diagnostic(facts.code,facts.parameters); }
        catch { /* malformed facts remain a generic evaluator failure */ }
      }
      throw error;
    }
    return result.value;
  };
  return copy(await evaluateNode(root, true));
}
