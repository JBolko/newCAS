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
}