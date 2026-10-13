/** P0021 Slice 28: pure, capture-safe application of an already materialized FunctionValue.
 * Does not select a callable, consult source names, simplify mathematics, or invoke Python.
 */
import {identityKey, isSemanticIdentity} from './identity.js';
import {expression, isValue} from '../values/value.js';

const fail = message => {throw new TypeError(`P0021 function application: ${message}`);};
const keyOf = identity => {
  if (!isSemanticIdentity(identity)) fail('invalid semantic identity');
  return identityKey(identity);
};

export function applySelectedFunctionValue(fn, args) {
  if (!isValue(fn) || fn.kind !== 'function') fail('FunctionValue required');
  if (!Array.isArray(args) || args.length !== fn.data.parameters.length) fail('wrong argument arity');
  if (args.some(value => !isValue(value) || value.kind !== 'expression')) fail('expression Value arguments required');
  if (fn.data.body.kind !== 'expression') fail('expression function body required');

  const bindings = new Map();
  for (let i=0; i<args.length; i++) {
    const identity=fn.data.parameters[i].identity;
    if (identity.kind !== 'binder') fail('binder parameter required');
    const key=keyOf(identity);
    if (bindings.has(key)) fail('duplicate parameter identity');
    bindings.set(key,args[i].data.expr);
  }
  for (const capture of fn.data.capturedValues) {
    const key=keyOf(capture.identity);
    if (bindings.has(key)) fail('capture collides with parameter');
    if (!isValue(capture.value) || capture.value.kind !== 'expression') fail('expression capture required');
    bindings.set(key,capture.value.data.expr);
  }
  const seen = new Set();
  const substitute = node => {
    switch (node.op) {
      case 'symbolRef': {
        const key=keyOf(node.identity);
        if (!bindings.has(key)) fail('unbound symbol identity');
        seen.add(key);
        return bindings.get(key);
      }
      case 'add':
      case 'mul': return {op:node.op,args:node.args.map(substitute)};
      case 'pow': return {op:'pow',base:substitute(node.base),exponent:substitute(node.exponent)};
      case 'integer':
      case 'rational':
      case 'approx':
      case 'constant': return node;
      default: fail(`unsupported body expression ${node.op}`);
    }
  };
  const result=expression(substitute(fn.data.body.data.expr));
  for (const key of bindings.keys()) {
    if (!seen.has(key) && !fn.data.parameters.some(p=>keyOf(p.identity)===key)) fail('unused capture');
  }
  return result;
}
