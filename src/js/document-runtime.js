/**
 * document-runtime.js
 *
 * DocumentRuntime owns authoritative document sources, identities, dependencies
 * and calculation projections. The attested Semantic IR path does not need a
 * legacy engine. Historical CASEngine delegation stays explicit until cutover.
 * No evaluator, Python scope or alternate document state is created here.
 */

import { parse } from './parser.mjs';
import {deriveSourceSemanticSnapshot} from './semantics/derive-source-semantic-snapshot.js';
import {projectSemanticDependencyAnalysis} from './semantics/project-semantic-dependency-analysis.js';
import {orderSemanticRecomputation} from './semantics/order-semantic-recomputation.js';
import {prepareSemanticEvaluationBatch} from './semantics/prepare-semantic-evaluation-batch.js';
import {dispatchSemanticEvaluationBatch} from './semantics/dispatch-semantic-evaluation-batch.js';
import {isValue} from './values/value.js';
import {isDiagnostic} from './diagnostics/diagnostic.js';
import { analyzeDependencies } from './dependency-analyzer.js';
import {
    buildDocumentDependencyAnalysis,
    findBlocksWithChangedBindings
} from './document-dependency-graph.js';
// Source persistence must be independent of source completeness. A block
// without exactly one supported statement supplies no legacy graph writer;
// authoritative semantic binding is derived separately from source.
function sourceDependencies(source) {
    if (typeof source !== 'string') throw new TypeError('formula source must be a string');
    if (!source.trim()) return {reads: [], writes: []};
    try {
        const ast = parse(source);
        if (!Array.isArray(ast) || ast.length !== 1) return {reads: [], writes: []};
        return analyzeDependencies(ast);
    } catch {
        // Invalid/incomplete editor source is data, not a document mutation error.
        return {reads: [], writes: []};
    }
}

// S95n: prepared transactions are opaque capabilities, scoped to one runtime.
// These are ephemeral validation products, never an alternative document model.
const preparedDocumentTransactions = new WeakMap();

// Private factory token: callers cannot silently opt out of legacy-engine
// validation by passing null or a lookalike options object.
const SEMANTIC_ONLY = Symbol('DocumentRuntime.semantic-only');

export class DocumentRuntime {
    /** Preferred for the selected IR/Value/Worker pipeline; no CASEngine. */
    static createSemantic(documentId) {
        return new DocumentRuntime(null, documentId, SEMANTIC_ONLY);
    }

    constructor(engine, documentId, constructionToken) {
        const semanticOnly = constructionToken === SEMANTIC_ONLY;
        if (constructionToken !== undefined && !semanticOnly) {
            throw new TypeError('Unsupported DocumentRuntime construction mode');
        }
        if (!semanticOnly && !engine) {
            throw new Error('DocumentRuntime kræver en CASEngine.');
        }
        if (semanticOnly && engine != null) {
            throw new TypeError('Semantic-only DocumentRuntime cannot receive a legacy engine');
        }

        if (!documentId || typeof documentId !== 'string') {
            throw new Error('DocumentRuntime kræver et documentId.');
        }

        if (semanticOnly) {
            // This capability must not be attached to a legacy engine later.
            Object.defineProperty(this, 'engine', {
                value: null, enumerable: true, writable: false, configurable: false,
            });
        } else {
            this.engine = engine;
        }
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

    // Legacy entrypoints are deliberately unavailable in semantic-only mode.
    // In particular, reject BEFORE legacy calculateBlock changes a result slot.
    #requireLegacyEngine() {
        if (!this.engine) throw new Error('LEGACY_ENGINE_UNAVAILABLE');
    }

    /**
     * Legacy-only task namespace bridge; not used by the semantic evaluator.
     */
    taskKey(taskId = 'default') {
        return `${this.documentId}:${taskId}`;
    }

    /**
     * Beregn et AST i dokumentets task-scope.
     */
    async calculate(ast, taskId = 'default') {
        this.#requireLegacyEngine();
        return this.engine.calculate(
            ast,
            this.taskKey(taskId)
        );
    }

    /**
     * Hent state for et task-scope i dokumentet.
     */
    async getTaskState(taskId = 'default') {
        this.#requireLegacyEngine();
        return this.engine.getTaskState(
            this.taskKey(taskId)
        );
    }

    async resetTask(taskId = 'default') {
        this.#requireLegacyEngine();
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

            storedBlock.dependencies = sourceDependencies(storedBlock.source);

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
        this.#requireLegacyEngine();
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
        this.#requireLegacyEngine();
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
        this.#requireLegacyEngine();
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

        // Validate input type and derive optional dependencies before mutation.
        // Syntax-invalid or unsupported source is still committed as source data.
        const dependencies = sourceDependencies(source);

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
                error: result.status === 'failure' ? {
                    code: result.code, message: result.message,
                    ...(isDiagnostic(result.diagnostic) ? {diagnostic: result.diagnostic} : {}),
                } : null,
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

    /**
     * S95n/P0027: prevalidate an atomic formula-document transaction.
     * No document, result slot, revision, dependency or listener is touched.
     * One user action may contain several ordered primitive changes.
     */
    prepareDocumentTransaction(operations) {
        if (this.engine !== null) throw new Error('S95N_SEMANTIC_RUNTIME_REQUIRED');
        if (!Array.isArray(operations) || operations.length === 0 ||
            operations.some(op => !op || typeof op !== 'object' || Array.isArray(op))) {
            throw new TypeError('S95N_TRANSACTION_INVALID');
        }
        const base = this.blocks.map(block => Object.freeze({
            ref: block, id: block.id, source: block.source, taskId: block.taskId,
            type: block.type, generation: block.calculation?.generation,
        }));
        const staged = [...this.blocks]; // temporary working references; not authoritative
        const forward = [], inverse = [], changedSources = new Set();
        let changed = false;
        for (const raw of operations) {
            const fields = Object.keys(raw).sort().join(',');
            const id = raw.blockId;
            if (typeof id !== 'string' || !id) throw new TypeError('S95N_BLOCK_ID_INVALID');
            const index = staged.findIndex(block => block.id === id);
            const found = staged[index];
            if (raw.kind === 'source') {
                if (fields !== 'blockId,kind,source' || index < 0 ||
                    found.type !== 'formula' || typeof raw.source !== 'string')
                    throw new TypeError('S95N_SOURCE_INVALID');
                if (found.source === raw.source) continue;
                const dependencies = sourceDependencies(raw.source);
                const next = {...found, source: raw.source, dependencies,
                    calculation: {status:'idle',generation:found.calculation.generation + 1,
                        result:null,error:null}};
                staged[index] = next;
                forward.push(Object.freeze({kind:'source',blockId:id,source:raw.source}));
                inverse.unshift(Object.freeze({kind:'source',blockId:id,source:found.source}));
                changedSources.add(id); changed = true;
            } else if (raw.kind === 'insert') {
                if (fields !== 'blockId,index,kind,source,taskId' || index !== -1 ||
                    typeof raw.source !== 'string' || typeof raw.taskId !== 'string' ||
                    !raw.taskId || !Number.isSafeInteger(raw.index) ||
                    raw.index < 0 || raw.index > staged.length)
                    throw new TypeError('S95N_INSERT_INVALID');
                const block = {id,type:'formula',taskId:raw.taskId,source:raw.source,
                    dependencies:sourceDependencies(raw.source),
                    calculation:{status:'idle',generation:0,result:null,error:null}};
                staged.splice(raw.index,0,block);
                forward.push(Object.freeze({kind:'insert',blockId:id,index:raw.index,
                    source:raw.source,taskId:raw.taskId}));
                inverse.unshift(Object.freeze({kind:'remove',blockId:id}));
                changedSources.add(id); changed = true;
            } else if (raw.kind === 'remove') {
                if (fields !== 'blockId,kind' || index < 0 || found.type !== 'formula')
                    throw new TypeError('S95N_REMOVE_INVALID');
                staged.splice(index,1);
                forward.push(Object.freeze({kind:'remove',blockId:id}));
                inverse.unshift(Object.freeze({kind:'insert',blockId:id,index,
                    source:found.source,taskId:found.taskId}));
                changedSources.add(id); changed = true;
            } else if (raw.kind === 'move') {
                if (fields !== 'blockId,index,kind' || index < 0 ||
                    found.type !== 'formula' || !Number.isSafeInteger(raw.index) ||
                    raw.index < 0 || raw.index >= staged.length)
                    throw new TypeError('S95N_MOVE_INVALID');
                if (index === raw.index) continue;
                staged.splice(index,1);
                staged.splice(raw.index,0,found); // preserve unchanged block object
                forward.push(Object.freeze({kind:'move',blockId:id,index:raw.index}));
                inverse.unshift(Object.freeze({kind:'move',blockId:id,index}));
                changed = true;
            } else {
                throw new TypeError('S95N_OPERATION_INVALID');
            }
        }
        const plan = Object.freeze({changed,
            forward:Object.freeze(forward), inverse:Object.freeze(inverse)});
        preparedDocumentTransactions.set(plan,{runtime:this,base,staged,changedSources});
        return plan;
    }

    /** Publish a prevalidated transaction with one graph rebuild and notification. */
    applyDocumentTransaction(plan) {
        const prepared = preparedDocumentTransactions.get(plan);
        if (!prepared || prepared.runtime !== this)
            throw new TypeError('S95N_PLAN_INVALID');
        // Single-use, even if a guarded apply fails. No reusable stale plans.
        preparedDocumentTransactions.delete(plan);
        const {base,staged,changedSources} = prepared;
        if (base.length !== this.blocks.length || base.some((old,i) => {
            const current = this.blocks[i];
            return current !== old.ref || current.id !== old.id ||
                current.source !== old.source || current.type !== old.type ||
                current.taskId !== old.taskId ||
                current.calculation?.generation !== old.generation;
        })) throw new Error('S95N_STALE_PLAN');
        if (!plan.changed) return Object.freeze({kind:'unchanged',affectedBlockIds:Object.freeze([])});
        const previousBlocks = this.blocks;
        const previousAnalysis = this.dependencyAnalysis;
        const previousCalcs = new Map(previousBlocks.filter(b => b.type === 'formula')
            .map(b => [b, b.calculation]));
        const previousSemantic = this.captureSemanticAnalyses();
        const formerDownstream = new Set();
        for (const id of changedSources) {
            const old = previousBlocks.find(block => block.id === id);
            if (!old || old.type !== 'formula') continue;
            for (const downstream of previousSemantic.get(old.taskId)?.graph.getAllDownstream(id) ?? [])
                formerDownstream.add(downstream);
        }
        // Rebuild before publishing. A failure here cannot leave the staged
        // sources or graph authoritative.
        try {
            this.blocks = staged;
            this.rebuildDependencyAnalysis();
            const nextSemantic = this.captureSemanticAnalyses();
            const affected = new Set([...changedSources]);
            for (const id of changedSources) {
                const block = this.getBlock(id);
                if (block?.type !== 'formula') continue;
                for (const child of nextSemantic.get(block.taskId)?.graph.getAllDownstream(id) ?? [])
                    affected.add(child);
            }
            for (const child of formerDownstream) affected.add(child);
            for (const id of this.invalidateStructuralChanges(previousAnalysis)) affected.add(id);
            for (const id of this.invalidateSemanticChanges(previousSemantic)) affected.add(id);
            for (const id of affected) this.markBlockDirty(id);
            const tasks = new Set();
            for (const op of plan.forward) {
                const before = previousBlocks.find(b => b.id === op.blockId);
                const after = staged.find(b => b.id === op.blockId);
                if (before?.type === 'formula') tasks.add(before.taskId);
                if (after?.type === 'formula') tasks.add(after.taskId);
            }
            // Rebuild/invalidation completed; only now send notifications.
            // A throwing observer cannot undo an already published transaction
            // or make the session lose its Undo record.
            let notificationErrors = 0;
            for (const listener of this.semanticChangeListeners) {
                try { listener(Object.freeze([...tasks])); }
                catch { notificationErrors++; }
            }
            return Object.freeze({kind:'applied',notificationErrors,
                affectedBlockIds:Object.freeze([...affected])});
        } catch (error) {
            // The prepared transaction never partially publishes block order or
            // source. Unexpected renderer/listener errors are caller failures.
            this.blocks = previousBlocks;
            this.dependencyAnalysis = previousAnalysis;
            for (const [block, calculation] of previousCalcs) block.calculation = calculation;
            throw error;
        }
    }

}
