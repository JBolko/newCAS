import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildDocumentDependencyGraphs
} from '../../src/js/document-dependency-graph.js';


function formula(id, taskId, reads = [], writes = []) {
    return {
        id,
        type: 'formula',
        taskId,
        dependencies: {
            reads,
            writes
        }
    };
}


test('builds simple dependency chain', () => {
    const graphs = buildDocumentDependencyGraphs([
        formula('A', 'task-1', [], ['a']),
        formula('B', 'task-1', ['a'], ['b']),
        formula('C', 'task-1', ['b'], ['c'])
    ]);

    const graph = graphs.get('task-1');

    assert.deepEqual(graph.getDownstream('A'), ['B']);
    assert.deepEqual(graph.getDownstream('B'), ['C']);
    assert.deepEqual(graph.getUpstream('C'), ['B']);
});


test('supports branching dependencies', () => {
    const graphs = buildDocumentDependencyGraphs([
        formula('A', 'task-1', [], ['a']),
        formula('B', 'task-1', ['a'], ['b']),
        formula('C', 'task-1', ['a'], ['c'])
    ]);

    const graph = graphs.get('task-1');

    assert.deepEqual(
        graph.getDownstream('A'),
        ['B', 'C']
    );
});


test('uses nearest preceding writer after reassignment', () => {
    const graphs = buildDocumentDependencyGraphs([
        formula('A', 'task-1', [], ['a']),
        formula('B', 'task-1', ['a'], ['b']),
        formula('C', 'task-1', ['b'], ['a']),
        formula('D', 'task-1', ['a'], ['c'])
    ]);

    const graph = graphs.get('task-1');

    assert.equal(graph.hasEdge('A', 'B'), true);
    assert.equal(graph.hasEdge('B', 'C'), true);
    assert.equal(graph.hasEdge('C', 'D'), true);

    assert.equal(graph.hasEdge('A', 'D'), false);
});


test('inserted block uses definition active at its document position', () => {
    const graphs = buildDocumentDependencyGraphs([
        formula('A', 'task-1', [], ['a']),
        formula('B', 'task-1', ['a'], ['b']),
        formula('D', 'task-1', ['a'], ['c']),
        formula('C', 'task-1', ['b'], ['a'])
    ]);

    const graph = graphs.get('task-1');

    assert.equal(graph.hasEdge('A', 'B'), true);
    assert.equal(graph.hasEdge('A', 'D'), true);
    assert.equal(graph.hasEdge('B', 'C'), true);

    assert.equal(graph.hasEdge('C', 'D'), false);
});


test('read before write uses preceding definition', () => {
    const graphs = buildDocumentDependencyGraphs([
        formula('A', 'task-1', [], ['a']),
        formula('B', 'task-1', ['a'], ['a'])
    ]);

    const graph = graphs.get('task-1');

    assert.equal(graph.hasEdge('A', 'B'), true);
    assert.equal(graph.hasEdge('B', 'B'), false);
});


test('tasks have isolated dependency graphs', () => {
    const graphs = buildDocumentDependencyGraphs([
        formula('A', 'task-1', [], ['a']),
        formula('X', 'task-2', [], ['a']),
        formula('B', 'task-1', ['a'], ['b']),
        formula('Y', 'task-2', ['a'], ['b'])
    ]);

    const graph1 = graphs.get('task-1');
    const graph2 = graphs.get('task-2');

    assert.equal(graphs.size, 2);

    assert.equal(graph1.hasEdge('A', 'B'), true);
    assert.equal(graph2.hasEdge('X', 'Y'), true);

    assert.equal(graph1.hasEdge('X', 'B'), false);
    assert.equal(graph2.hasEdge('A', 'Y'), false);
});