import { DependencyGraph } from './dependency-graph.js';


/**
 * Builds independent dependency graphs for the tasks in a document.
 *
 * A symbol read depends on the nearest preceding formula block
 * in the same task that writes that symbol.
 *
 * Document order is therefore significant.
 */
export function buildDocumentDependencyGraphs(blocks) {
    const taskGraphs = new Map();
    const latestWriters = new Map();

    for (const block of blocks) {
        if (block.type !== 'formula') {
            continue;
        }

        const taskId = block.taskId ?? 'default';

        if (!taskGraphs.has(taskId)) {
            taskGraphs.set(taskId, new DependencyGraph());
            latestWriters.set(taskId, new Map());
        }

        const graph = taskGraphs.get(taskId);
        const latestWriter = latestWriters.get(taskId);

        graph.addNode(block.id);

        // Reads are resolved before writes.
        // This makes e.g. a:=a+1 depend on the preceding definition of a.
        for (const symbol of block.dependencies?.reads ?? []) {
            const provider = latestWriter.get(symbol);

            if (provider !== undefined) {
                graph.addEdge(provider, block.id);
            }
        }

        for (const symbol of block.dependencies?.writes ?? []) {
            latestWriter.set(symbol, block.id);
        }
    }

    return taskGraphs;
}