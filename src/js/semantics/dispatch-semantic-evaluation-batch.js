/** P0021 Slice 6 — sequential evaluator boundary; no engine, DOM or runtime coupling.
 * Caller owns revisions and evaluator implementation. The evaluator receives the
 * exact task (including provider IDs), never a Python/document-global namespace.
 * A stale revision is never committed, including after an awaited evaluation.
 */
import {
  beginSemanticEvaluationResults,
  nextSemanticEvaluationDecision,
  commitSemanticEvaluationOutcome,
} from './commit-semantic-evaluation-results.js';

export async function dispatchSemanticEvaluationBatch(batch, {
  revision, getCurrentRevision, evaluate, cachedOutcomes = new Map(),
} = {}) {
  if (typeof revision !== 'string' || !revision ||
      typeof getCurrentRevision !== 'function' || typeof evaluate !== 'function' ||
      !(cachedOutcomes instanceof Map)) {
    throw new TypeError('revision, revision reader, evaluator and cache are required');
  }
  let state = beginSemanticEvaluationResults(batch, revision);
  while (true) {
    const decision = nextSemanticEvaluationDecision(batch, state, getCurrentRevision(), cachedOutcomes);
    if (decision.kind === 'complete') return Object.freeze({kind:'complete', state});
    if (decision.kind === 'stale') return Object.freeze({kind:'stale', state});
    if (decision.kind === 'missing-upstream') return Object.freeze({kind:'missing-upstream', state,
      blockId:decision.blockId, providerId:decision.providerId});

    let outcome;
    if (decision.kind === 'blocked') {
      outcome = {blockId:decision.blockId, status:'failure', code:'UPSTREAM_FAILED',
        message:`Required provider ${decision.providerId} did not succeed`};
    } else {
      try {
        // No parallel execution: each outcome is committed before next dispatch.
        outcome = await evaluate(decision.task);
      } catch (error) {
        outcome = {blockId:decision.task.blockId, status:'failure', code:'EVALUATOR_ERROR',
          message: error instanceof Error ? error.message : String(error)};
      }
    }
    // Never commit late results, even if an evaluator ignores cancellation.
    if (getCurrentRevision() !== revision) return Object.freeze({kind:'stale', state});
    state = commitSemanticEvaluationOutcome(batch, state, revision, outcome, cachedOutcomes);
  }
}
