/**
 * P0021 S94d: trusted Worker transport-control failures -> P0009 Diagnostics.
 *
 * The producer owns the known code and parameters; no locale, UI text,
 * raw Error/backend payload, source, or document authority crosses this gate.
 * P0009 Diagnostic v1 is reused without extending its frozen envelope.
 */
import {diagnosticFromSpec, diagnosticSpec} from '../diagnostics/diagnostic.js';

const specifications = new Map([
  ['WORKER_TIMEOUT', {timeoutMs:'non-negative-integer'}],
  ['WORKER_PENDING_LIMIT', {maxPending:'non-negative-integer'}],
  ['WORKER_CRASH', {}],
  ['WORKER_MESSAGE_ERROR', {}],
  ['WORKER_CLIENT_CLOSED', {}],
  ['WORKER_CORRELATION_MISMATCH', {}],
  ['INVALID_WORKER_OUTCOME', {}],
  ['INVALID_WORKER_VALUE', {}],
  ['WORKER_OWNER_CLOSED', {}],
  ['WORKER_OWNER_UNAVAILABLE', {}],
  ['WORKER_GENERATION_STALE', {}],
  ['WORKER_REVISION_UNAVAILABLE', {}],
].map(([code, parameters]) => [code, diagnosticSpec({code, parameters})]));

/** Construct at the trusted transport/owner producer, not by guessing a code
 * from an arbitrary Error.message at a document/UI boundary. */
export function createWorkerTransportError(code, parameters = {}) {
  const specification = specifications.get(code);
  if (!specification) throw new TypeError('unknown Worker transport diagnostic code');
  const detail = diagnosticFromSpec(specification, parameters);
  const error = new Error(code); // preserve the existing 94a/94c API
  Object.defineProperties(error, {
    code: {value: code, enumerable: true},
    diagnostic: {value: detail, enumerable: true},
  });
  return error;
}
