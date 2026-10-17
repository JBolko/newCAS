/** P0021 Slice 27: bounded materialization of document-owned function IR.
 * No Python scope, calls, evaluation or source-name based capture resolution.
 */
import { identityKey, isSemanticIdentity } from './identity.js';
import { isSemanticIRNode } from './semantic-ir.js';
import { expression, functionValue, isValue } from '../values/value.js';
import {applySelectedFunctionValue} from './apply-selected-function-value.js';

const fail = message => { throw new TypeError(`P0021 function materialization: ${message}`); };
const OPERATIONS = Object.freeze({add:'add', multiply:'mul', power:'pow'});

export function materializeSelectedFunctionValue(ir, {captures = []} = {}) {
  if (!isSemanticIRNode(ir) || ir.kind !== 'define-function') fail('define-function IR required');
  if (!Array.isArray(captures)) fail('captures array required');
  const parameters = ir.parameters.map(identity => {
    if (!isSemanticIdentity(identity) || identity.kind !== 'binder') fail('binder identity required');
    return {identity};
  });
  const parameterKeys = new Set(parameters.map(p => identityKey(p.identity)));
  if (parameterKeys.size !== parameters.length) fail('duplicate parameter identity');
  const providers = new Map();
  const capturesByIdentity = new Map();
  for (const capture of captures) {
    if (!capture || typeof capture !== 'object' || typeof capture.providerId !== 'string' || !capture.providerId ||
        !isSemanticIdentity(capture.identity) || !isValue(capture.value)) fail('explicit providerId, identity and Value required');
    const key = identityKey(capture.identity);
    if (providers.has(capture.providerId) || capturesByIdentity.has(key) || parameterKeys.has(key))
      fail('duplicate or colliding capture');
    providers.set(capture.providerId,capture);
    capturesByIdentity.set(key,capture);
  }
  const used = new Set();
  const valueCaptures = new Set();
  const lower = node => {
    if (!isSemanticIRNode(node)) fail('invalid body node');
    switch (node.kind) {
      case 'value':
        if (!isValue(node.value) || node.value.kind !== 'expression') fail('expression Value literal required');
        return node.value.data.expr;
      case 'semantic-reference': {
        if (!isSemanticIdentity(node.identity)) fail('invalid semantic reference');
        const key=identityKey(node.identity);
        if (!parameterKeys.has(key)) fail('unresolved non-parameter semantic reference');
        return {op:'symbolRef',identity:node.identity};
      }
      case 'provider-reference': {
        const capture=providers.get(node.providerId);
        if (!capture) fail(`missing capture for provider ${node.providerId}`);
        if (capture.value.kind !== 'expression') fail('scalar reference needs ExpressionValue capture');
        used.add(node.providerId);
        valueCaptures.add(node.providerId);
        return {op:'symbolRef',identity:capture.identity};
      }
      case 'call': {
        if (node.callee?.kind === 'provider-reference') {
          // Lexically bound FunctionValue application is normalized here into
          // the existing expression body via capture-safe beta substitution.
          // No source-name lookup, Python code generation, or runtime dispatch.
          const providerId=node.callee.providerId;
          const capture=providers.get(providerId);
          if (!capture || capture.value.kind !== 'function') fail('attested FunctionValue capture required');
          const argumentsAsValues=node.args.map(arg=>expression(lower(arg)));
          const normalized=applySelectedFunctionValue(capture.value,argumentsAsValues);
          used.add(providerId);
          return normalized.data.expr;
        }
        if (node.callee?.kind !== 'operation-reference') fail('selected operation reference required');
        const op=OPERATIONS[node.callee.operationId];
        if (!op || node.args.length !== 2) fail('unsupported selected function operation');
        const args=node.args.map(lower);
        return op==='pow' ? {op,base:args[0],exponent:args[1]} : {op,args};
      }
      default: fail(`unsupported IR node ${node.kind}`);
    }
  };
  const body=expression(lower(ir.body));
  if (used.size !== providers.size) fail('unused capture');
  return functionValue(parameters,body,[...providers.values()]
    .filter(capture=>valueCaptures.has(capture.providerId))
    .map(({identity,value})=>({identity,value})));
}
