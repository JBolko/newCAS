/** P0021 — opt-in edit-driven orchestration, never document authority.
 * Successful edits enqueue work; successful, blocked and stale outcomes do not.
 * delayMs=0 retains microtask coalescing; positive delays debounce each task.
 */
export function createSemanticAutoScheduler({runtime, createEvaluate, enqueue = queueMicrotask,
    delayMs = 0, scheduleDelay = setTimeout, cancelDelay = clearTimeout,
    onOutcome = () => {}, onError = () => {}} = {}) {
    if (!runtime || typeof runtime.subscribeSemanticChanges !== 'function' ||
        typeof runtime.evaluateAndCommitDirtySemanticTask !== 'function' ||
        typeof createEvaluate !== 'function' || typeof enqueue !== 'function' ||
        typeof onOutcome !== 'function' || typeof onError !== 'function' ||
        !Number.isSafeInteger(delayMs) || delayMs < 0 ||
        typeof scheduleDelay !== 'function' || typeof cancelDelay !== 'function') {
        throw new TypeError('semantic scheduler requires DocumentRuntime, callbacks and nonnegative integer delayMs');
    }
    const pending = new Set();
    const timers = new Map();
    let queued = false;
    let closed = false;
    let revisionCounter = 0;
    // Invocation tokens are scoped per task. They are not document generations.
    const activeRevisions = new Map();
    const queueReady = taskId => {
        if (closed) return;
        pending.add(taskId);
        if (queued) return;
        queued = true;
        enqueue(() => {
            queued = false;
            if (closed) return;
            const tasks = [...pending];
            pending.clear();
            for (const task of tasks) {
                const revision = `semantic-auto-${++revisionCounter}`;
                activeRevisions.set(task, revision);
                Promise.resolve().then(() => runtime.evaluateAndCommitDirtySemanticTask(task, {
                    revision,
                    getCurrentRevision: () => activeRevisions.get(task),
                    createEvaluate: args => createEvaluate({...args, taskId: task}),
                })).then(result => onOutcome(task, result), error => onError(task, error));
            }
        });
    };
    const request = taskId => {
        if (closed) return;
        if (typeof taskId !== 'string' || !taskId) throw new TypeError('taskId required');
        if (delayMs === 0) {queueReady(taskId); return;}
        // A later edit supersedes even a ready-but-not-yet-flushed timer.
        pending.delete(taskId);
        const old = timers.get(taskId);
        if (old) {cancelDelay(old.handle); timers.delete(taskId);}
        const token = {};
        const handle = scheduleDelay(() => {
            if (closed || timers.get(taskId)?.token !== token) return;
            timers.delete(taskId);
            queueReady(taskId);
        }, delayMs);
        timers.set(taskId, {handle, token});
    };
    const unsubscribe = runtime.subscribeSemanticChanges(taskIds => {
        for (const taskId of taskIds) request(taskId);
    });
    return Object.freeze({request, dispose() {
        if (closed) return;
        closed = true;
        pending.clear();
        for (const {handle} of timers.values()) cancelDelay(handle);
        timers.clear();
        unsubscribe();
    }});
}
