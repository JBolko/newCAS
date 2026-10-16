/**
 * document-runtime.js
 *
 * Dokumentlagets grænse mod CASEngine.
 *
 * DocumentRuntime ejer document/task-identitet, så UI og senere
 * persistence ikke behøver kende CASEngine's globale task namespace.
 */

import { parse } from './parser.mjs';
import {deriveSourceSemanticSnapshot} from './semantics/derive-source-semantic-snapshot.js';
import {projectSemanticDependencyAnalysis} from './semantics/project-semantic-dependency-analysis.js';
import {orderSemanticRecomputation} from './semantics/order-semantic-recomputation.js';
import {prepareSemanticEvaluationBatch} from './semantics/prepare-semantic-evaluation-batch.js';
import {dispatchSemanticEvaluationBatch} from './semantics/dispatch-semantic-evaluation-batch.js';
import {isValue} from './values/value.js';
import { analyzeDependencies } from './dependency-analyzer.js';
import {
    buildDocumentDependencyAnalysis,
    findBlocksWithChangedBindings
} from './document-dependency-graph.js';
export class DocumentRuntime {
    constructor(engine, documentId) {
        if (!engine) {
            throw new Error('DocumentRuntime kræver en CASEngine.');
        }

        if (!documentId || typeof documentId !== 'string') {
            throw new Error('DocumentRuntime kræver et documentId.');
        }

        this.engine = engine;
        this.documentId = documentId;
        this.blocks = [];
        this.dependencyAnalysis = new Map();
        this.semanticChangeListeners = new Set();
    }

    /** Opt-in notification: edits only, never calculation outcomes. */
    subscribeSemanticChanges(listener) {
        if (typeof listener !== 'function') throw new TypeError('listener must be a function');
        this.semanticChangeListeners.add(listener);
        return () => this.semanticChangeListeners.delete(listener);
    }

    notifySemanticChange(taskIds) {
        for (const listener of this.semanticChangeListeners) {
            listener(Object.freeze([...taskIds]));
        }
    }

    /**
     * Oversætter et dokument-lokalt taskId til CASEngine's globale namespace.
     */
    taskKey(taskId = 'default') {
        return `${this.documentId}:${taskId}`;
    }

    /**
     * Beregn et AST i dokumentets task-scope.
     */
    async calculate(ast, taskId = 'default') {
        return this.engine.calculate(
            ast,
            this.taskKey(taskId)
        );
    }

    /**
     * Hent state for et task-scope i dokumentet.
     */
    async getTaskState(taskId = 'default') {
        return this.engine.getTaskState(
            this.taskKey(taskId)
        );
    }

    async resetTask(taskId = 'default') {
        await this.engine.resetTask(
            this.taskKey(taskId)
        );
    }

    prepareBlock(block) {
        if (!block || typeof block !== 'object') {
            throw new Error('Block skal være et objekt.');
        }

        if (!block.id || typeof block.id !== 'string') {
            throw new Error('Block kræver et id.');
        }

        if (!['text', 'formula'].includes(block.type)) {
            throw new Error(`Ukendt block-type: ${block.type}`);
        }

        if (this.blocks.some(existing => existing.id === block.id)) {
            throw new Error(`Block-id findes allerede: ${block.id}`);
        }

        const storedBlock = { ...block };

        if (storedBlock.type === 'formula') {
            storedBlock.source ??= '';
            storedBlock.taskId ??= 'default';

            storedBlock.dependencies =
                storedBlock.source.trim() === ''
                    ? { reads: [], writes: [] }
                    : analyzeDependencies(parse(storedBlock.source));

            storedBlock.calculation = {
                status: 'idle',
                generation: 0,
                result: null,
                error: null
            };
        }

        return storedBlock;
    }
    
    addBlock(block) {
        const storedBlock = this.prepareBlock(block);

        this.blocks.push(storedBlock);
        this.rebuildDependencyAnalysis();
        if (storedBlock.type === 'formula') this.notifySemanticChange([storedBlock.taskId]);

        return storedBlock;
    }

    async calculateBlock(blockId) {
        const block = this.getBlock(blockId);

        if (!block) {
            throw new Error(`Block findes ikke: ${blockId}`);
        }

        if (block.type !== 'formula') {
            throw new Error(`Block kan ikke beregnes: ${blockId}`);
        }

        const generation = block.calculation.generation;

        block.calculation = {
            status: 'running',
            generation,
            result: null,
            error: null
        };

        try {
            const ast = parse(block.source);

            const result = await this.calculate(
                ast,
                block.taskId
            );

            if (block.calculation.generation !== generation) {
                return null;
            }

            block.calculation = {
                status: 'success',
                generation,
                result,
                error: null
            };

            return result;

        } catch (error) {
            if (block.calculation.generation !== generation) {
                return null;
            }

            block.calculation = {
                status: 'error',
                generation,
                result: null,
                error: {
                    message: error?.message ?? String(error)
                }
            };

            throw error;
        }
    }

    async recalculateDirty(taskId = 'default', skip = new Set()) {
        const graph = this.getDependencyGraph(taskId);
        const skipped = new Set(skip);

        for (const block of this.blocks) {
            if (
                block.type !== 'formula' ||
                block.taskId !== taskId ||
                block.calculation.status !== 'dirty' ||
                skipped.has(block.id)
            ) {
                continue;
            }

            try {
                await this.calculateBlock(block.id);
            } catch {
                for (
                    const downstreamId of
                    graph?.getAllDownstream(block.id) ?? []
                ) {
                    skipped.add(downstreamId);
                }
            }
        }
    }

    async recalculateFrom(blockId) {
        const block = this.getBlock(blockId);

        if (!block) {
            throw new Error(`Block findes ikke: ${blockId}`);
        }

        if (block.type !== 'formula') {
            throw new Error(`Block kan ikke beregnes: ${blockId}`);
        }

        try {
            await this.calculateBlock(blockId);
        } catch (error) {
            const graph = this.getDependencyGraph(block.taskId);

            const skipped = new Set(
                graph?.getAllDownstream(blockId) ?? []
            );

            await this.recalculateDirty(
                block.taskId,
                skipped
            );

            throw error;
        }

        await this.recalculateDirty(block.taskId);
    }
    
    getBlock(blockId) {
        return this.blocks.find(block => block.id === blockId) ?? null;
    }

    getBlocks() {
        return this.blocks.map(block => ({ ...block }));
    }

    setBlockSource(blockId, source) {
        const block = this.getBlock(blockId);

        if (!block) {
            throw new Error(`Block findes ikke: ${blockId}`);
        }

        if (block.type !== 'formula') {
            throw new Error(`Block har ingen formula-source: ${blockId}`);
        }

        // Parse og dependency-analyse sker før mutation.
        // Ved ugyldig source forbliver block og graph uændret.
        const dependencies =
            source.trim() === ''
                ? { reads: [], writes: [] }
                : analyzeDependencies(parse(source));

        const oldSemantic = this.captureSemanticAnalyses();

        // Preserve semantic downstream as well: provider IDs may stay the same
        // while the writer's VALUE changes (e.g. editing f(t)'s body).
        const oldSemanticDownstream = oldSemantic.get(block.taskId)?.graph.getAllDownstream(blockId) ?? [];
        // Gem downstream fra den gamle graph før dependencies ændres.
        const oldGraph = this.getDependencyGraph(block.taskId);
        const oldDownstream =
            oldGraph?.getAllDownstream(blockId) ?? [];

        // Ny source invaliderer enhver beregning af denne block.
        const nextGeneration =
            block.calculation.generation + 1;

        // Commit den nye source.
        block.source = source;
        block.dependencies = dependencies;

        block.calculation = {
            status: 'idle',
            generation: nextGeneration,
            result: null,
            error: null
        };

        // Den nye source kan have ændret graph-strukturen.
        this.rebuildDependencyAnalysis();

        const newGraph = this.getDependencyGraph(block.taskId);
        const newDownstream =
            newGraph?.getAllDownstream(blockId) ?? [];

        // Både tidligere og nye downstream blocks er nu potentielt ugyldige.
        const newSemanticDownstream = this.deriveSemanticTask(block.taskId).analysis.graph.getAllDownstream(blockId);
        const affected = new Set([
            ...oldDownstream,
            ...newDownstream,
            ...oldSemanticDownstream,
            ...newSemanticDownstream,
        ]);

        for (const affectedBlockId of affected) {
            this.markBlockDirty(affectedBlockId);
        }
        this.invalidateSemanticChanges(oldSemantic);
        this.notifySemanticChange([block.taskId]);
    }

    rebuildDependencyAnalysis() {
        this.dependencyAnalysis =
            buildDocumentDependencyAnalysis(this.blocks);
    }

    /**
     * P0021 integration: read-only projection from authoritative document source.
     * No semantic registry/cache and no mutation of legacy calculation state.
     * The projection is recalculated after each edit from the current block order.
     */
    deriveSemanticTask(taskId = 'default') {
        if (typeof taskId !== 'string' || !taskId) {
            throw new TypeError('taskId must be a nonempty string');
        }
        const sourceBlocks = this.blocks
            .filter(block => block.type === 'formula' && block.taskId === taskId)
            .map(block => ({id: block.id, source: block.source}));
        const snapshot = deriveSourceSemanticSnapshot(sourceBlocks, parse, taskId);
        const analysis = projectSemanticDependencyAnalysis(snapshot);
        return {snapshot, analysis};
    }

    /**
     * P0021 Slice 47: derive a pure evaluation batch from authoritative blocks.
     * No cache, symbol table or result state is owned by this projection.
     * cachedIds must refer to successfully computed outcomes at the caller's
     * current revision; the dispatcher enforces that separately.
     */
    prepareSemanticTaskBatch(taskId = 'default', {recompute, cachedIds = []} = {}) {
        const {snapshot, analysis} = this.deriveSemanticTask(taskId);
        const present = new Set(snapshot.blocks.map(block => block.blockId));
        const ids = recompute === undefined ? new Set(present) : recompute;
        if (!(ids instanceof Set) || [...ids].some(id => !present.has(id))) {
            throw new TypeError('recompute must be a Set of current task block IDs');
        }
        if (!Array.isArray(cachedIds) || cachedIds.some(id => !present.has(id) || ids.has(id))) {
            throw new TypeError('cachedIds must be current, unscheduled task block IDs');
        }
        const plan = {recompute: ids, removed: new Set()};
        const schedule = orderSemanticRecomputation(analysis, plan);
        const sources = new Map(this.blocks
            .filter(block => block.type === 'formula' && block.taskId === taskId)
            .map(block => [block.id, block.source]));
        return prepareSemanticEvaluationBatch(snapshot, analysis, schedule, sources, cachedIds);
    }

    /**
     * Execute through P0021, not CASEngine. The returned outcomes are
     * deliberately NOT committed to document state in Slice 47.
     * Caller owns revision tokens and must invalidate them on source edits.
     */
    async dispatchSemanticTask(taskId = 'default', {
        recompute, cachedIds = [], revision, getCurrentRevision,
        evaluate, cachedOutcomes = new Map(),
    } = {}) {
        const batch = this.prepareSemanticTaskBatch(taskId, {recompute, cachedIds});
        return dispatchSemanticEvaluationBatch(batch, {
            revision, getCurrentRevision, evaluate, cachedOutcomes,
        });
    }

    /**
     * P0021 Slice 48: commit a completed semantic batch to the existing
     * DocumentRuntime calculation slots. No second state store is introduced.
     * External revisions remain caller-owned; runtime identity/generation and
     * source checks additionally guard edits made during asynchronous dispatch.
     */
    async evaluateAndCommitSemanticTask(taskId = 'default', options = {}) {
        const {revision, getCurrentRevision} = options;
        if (typeof revision !== 'string' || !revision || typeof getCurrentRevision !== 'function') {
            throw new TypeError('semantic commit requires revision and revision reader');
        }
        const batch = this.prepareSemanticTaskBatch(taskId, options);
        const owned = this.blocks.filter(b => b.type === 'formula' && b.taskId === taskId);
        const initial = owned.map(b => ({block: b, id: b.id, source: b.source,
            generation: b.calculation.generation}));
        const stillCurrent = () => {
            if (getCurrentRevision() !== revision) return false;
            const now = this.blocks.filter(b => b.type === 'formula' && b.taskId === taskId);
            return now.length === initial.length && initial.every((entry, i) =>
                now[i] === entry.block && now[i].id === entry.id &&
                now[i].source === entry.source &&
                now[i].calculation.generation === entry.generation);
        };
        if (!stillCurrent()) return Object.freeze({kind: 'stale'});
        const outcome = await dispatchSemanticEvaluationBatch(batch, {
            revision, getCurrentRevision: () => stillCurrent() ? revision : null,
            evaluate: options.evaluate, cachedOutcomes: options.cachedOutcomes ?? new Map(),
        });
        if (outcome.kind !== 'complete' || !stillCurrent()) return Object.freeze({kind: outcome.kind === 'complete' ? 'stale' : outcome.kind});
        // Validate the entire batch *before* writing any result.
        for (const result of outcome.state.outcomes) {
            if (result.status === 'success' && !isValue(result.value)) {
                throw new TypeError(`invalid semantic Value for ${result.blockId}`);
            }
        }
        const byId = new Map(initial.map(e => [e.id, e.block]));
        for (const result of outcome.state.outcomes) {
            const block = byId.get(result.blockId);
            if (!block) throw new TypeError('semantic batch referenced a foreign block');
            block.calculation = {
                status: result.status === 'success' ? 'success' : 'error',
                generation: block.calculation.generation,
                result: result.status === 'success' ? result.value : null,
                error: result.status === 'failure' ? {code: result.code, message: result.message} : null,
            };
        }
        return outcome;
    }

    /**
     * P0021 Slice 53: selective semantic execution using the authoritative
     * calculation slots as the ONLY cache source. The cache is an ephemeral,
     * revision-stamped adapter for the existing dispatcher, not runtime state.
     * A caller supplies the existing evaluator through createEvaluate.
     */
    async evaluateAndCommitDirtySemanticTask(taskId = 'default', {
        revision, getCurrentRevision, createEvaluate,
    } = {}) {
        if (typeof revision !== 'string' || !revision ||
            typeof getCurrentRevision !== 'function' ||
            typeof createEvaluate !== 'function') {
            throw new TypeError('selective evaluation requires revision and evaluator factory');
        }
        const owned = this.blocks.filter(b => b.type === 'formula' && b.taskId === taskId);
        const recompute = new Set();
        const cachedIds = [];
        const cachedOutcomes = new Map();
        for (const block of owned) {
            if (block.calculation.status === 'success') {
                if (!isValue(block.calculation.result)) {
                    throw new TypeError(`invalid cached Value for ${block.id}`);
                }
                cachedIds.push(block.id);
                cachedOutcomes.set(block.id, {revision, outcome: {
                    blockId: block.id, status: 'success', value: block.calculation.result,
                }});
            } else {
                recompute.add(block.id);
            }
        }
        const {snapshot} = this.deriveSemanticTask(taskId);
        const evaluate = createEvaluate({snapshot, revision, cachedOutcomes});
        if (typeof evaluate !== 'function') throw new TypeError('evaluator factory must return function');
        return this.evaluateAndCommitSemanticTask(taskId, {
            revision, getCurrentRevision, recompute, cachedIds, cachedOutcomes, evaluate,
        });
    }

    /** Transient P0020/P0021 facts, never an authoritative parallel registry. */
    captureSemanticAnalyses() {
        const analyses = new Map();
        for (const block of this.blocks) {
            if (block.type !== 'formula') continue;
            const taskId = block.taskId;
            if (!analyses.has(taskId)) {
                analyses.set(taskId, this.deriveSemanticTask(taskId).analysis);
            }
        }
        return analyses;
    }

    /** Invalidate changed provider bindings using the same semantic source facts. */
    invalidateSemanticChanges(previous) {
        const current = this.captureSemanticAnalyses();
        const affected = new Set();
        for (const [taskId, next] of current) {
            const old = previous.get(taskId);
            for (const [blockId, nextBindings] of next.bindings) {
                if (!old?.bindings.has(blockId)) continue; // inserted block is not a changed former calculation
                const previousBindings = old?.bindings.get(blockId) ?? new Map();
                const names = new Set([...previousBindings.keys(), ...nextBindings.keys()]);
                if ([...names].some(name => previousBindings.get(name) !== nextBindings.get(name))) {
                    affected.add(blockId);
                    for (const id of old?.graph.getAllDownstream(blockId) ?? []) affected.add(id);
                    for (const id of next.graph.getAllDownstream(blockId)) affected.add(id);
                }
            }
        }
        for (const blockId of affected) this.markBlockDirty(blockId);
        return affected;
    }

    getDependencyGraph(taskId = 'default') {
        return this.dependencyAnalysis.get(taskId)?.graph ?? null;
    }

    markBlockDirty(blockId) {
        const block = this.getBlock(blockId);

        if (!block || block.type !== 'formula') {
            return;
        }

        const status = block.calculation.status;

        if (status === 'idle' || status === 'dirty') {
            return;
        }

        block.calculation = {
            status: 'dirty',
            generation: block.calculation.generation + 1,
            result: null,
            error: null
        };
    }

    invalidateStructuralChanges(oldAnalysis) {
    const changedBlocks = findBlocksWithChangedBindings(
        oldAnalysis,
        this.dependencyAnalysis
    );

    const affectedBlocks = new Set(changedBlocks);

    for (const blockId of changedBlocks) {
        const block = this.getBlock(blockId);

        if (!block || block.type !== 'formula') {
            continue;
        }

        const graph = this.getDependencyGraph(block.taskId);

        for (
            const downstreamId of
            graph?.getAllDownstream(blockId) ?? []
        ) {
            affectedBlocks.add(downstreamId);
        }
    }

    for (const blockId of affectedBlocks) {
        this.markBlockDirty(blockId);
    }

    return affectedBlocks;
    }

    moveBlock(blockId, newIndex) {
        const oldIndex =
            this.blocks.findIndex(block => block.id === blockId);

        if (oldIndex === -1) {
            throw new Error(`Block '${blockId}' findes ikke`);
        }

        if (
            !Number.isInteger(newIndex) ||
            newIndex < 0 ||
            newIndex >= this.blocks.length
        ) {
            throw new Error(`Ugyldigt block index: ${newIndex}`);
        }

        if (oldIndex === newIndex) {
            return new Set();
        }

        const oldSemantic = this.captureSemanticAnalyses();
        const oldAnalysis = this.dependencyAnalysis;

        const [block] = this.blocks.splice(oldIndex, 1);
        this.blocks.splice(newIndex, 0, block);

        this.rebuildDependencyAnalysis();

        const affected = this.invalidateStructuralChanges(oldAnalysis);
        for (const id of this.invalidateSemanticChanges(oldSemantic)) affected.add(id);
        this.notifySemanticChange([block.taskId]);
        return affected;
    }

    removeBlock(blockId) {
        const index =
            this.blocks.findIndex(block => block.id === blockId);

        if (index === -1) {
            throw new Error(`Block '${blockId}' findes ikke`);
        }

        const oldSemantic = this.captureSemanticAnalyses();
        const oldAnalysis = this.dependencyAnalysis;
        const removedTaskId = this.blocks[index].taskId;

        this.blocks.splice(index, 1);

        this.rebuildDependencyAnalysis();

        const affected = this.invalidateStructuralChanges(oldAnalysis);
        for (const id of this.invalidateSemanticChanges(oldSemantic)) affected.add(id);
        this.notifySemanticChange([removedTaskId]);
        return affected;
    }

    insertBlock(block, index) {
        if (
            !Number.isInteger(index) ||
            index < 0 ||
            index > this.blocks.length
        ) {
            throw new Error(`Ugyldigt block index: ${index}`);
        }

        const storedBlock = this.prepareBlock(block);
        const oldSemantic = this.captureSemanticAnalyses();
        const oldAnalysis = this.dependencyAnalysis;

        this.blocks.splice(index, 0, storedBlock);

        this.rebuildDependencyAnalysis();

        const affected = this.invalidateStructuralChanges(oldAnalysis);
        for (const id of this.invalidateSemanticChanges(oldSemantic)) affected.add(id);
        if (storedBlock.type === 'formula') this.notifySemanticChange([storedBlock.taskId]);
        return affected;
    }
}
