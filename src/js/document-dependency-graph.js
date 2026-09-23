import { DependencyGraph } from './dependency-graph.js';


/**
 * Builds dependency analysis for the tasks in a document.
 *
 * A symbol read depends on the nearest preceding formula block
 * in the same task that writes that symbol.
 *
 * Document order is therefore significant.
 */
export function buildDocumentDependencyAnalysis(blocks) {
    const taskAnalysis = new Map();
    const latestWriters = new Map();

    for (const block of blocks) {
        if (block.type !== 'formula') {
            continue;
        }

        const taskId = block.taskId ?? 'default';

        if (!taskAnalysis.has(taskId)) {
            taskAnalysis.set(taskId, {
                graph: new DependencyGraph(),
                bindings: new Map()
            });

            latestWriters.set(taskId, new Map());
        }

        const analysis = taskAnalysis.get(taskId);
        const graph = analysis.graph;
        const latestWriter = latestWriters.get(taskId);

        graph.addNode(block.id);

        const blockBindings = new Map();
        analysis.bindings.set(block.id, blockBindings);

        // Reads are resolved before writes.
        // This makes e.g. a:=a+1 depend on the preceding definition of a.
        for (const symbol of block.dependencies?.reads ?? []) {
        const provider = latestWriter.get(symbol);

        if (provider !== undefined) {
            graph.addEdge(provider, block.id);
            blockBindings.set(symbol, provider);
        }
    }

        for (const symbol of block.dependencies?.writes ?? []) {
            latestWriter.set(symbol, block.id);
        }
    }

    return taskAnalysis;
}

export function findBlocksWithChangedBindings(
    oldAnalysis,
    newAnalysis
) {
    const changed = new Set();

    for (const [taskId, newTask] of newAnalysis) {
        const oldTask = oldAnalysis.get(taskId);

        if (!oldTask) {
            // Hele tasken er ny.
            // Nye blocks har ingen tidligere beregning at invalidere.
            continue;
        }

        for (const [blockId, newBindings] of newTask.bindings) {
            const oldBindings = oldTask.bindings.get(blockId);

            if (!oldBindings) {
                // Ny block.
                continue;
            }

            if (!bindingsEqual(oldBindings, newBindings)) {
                changed.add(blockId);
            }
        }
    }

    return changed;
}


function bindingsEqual(a, b) {
    if (a.size !== b.size) {
        return false;
    }

    for (const [symbol, provider] of a) {
        if (b.get(symbol) !== provider) {
            return false;
        }
    }

    return true;
}