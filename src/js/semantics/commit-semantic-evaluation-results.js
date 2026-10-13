/** P0021 Slice 5 — pure, serializable evaluation-outcome gate.
 * No Python calls, DOM, DocumentRuntime mutation or persistent backend state.
 * Revisions are caller-owned opaque tokens; the caller MUST advance them on
 * relevant source/semantic changes. No cache reuse across revisions here.
 */
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
function portable(v, seen = new Set()) {
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (!v || typeof v !== 'object' || seen.has(v)) return false;
  if (!Array.isArray(v) && Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null) return false;
  seen.add(v);
  const ok = (Array.isArray(v) ? Object.keys(v).length === v.length : true) &&
    Object.entries(v).every(([k, child]) => k !== '__proto__' && portable(child, seen));
  seen.delete(v);
  return ok;
}
function copy(v) {
  if (Array.isArray(v)) return Object.freeze(v.map(copy));
  if (v !== null && typeof v === 'object') return Object.freeze(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, copy(x)])));
  return v;
}
function assertBatch(batch) {
  if (!batch || !Array.isArray(batch.tasks) || !Array.isArray(batch.cycles) || !Array.isArray(batch.blocked)) throw new TypeError('invalid evaluation batch');
  const ids = batch.tasks.map(t => t?.blockId);
  if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length ||
      batch.tasks.some(t => !Array.isArray(t.upstream) || t.upstream.some(id => typeof id !== 'string' || !id))) {
    throw new TypeError('invalid evaluation tasks');
  }
}
function assertState(batch, state) {
  if (!state || !Array.isArray(state.taskIds) || !Array.isArray(state.outcomes) ||
      !Number.isSafeInteger(state.cursor) || state.cursor < 0 || state.cursor > batch.tasks.length ||
      state.taskIds.length !== batch.tasks.length ||
      state.taskIds.some((id, i) => id !== batch.tasks[i].blockId) || state.outcomes.length !== state.cursor) {
    throw new TypeError('state does not match evaluation batch');
  }
}
function validOutcome(outcome) {
  if (!outcome || typeof outcome !== 'object') return false;
  if (outcome.status === 'success') return own(outcome, 'value') && portable(outcome.value);
  if (outcome.status === 'failure') return typeof outcome.code === 'string' && !!outcome.code && typeof outcome.message === 'string';
  return false;
}
export function beginSemanticEvaluationResults(batch, revision) {
  assertBatch(batch);
  if (typeof revision !== 'string' || !revision) throw new TypeError('nonempty revision required');
  return Object.freeze({revision, cursor:0, taskIds:Object.freeze(batch.tasks.map(t => t.blockId)), outcomes:Object.freeze([])});
}
/** Returns a task to evaluate, or a blocked outcome for a failed prerequisite.
 * Unscheduled prerequisites must be resolved by the caller's cache policy;
 * absent outcomes are not treated as success.
 */
export function nextSemanticEvaluationDecision(batch, state, currentRevision, cachedOutcomes = new Map()) {
  assertBatch(batch); assertState(batch, state);
  if (state.revision !== currentRevision) return Object.freeze({kind:'stale'});
  if (state.cursor === batch.tasks.length) return Object.freeze({kind:'complete'});
  if (!(cachedOutcomes instanceof Map)) throw new TypeError('cached outcomes must be Map');
  const task = batch.tasks[state.cursor];
  const known = new Map(state.outcomes.map(o => [o.blockId, o]));
  for (const [id, record] of cachedOutcomes) {
    // Cache entries are explicit revision-stamped records; no cross-revision reuse.
    if (record?.revision === currentRevision && validOutcome(record.outcome) && record.outcome.blockId === id) {
      if (!known.has(id)) known.set(id, record.outcome);
    }
  }
  for (const dep of task.upstream) {
    const outcome = known.get(dep);
    if (!outcome || !validOutcome(outcome)) return Object.freeze({kind:'missing-upstream', blockId:task.blockId, providerId:dep});
    if (outcome.status !== 'success') return Object.freeze({kind:'blocked', blockId:task.blockId, providerId:dep});
  }
  return Object.freeze({kind:'evaluate', task});
}
/** Commit one outcome at the document-owned revision, in batch order.
 * A failure can be committed, but is never a successful cached Value.
 * A blocked dependent must receive a failure result, never be evaluated.
 */
export function commitSemanticEvaluationOutcome(batch, state, currentRevision, outcome, cachedOutcomes = new Map()) {
  const decision = nextSemanticEvaluationDecision(batch, state, currentRevision, cachedOutcomes);
  if (decision.kind === 'stale') throw new Error('stale document revision');
  if (decision.kind === 'complete') throw new Error('evaluation batch complete');
  if (decision.kind === 'missing-upstream') throw new Error('missing upstream outcome');
  if (!outcome || outcome.blockId !== batch.tasks[state.cursor].blockId || !validOutcome(outcome)) throw new TypeError('invalid or out-of-order outcome');
  if (decision.kind === 'blocked' && (outcome.status !== 'failure' || outcome.code !== 'UPSTREAM_FAILED')) {
    throw new Error('blocked task cannot produce successful evaluation');
  }
  const saved = copy(outcome);
  return Object.freeze({revision:state.revision, cursor:state.cursor + 1, taskIds:state.taskIds,
    outcomes:Object.freeze([...state.outcomes, saved])});
}
