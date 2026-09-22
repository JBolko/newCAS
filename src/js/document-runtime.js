/**
 * document-runtime.js
 *
 * Dokumentlagets grænse mod CASEngine.
 *
 * DocumentRuntime ejer document/task-identitet, så UI og senere
 * persistence ikke behøver kende CASEngine's globale task namespace.
 */
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

            storedBlock.calculation = {
                status: 'idle',
                result: null,
                error: null
            };
        }

        this.blocks.push(storedBlock);

        return storedBlock;
    }

    async calculateBlock(blockId, ast) {
        const block = this.getBlock(blockId);

        if (!block) {
            throw new Error(`Block findes ikke: ${blockId}`);
        }

        if (block.type !== 'formula') {
            throw new Error(`Block kan ikke beregnes: ${blockId}`);
        }

        block.calculation = {
            status: 'running',
            result: null,
            error: null
        };

        try {
            const result = await this.calculate(
                ast,
                block.taskId
            );

            block.calculation = {
                status: 'success',
                result,
                error: null
            };

            return result;

        } catch (error) {
            block.calculation = {
                status: 'error',
                result: null,
                error: {
                    message: error?.message ?? String(error)
                }
            };

            throw error;
        }
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

        block.source = source;

        block.calculation = {
            status: 'idle',
            result: null,
            error: null
        };
    }
}