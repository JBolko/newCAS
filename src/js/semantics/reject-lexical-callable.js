/** A resolved local callee must never fall back to a document/operation name.
 * Applying lexical Values as functions is outside the selected Release-1 slice.
 */
import {diagnostic} from '../diagnostics/diagnostic.js';

export function rejectLexicalCallable(name) {
  const error=new TypeError('unsupported-operation');
  error.diagnostic=diagnostic('unsupported-operation',{operationId:'lexical-call',name});
  throw error;
}
