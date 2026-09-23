/**
 * document-runtime.js
 *
 * Dokumentlagets grænse mod CASEngine.
 *
 * DocumentRuntime ejer document/task-identitet, så UI og senere
 * persistence ikke behøver kende CASEngine's globale task namespace.
 */

import { parse } from './parser.mjs';
import { analyzeDependencies } from './dependency-analyzer.js';
import { buildDocumentDependencyGraphs } from './document-dependency-graph.js';

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
        this.dependencyGraphs = new Map();
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

    addBlock(block) {
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

        this.blocks.push(storedBlock);
        this.rebuildDependencyGraphs();

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
        this.rebuildDependencyGraphs();

        const newGraph = this.getDependencyGraph(block.taskId);
        const newDownstream =
            newGraph?.getAllDownstream(blockId) ?? [];

        // Både tidligere og nye downstream blocks er nu potentielt ugyldige.
        const affected = new Set([
            ...oldDownstream,
            ...newDownstream
        ]);

        for (const affectedBlockId of affected) {
            this.markBlockDirty(affectedBlockId);
        }
    }

    rebuildDependencyGraphs() {
        this.dependencyGraphs =
            buildDocumentDependencyGraphs(this.blocks);
    }

    getDependencyGraph(taskId = 'default') {
        return this.dependencyGraphs.get(taskId) ?? null;
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

        block.calculation.generation++;
        block.calculation.status = 'dirty';
    }
}