import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildDocumentDependencyAnalysis,
    findBlocksWithChangedBindings
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
    const analysis  = buildDocumentDependencyAnalysis([
        formula('A', 'task-1', [], ['a']),
        formula('B', 'task-1', ['a'], ['b']),
        formula('C', 'task-1', ['b'], ['c'])
    ]);

    const graph = analysis.get('task-1').graph;

    assert.deepEqual(graph.getDownstream('A'), ['B']);
    assert.deepEqual(graph.getDownstream('B'), ['C']);
    assert.deepEqual(graph.getUpstream('C'), ['B']);
});


test('supports branching dependencies', () => {
    const analysis  = buildDocumentDependencyAnalysis([
        formula('A', 'task-1', [], ['a']),
        formula('B', 'task-1', ['a'], ['b']),
        formula('C', 'task-1', ['a'], ['c'])
    ]);

    const graph = analysis.get('task-1').graph;

    assert.deepEqual(
        graph.getDownstream('A'),
        ['B', 'C']
    );
});


test('uses nearest preceding writer after reassignment', () => {
    const analysis  = buildDocumentDependencyAnalysis([
        formula('A', 'task-1', [], ['a']),
        formula('B', 'task-1', ['a'], ['b']),
        formula('C', 'task-1', ['b'], ['a']),
        formula('D', 'task-1', ['a'], ['c'])
    ]);

    const graph = analysis.get('task-1').graph;

    assert.equal(graph.hasEdge('A', 'B'), true);
    assert.equal(graph.hasEdge('B', 'C'), true);
    assert.equal(graph.hasEdge('C', 'D'), true);

    assert.equal(graph.hasEdge('A', 'D'), false);
});


test('inserted block uses definition active at its document position', () => {
    const analysis  = buildDocumentDependencyAnalysis([
        formula('A', 'task-1', [], ['a']),
        formula('B', 'task-1', ['a'], ['b']),
        formula('D', 'task-1', ['a'], ['c']),
        formula('C', 'task-1', ['b'], ['a'])
    ]);

    const graph = analysis.get('task-1').graph;

    assert.equal(graph.hasEdge('A', 'B'), true);
    assert.equal(graph.hasEdge('A', 'D'), true);
    assert.equal(graph.hasEdge('B', 'C'), true);

    assert.equal(graph.hasEdge('C', 'D'), false);
});


test('read before write uses preceding definition', () => {
    const analysis  = buildDocumentDependencyAnalysis([
        formula('A', 'task-1', [], ['a']),
        formula('B', 'task-1', ['a'], ['a'])
    ]);

    const graph = analysis.get('task-1').graph;

    assert.equal(graph.hasEdge('A', 'B'), true);
    assert.equal(graph.hasEdge('B', 'B'), false);
});

test('tasks have isolated dependency graphs', () => {
    const analysis  = buildDocumentDependencyAnalysis([
        formula('A', 'task-1', [], ['a']),
        formula('X', 'task-2', [], ['a']),
        formula('B', 'task-1', ['a'], ['b']),
        formula('Y', 'task-2', ['a'], ['b'])
    ]);

    const graph1 = analysis.get('task-1').graph;
    const graph2 = analysis.get('task-2').graph;

    assert.equal(analysis.size, 2);

    assert.equal(graph1.hasEdge('A', 'B'), true);
    assert.equal(graph2.hasEdge('X', 'Y'), true);

    assert.equal(graph1.hasEdge('X', 'B'), false);
    assert.equal(graph2.hasEdge('A', 'Y'), false);
});

test('records symbol provider bindings', () => {
    const analysis = buildDocumentDependencyAnalysis([
        formula('A', 'task-1', [], ['a']),
        formula('B', 'task-1', [], ['b']),
        formula('X', 'task-1', ['a', 'b'], ['x'])
    ]);

    const bindings =
        analysis.get('task-1').bindings.get('X');

    assert.deepEqual(
        [...bindings.entries()],
        [
            ['a', 'A'],
            ['b', 'B']
        ]
    );
});

test('bindings detect provider changes hidden by identical graph edges', () => {
    const before = buildDocumentDependencyAnalysis([
        formula('A', 'task-1', [], ['a', 'b']),
        formula('B', 'task-1', [], ['b', 'c']),
        formula('X', 'task-1', ['a', 'b', 'c'], ['x'])
    ]);

    const after = buildDocumentDependencyAnalysis([
        formula('B', 'task-1', [], ['b', 'c']),
        formula('A', 'task-1', [], ['a', 'b']),
        formula('X', 'task-1', ['a', 'b', 'c'], ['x'])
    ]);

    const oldTask = before.get('task-1');
    const newTask = after.get('task-1');

    // Graph edges are identical.
    assert.deepEqual(
        new Set(oldTask.graph.getUpstream('X')),
        new Set(newTask.graph.getUpstream('X'))
    );

    // But the provider of b has changed.
    assert.equal(
        oldTask.bindings.get('X').get('b'),
        'B'
    );

    assert.equal(
        newTask.bindings.get('X').get('b'),
        'A'
    );
});

test('unchanged bindings are not reported as changed', () => {
    const blocks = [
        formula('A', 'task-1', [], ['a']),
        formula('B', 'task-1', ['a'], ['b'])
    ];

    const before = buildDocumentDependencyAnalysis(blocks);
    const after = buildDocumentDependencyAnalysis(blocks);

    const changed =
        findBlocksWithChangedBindings(before, after);

    assert.deepEqual([...changed], []);
});


test('changed provider is reported', () => {
    const before = buildDocumentDependencyAnalysis([
        formula('A', 'task-1', [], ['a']),
        formula('B', 'task-1', ['a'], ['b']),
        formula('C', 'task-1', [], ['a'])
    ]);

    const after = buildDocumentDependencyAnalysis([
        formula('A', 'task-1', [], ['a']),
        formula('C', 'task-1', [], ['a']),
        formula('B', 'task-1', ['a'], ['b'])
    ]);

    const changed =
        findBlocksWithChangedBindings(before, after);

    assert.deepEqual(changed, new Set(['B']));
});


test('lost provider is reported', () => {
    const before = buildDocumentDependencyAnalysis([
        formula('A', 'task-1', [], ['a']),
        formula('B', 'task-1', ['a'], ['b'])
    ]);

    const after = buildDocumentDependencyAnalysis([
        formula('B', 'task-1', ['a'], ['b']),
        formula('A', 'task-1', [], ['a'])
    ]);

    const changed =
        findBlocksWithChangedBindings(before, after);

    assert.deepEqual(changed, new Set(['B']));
});


test('new provider is reported', () => {
    const before = buildDocumentDependencyAnalysis([
        formula('B', 'task-1', ['a'], ['b']),
        formula('A', 'task-1', [], ['a'])
    ]);

    const after = buildDocumentDependencyAnalysis([
        formula('A', 'task-1', [], ['a']),
        formula('B', 'task-1', ['a'], ['b'])
    ]);

    const changed =
        findBlocksWithChangedBindings(before, after);

    assert.deepEqual(changed, new Set(['B']));
});


test('new and removed blocks are not reported as changed', () => {
    const before = buildDocumentDependencyAnalysis([
        formula('A', 'task-1', [], ['a']),
        formula('B', 'task-1', [], ['b'])
    ]);

    const after = buildDocumentDependencyAnalysis([
        formula('A', 'task-1', [], ['a']),
        formula('C', 'task-1', [], ['c'])
    ]);

    const changed =
        findBlocksWithChangedBindings(before, after);

    assert.deepEqual([...changed], []);
});


test('detects binding change hidden by identical graph edges', () => {
    const before = buildDocumentDependencyAnalysis([
        formula('A', 'task-1', [], ['a', 'b']),
        formula('B', 'task-1', [], ['b', 'c']),
        formula('X', 'task-1', ['a', 'b', 'c'], ['x'])
    ]);

    const after = buildDocumentDependencyAnalysis([
        formula('B', 'task-1', [], ['b', 'c']),
        formula('A', 'task-1', [], ['a', 'b']),
        formula('X', 'task-1', ['a', 'b', 'c'], ['x'])
    ]);

    const changed =
        findBlocksWithChangedBindings(before, after);

    assert.deepEqual(changed, new Set(['X']));
});