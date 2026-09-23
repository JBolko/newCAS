import test from 'node:test';
import assert from 'node:assert/strict';

import { DependencyGraph } from '../../src/js/dependency-graph.js';


test('graph stores nodes without edges', () => {
    const graph = new DependencyGraph();

    graph.addNode('A');

    assert.deepEqual(graph.getUpstream('A'), []);
    assert.deepEqual(graph.getDownstream('A'), []);
});


test('graph stores directed edge in both directions', () => {
    const graph = new DependencyGraph();

    graph.addEdge('A', 'B');

    assert.equal(graph.hasEdge('A', 'B'), true);
    assert.equal(graph.hasEdge('B', 'A'), false);

    assert.deepEqual(graph.getDownstream('A'), ['B']);
    assert.deepEqual(graph.getUpstream('B'), ['A']);
});


test('graph supports branching dependencies', () => {
    const graph = new DependencyGraph();

    graph.addEdge('A', 'B');
    graph.addEdge('A', 'C');

    assert.deepEqual(
        graph.getDownstream('A'),
        ['B', 'C']
    );

    assert.deepEqual(graph.getUpstream('B'), ['A']);
    assert.deepEqual(graph.getUpstream('C'), ['A']);
});


test('graph supports multiple upstream dependencies', () => {
    const graph = new DependencyGraph();

    graph.addEdge('A', 'C');
    graph.addEdge('B', 'C');

    assert.deepEqual(
        graph.getUpstream('C'),
        ['A', 'B']
    );
});


test('duplicate edges are stored once', () => {
    const graph = new DependencyGraph();

    graph.addEdge('A', 'B');
    graph.addEdge('A', 'B');

    assert.deepEqual(graph.getDownstream('A'), ['B']);
    assert.deepEqual(graph.getUpstream('B'), ['A']);
});

test('getAllDownstream follows dependency chain', () => {
    const graph = new DependencyGraph();

    graph.addEdge('A', 'B');
    graph.addEdge('B', 'C');

    assert.deepEqual(
        new Set(graph.getAllDownstream('A')),
        new Set(['B', 'C'])
    );
});


test('getAllDownstream follows branches', () => {
    const graph = new DependencyGraph();

    graph.addEdge('A', 'B');
    graph.addEdge('A', 'C');
    graph.addEdge('B', 'D');
    graph.addEdge('C', 'D');

    assert.deepEqual(
        new Set(graph.getAllDownstream('A')),
        new Set(['B', 'C', 'D'])
    );
});


test('getAllDownstream excludes starting node', () => {
    const graph = new DependencyGraph();

    graph.addEdge('A', 'B');

    assert.equal(
        graph.getAllDownstream('A').includes('A'),
        false
    );
});


test('getAllDownstream returns empty for unknown node', () => {
    const graph = new DependencyGraph();

    assert.deepEqual(
        graph.getAllDownstream('missing'),
        []
    );
});

test('getAllUpstream follows dependency chain', () => {
    const graph = new DependencyGraph();

    graph.addEdge('A', 'B');
    graph.addEdge('B', 'C');

    assert.deepEqual(
        new Set(graph.getAllUpstream('C')),
        new Set(['A', 'B'])
    );
});


test('getAllUpstream follows multiple dependency paths', () => {
    const graph = new DependencyGraph();

    graph.addEdge('A', 'C');
    graph.addEdge('B', 'C');
    graph.addEdge('C', 'D');

    assert.deepEqual(
        new Set(graph.getAllUpstream('D')),
        new Set(['A', 'B', 'C'])
    );
});


test('getAllUpstream returns empty for unknown node', () => {
    const graph = new DependencyGraph();

    assert.deepEqual(
        graph.getAllUpstream('missing'),
        []
    );
});