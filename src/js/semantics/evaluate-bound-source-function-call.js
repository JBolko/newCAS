/** P0021 Slice 31 — execute a function call classified in P0020's semantic snapshot.
 * The snapshot is descriptive; no name-based runtime resolution or fallback.
 * DocumentRuntime must attest precisely the selected provider's current Value.
 */
import {evaluateProviderFunctionCall} from './evaluate-provider-function-call.js';

const fail = message => {throw new TypeError(`P0021 source function call: ${message}`);};

export async function evaluateBoundSourceFunctionCall({snapshot,blockId,callIndex=0,expectedName,args,envelope,specs,evaluate}={}) {
  if (!snapshot || typeof snapshot.taskScopeId!=='string' || !Array.isArray(snapshot.blocks)) fail('semantic snapshot required');
  if (typeof blockId!=='string' || !blockId || !Number.isSafeInteger(callIndex) || callIndex<0) fail('explicit block and call position required');
  if (typeof expectedName!=='string' || !expectedName) fail('source call name required for attestation');
  const blocks=snapshot.blocks.filter(b=>b.blockId===blockId);
  if (blocks.length!==1 || !Array.isArray(blocks[0].calls)) fail('unique analyzed source block required');
  const selected=blocks[0].calls[callIndex];
  if (!selected || selected.name!==expectedName) fail('call occurrence does not match analyzed source');
  if (selected.classification==='ambiguous') fail('ambiguous operation/document call requires explicit policy');
  if (selected.classification!=='document-writer' || !Array.isArray(selected.candidates) ||
      selected.candidates.length!==1 || selected.candidates[0]!=='document-writer' ||
      typeof selected.providerId!=='string' || !selected.providerId) fail('no uniquely selected document function provider');
  if (!envelope || envelope.blockId!==blockId || envelope.taskScopeId!==snapshot.taskScopeId ||
      !Array.isArray(envelope.providers) || envelope.providers.length!==1 ||
      envelope.providers[0]?.providerId!==selected.providerId || envelope.providers[0]?.name!==expectedName)
    fail('document attestation does not match source provider and task');
  return evaluateProviderFunctionCall({providerId:selected.providerId,args,envelope,specs,evaluate});
}
