/**
 * dependency-graph.js
 *
 * Directed graph used by the Document Runtime dependency system.
 *
 * The graph stores both directions:
 *   outgoing: node -> downstream nodes
 *   incoming: node -> upstream nodes
 *
 * It knows nothing about formulas, symbols, parsing or calculation.
 */

export class DependencyGraph {
    constructor() {
        this.nodes = new Set();
        this.outgoing = new Map();
        this.incoming = new Map();
    }

    addNode(nodeId) {
        if (!this.nodes.has(nodeId)) {
            this.nodes.add(nodeId);
            this.outgoing.set(nodeId, new Set());
            this.incoming.set(nodeId, new Set());
        }
    }

    addEdge(from, to) {
        this.addNode(from);
        this.addNode(to);

        this.outgoing.get(from).add(to);
        this.incoming.get(to).add(from);
    }

    getDownstream(nodeId) {
        return [...(this.outgoing.get(nodeId) ?? [])];
    }

    getUpstream(nodeId) {
        return [...(this.incoming.get(nodeId) ?? [])];
    }

    hasEdge(from, to) {
        return this.outgoing.get(from)?.has(to) ?? false;
    }

    getAllDownstream(nodeId) {
        if (!this.nodes.has(nodeId)) {
            return [];
        }

        const visited = new Set();
        const stack = [...this.getDownstream(nodeId)];

        while (stack.length > 0) {
            const current = stack.pop();

            if (visited.has(current)) {
                continue;
            }

            visited.add(current);

            for (const next of this.getDownstream(current)) {
                if (!visited.has(next)) {
                    stack.push(next);
                }
            }
        }

        return [...visited];
    }

    getAllUpstream(nodeId) {
        if (!this.nodes.has(nodeId)) {
            return [];
        }

        const visited = new Set();
        const stack = [...this.getUpstream(nodeId)];

        while (stack.length > 0) {
            const current = stack.pop();

            if (visited.has(current)) {
                continue;
            }

            visited.add(current);

            for (const previous of this.getUpstream(current)) {
                if (!visited.has(previous)) {
                    stack.push(previous);
                }
            }
        }

        return [...visited];
    }
}