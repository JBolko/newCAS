/** P0021 Slice 29: selected FunctionValue application through existing P0021 evaluator.
 * The caller owns callable/provider resolution. No source or Python name lookup.
 * Bounded to integer arithmetic with explicitly selected add/multiply/power.
 */
import {applySelectedFunctionValue} from './apply-selected-function-value.js';
import {evaluateNestedSelectedCalls} from './evaluate-nested-selected-calls.js';
import {call,define,operationReference,valueLiteral} from './semantic-ir.js';
import {expression,isValue} from '../values/value.js';

const fail = message => {throw new TypeError(`P0021 selected function evaluation: ${message}`);};
const opName = Object.freeze({add:'add',mul:'multiply',pow:'power'});

export async function evaluateSelectedFunctionApplication({fn,args,envelope,specs,evaluate} = {}) {
  if (!envelope || !Array.isArray(envelope.providers) || envelope.providers.length)
    fail('document must supply already resolved Value arguments; no implicit providers');
  if (!(specs instanceof Map) || typeof evaluate !== 'function') fail('selected specs and evaluator required');
  const applied=applySelectedFunctionValue(fn,args);
  const lower = expr => {
    switch (expr.op) {
      case 'integer':
      case 'rational':
      case 'approx': return valueLiteral(expression(expr));
      case 'add':
      case 'mul':
      case 'pow': {
        const name=opName[expr.op];
        if (!specs.has(name)) fail(`unselected arithmetic ${name}`);
        const children=expr.op==='pow' ? [expr.base,expr.exponent] : expr.args;
        if (!Array.isArray(children) || children.length!==2) fail('binary arithmetic only');
        return call(operationReference(name),children.map(lower));
      }
      default: fail(`unresolved or unsupported expression ${expr.op}`);
    }
  };
  const ir=lower(applied.data.expr);
  if (ir.kind==='value') return applied;
  if (typeof envelope.blockId!=='string' || !envelope.blockId) fail('block identity required');
  const result=await evaluateNestedSelectedCalls({
    envelope,ir:define(envelope.blockId,ir),specs,evaluate,
  });
  if (!isValue(result) || result.kind!=='expression') fail('expression result required');
  return result;
}
