/** P0021 Slice 30: execute an explicitly bound document FunctionValue provider.
 * DocumentRuntime owns callable selection and argument binding; this adapter
 * never resolves source names. The selected arithmetic evaluator is reused.
 */
import {isValue} from '../values/value.js';
import {evaluateSelectedFunctionApplication} from './evaluate-selected-function-application.js';

function fail(message) {throw new TypeError(`P0021 provider function call: ${message}`);}

export async function evaluateProviderFunctionCall({providerId,args,envelope,specs,evaluate}={}) {
  if (typeof providerId!=='string' || !providerId) fail('document-selected providerId required');
  if (!Array.isArray(args) || args.some(value=>!isValue(value))) fail('already materialized Value arguments required');
  if (!envelope || !Array.isArray(envelope.providers) || envelope.providers.length!==1)
    fail('exactly one document-attested function provider required');
  const [provider]=envelope.providers;
  if (!provider || provider.providerId!==providerId || typeof provider.name!=='string' || !provider.name ||
      !isValue(provider.value) || provider.value.kind!=='function')
    fail('selected provider must attest a FunctionValue with matching identity');
  // The callable is already materialized and contains its lexical captures.
  // Do not leak the callable provider into selected arithmetic subrequests.
  const arithmeticEnvelope={...envelope,providers:[]};
  return evaluateSelectedFunctionApplication({fn:provider.value,args,envelope:arithmeticEnvelope,specs,evaluate});
}
