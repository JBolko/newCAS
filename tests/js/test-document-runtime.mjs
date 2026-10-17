import test from 'node:test';
import assert from 'node:assert/strict';

import { DocumentRuntime } from '../../src/js/document-runtime.js';
import { analyzeDependencies } from '../../src/js/dependency-analyzer.js';


function makeFakeEngine() {
    return {
        calculateCalls: [],
        calculateError: null,
        stateCalls: [],

        async calculate(ast, taskId) {
            this.calculateCalls.push({ ast, taskId });

            if (this.calculateError) {
                throw this.calculateError;
            }

            return {
                type: 'success'
            };
        },

        async getTaskState(taskId) {
            this.stateCalls.push(taskId);

            return {
                type: 'scope',
                task_id: taskId,
                variables: []
            };
        }
    };
}


test('DocumentRuntime namespaces task ids by document', async () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    const ast = { type: 'Literal', value: 5 };

    await runtime.calculate(ast, 'task-1');

    assert.deepEqual(engine.calculateCalls, [
        {
            ast,
            taskId: 'document-17:task-1'
        }
    ]);
});


test('DocumentRuntime reads state from namespaced task', async () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    const state = await runtime.getTaskState('task-1');

    assert.deepEqual(engine.stateCalls, [
        'document-17:task-1'
    ]);

    assert.equal(
        state.task_id,
        'document-17:task-1'
    );
});


test('different documents isolate identical task ids', async () => {
    const engine = makeFakeEngine();

    const documentA = new DocumentRuntime(engine, 'document-A');
    const documentB = new DocumentRuntime(engine, 'document-B');

    const ast = { type: 'Literal', value: 5 };

    await documentA.calculate(ast, 'task-1');
    await documentB.calculate(ast, 'task-1');

    assert.deepEqual(
        engine.calculateCalls.map(call => call.taskId),
        [
            'document-A:task-1',
            'document-B:task-1'
        ]
    );
});


test('DocumentRuntime uses a document-local default task', async () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    await runtime.getTaskState();

    assert.deepEqual(engine.stateCalls, [
        'document-17:default'
    ]);
});


test('DocumentRuntime validates constructor arguments', () => {
    assert.throws(
        () => new DocumentRuntime(null, 'document-17'),
        /CASEngine/
    );

    assert.throws(
        () => new DocumentRuntime({}, ''),
        /documentId/
    );
});

test('DocumentRuntime stores ordered document blocks', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'text-1',
        type: 'text',
        text: 'Beregn følgende:'
    });

    runtime.addBlock({
        id: 'formula-1',
        type: 'formula',
        taskId: 'task-1'
    });

    assert.deepEqual(runtime.getBlocks(), [
        {
            id: 'text-1',
            type: 'text',
            text: 'Beregn følgende:'
        },
        {
            id: 'formula-1',
            type: 'formula',
            taskId: 'task-1',
            source: '',
            dependencies: {
                reads: [],
                writes: []
            },
            calculation: {
                status: 'idle',
                generation: 0,
                result: null,
                error: null
            }
        }
    ]);
});


test('DocumentRuntime rejects duplicate block ids', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'formula-1',
        type: 'formula'
    });

    assert.throws(
        () => runtime.addBlock({
            id: 'formula-1',
            type: 'formula'
        }),
        /findes allerede/
    );
});


test('calculateBlock uses formula block task scope', async () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'formula-1',
        type: 'formula',
        source: '5',
        taskId: 'algebra'
    });

    await runtime.calculateBlock('formula-1');

    assert.equal(engine.calculateCalls.length, 1);

    assert.equal(
        engine.calculateCalls[0].taskId,
        'document-17:algebra'
    );

});

test('calculateBlock rejects non-formula blocks', async () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'text-1',
        type: 'text',
        text: 'Hej'
    });

    await assert.rejects(
        () => runtime.calculateBlock('text-1'),
        /kan ikke beregnes/
    );
});

test('formula block starts with idle calculation state', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'formula-1',
        type: 'formula',
        source: 'sqrt(2)',
        taskId: 'algebra'
    });

    const block = runtime.getBlock('formula-1');

    assert.deepEqual(block.calculation, {
        status: 'idle',
        generation: 0,
        result: null,
        error: null
    });
});

test('calculateBlock stores successful result', async () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'formula-1',
        type: 'formula',
        source: '5',
        taskId: 'algebra'
    });

    await runtime.calculateBlock('formula-1');

    const block = runtime.getBlock('formula-1');

    assert.equal(block.calculation.status, 'success');
    assert.deepEqual(block.calculation.result, {
        type: 'success'
    });
    assert.equal(block.calculation.error, null);
});

test('changing formula source invalidates previous result', async () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'formula-1',
        type: 'formula',
        source: '5'
    });

    await runtime.calculateBlock('formula-1');

    runtime.setBlockSource('formula-1', '6');

    const block = runtime.getBlock('formula-1');

    assert.equal(block.source, '6');

    assert.deepEqual(block.calculation, {
        status: 'idle',
        generation: 1,
        result: null,
        error: null
    });
});

test('calculateBlock exposes running state while calculation is pending', async () => {
    let resolveCalculation;

    const engine = {
        calculate(ast, taskId) {
            return new Promise(resolve => {
                resolveCalculation = resolve;
            });
        },

        async getTaskState() {
            return {
                type: 'scope',
                task_id: 'unused',
                variables: []
            };
        }
    };

    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'formula-1',
        type: 'formula',
        source: '5'
    });

    const calculation = runtime.calculateBlock('formula-1');

    assert.equal(
        runtime.getBlock('formula-1').calculation.status,
        'running'
    );

    resolveCalculation({
        type: 'success'
    });

    await calculation;

    assert.equal(
        runtime.getBlock('formula-1').calculation.status,
        'success'
    );
});

test('calculateBlock stores error state when engine fails', async () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'formula-1',
        type: 'formula',
        source: '5',
        taskId: 'algebra'
    });

    engine.calculateError = new Error('Testfejl');

    await assert.rejects(
        () => runtime.calculateBlock('formula-1'),
        /Testfejl/
    );

    const block = runtime.getBlock('formula-1');

    assert.deepEqual(block.calculation, {
        status: 'error',
        generation: 0,
        result: null,
        error: {
            message: 'Testfejl'
        }
    });
});

test('changing source resets error state to idle', async () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'formula-1',
        type: 'formula',
        source: '5'
    });

    engine.calculateError = new Error('Testfejl');

    await assert.rejects(
        () => runtime.calculateBlock('formula-1')
    );

    runtime.setBlockSource('formula-1', '5');

    assert.deepEqual(
        runtime.getBlock('formula-1').calculation,
        {
            status: 'idle',
            generation: 1,
            result: null,
            error: null
        }
    );
});

test('formula block derives dependencies from source', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'formula-1',
        type: 'formula',
        source: 'b:=2*a'
    });

    assert.deepEqual(
        runtime.getBlock('formula-1').dependencies,
        {
            reads: ['a'],
            writes: ['b']
        }
    );
});

test('changing formula source updates dependencies', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'formula-1',
        type: 'formula',
        source: 'b:=2*a'
    });

    runtime.setBlockSource(
        'formula-1',
        'b:=3*c'
    );

    const block = runtime.getBlock('formula-1');

    assert.equal(block.source, 'b:=3*c');

    assert.deepEqual(
        block.dependencies,
        {
            reads: ['c'],
            writes: ['b']
        }
    );
});

test('invalid source is committed without creating a writer or hidden dependencies', () => {
    const runtime = new DocumentRuntime(makeFakeEngine(), 'document-17');
    runtime.addBlock({id: 'formula-1', type: 'formula', source: 'b:=2*a'});
    const generation = runtime.getBlock('formula-1').calculation.generation;
    assert.doesNotThrow(() => runtime.setBlockSource('formula-1', 'b:=('));
    const block = runtime.getBlock('formula-1');
    assert.equal(block.source, 'b:=(');
    assert.deepEqual(block.dependencies, {reads: [], writes: []});
    assert.equal(block.calculation.result, null);
    assert.ok(block.calculation.generation > generation);
    assert.equal(runtime.deriveSemanticTask().snapshot.blocks[0].parseError !== null, true);
});

test('empty formula source has no dependencies', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'formula-1',
        type: 'formula'
    });

    const block = runtime.getBlock('formula-1');

    assert.equal(block.source, '');

    assert.deepEqual(
        block.dependencies,
        {
            reads: [],
            writes: []
        }
    );
});

test('clearing formula source resets dependencies', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'formula-1',
        type: 'formula',
        source: 'b:=2*a'
    });

    runtime.setBlockSource('formula-1', '');

    const block = runtime.getBlock('formula-1');

    assert.equal(block.source, '');

    assert.deepEqual(
        block.dependencies,
        {
            reads: [],
            writes: []
        }
    );

    assert.equal(
        block.calculation.status,
        'idle'
    );
});

test('calculateBlock parses AST from formula source', async () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'formula-1',
        type: 'formula',
        source: 'b:=2*a',
        taskId: 'algebra'
    });

    await runtime.calculateBlock('formula-1');

    assert.equal(engine.calculateCalls.length, 1);

    const call = engine.calculateCalls[0];

    assert.equal(
        call.taskId,
        'document-17:algebra'
    );

    assert.deepEqual(
        analyzeDependencies(call.ast),
        {
            reads: ['a'],
            writes: ['b']
        }
    );
});

test('DocumentRuntime builds dependency graph from formula blocks', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=a+1',
        taskId: 'task-1'
    });

    const graph = runtime.getDependencyGraph('task-1');

    assert.equal(graph.hasEdge('A', 'B'), true);
});

test('DocumentRuntime respects document position when building dependencies', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=a+1',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'D',
        type: 'formula',
        source: 'c:=a-4',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'C',
        type: 'formula',
        source: 'a:=3*b',
        taskId: 'task-1'
    });

    const graph = runtime.getDependencyGraph('task-1');

    assert.equal(graph.hasEdge('A', 'B'), true);
    assert.equal(graph.hasEdge('A', 'D'), true);
    assert.equal(graph.hasEdge('B', 'C'), true);

    assert.equal(graph.hasEdge('C', 'D'), false);
});

test('changing formula source rebuilds dependency graph', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=3',
        taskId: 'task-1'
    });

    assert.equal(
        runtime.getDependencyGraph('task-1').hasEdge('A', 'B'),
        false
    );

    runtime.setBlockSource('B', 'b:=a+1');

    assert.equal(
        runtime.getDependencyGraph('task-1').hasEdge('A', 'B'),
        true
    );
});

test('DocumentRuntime keeps task dependency graphs isolated', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'X',
        type: 'formula',
        source: 'a:=100',
        taskId: 'task-2'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=a+1',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'Y',
        type: 'formula',
        source: 'b:=a+1',
        taskId: 'task-2'
    });

    const graph1 = runtime.getDependencyGraph('task-1');
    const graph2 = runtime.getDependencyGraph('task-2');

    assert.equal(graph1.hasEdge('A', 'B'), true);
    assert.equal(graph2.hasEdge('X', 'Y'), true);
    assert.equal(graph1.hasEdge('X', 'B'), false);
    assert.equal(graph2.hasEdge('A', 'Y'), false);
});

test('markBlockDirty marks successful formula block dirty', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2'
    });

    const block = runtime.getBlock('A');

    block.calculation.status = 'success';
    block.calculation.result = { type: 'scalar', value: '2' };

    runtime.markBlockDirty('A');

    assert.equal(block.calculation.status, 'dirty');
});


test('markBlockDirty clears obsolete result', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2'
    });

    const block = runtime.getBlock('A');
    const result = { type: 'scalar', value: '2' };

    block.calculation.status = 'success';
    block.calculation.result = result;

    runtime.markBlockDirty('A');

    assert.equal(block.calculation.result, null);
});


test('markBlockDirty keeps idle formula block idle', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2'
    });

    runtime.markBlockDirty('A');

    assert.equal(
        runtime.getBlock('A').calculation.status,
        'idle'
    );
});

test('markBlockDirty ignores text block', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'T',
        type: 'text',
        content: 'Hej'
    });

    assert.doesNotThrow(() => {
        runtime.markBlockDirty('T');
    });
});

test('changing source marks downstream block dirty', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({ id:'A', type:'formula', source:'a:=2', taskId:'task-1' });
    runtime.addBlock({ id:'B', type:'formula', source:'b:=a+1', taskId:'task-1' });

    runtime.getBlock('B').calculation.status = 'success';

    runtime.setBlockSource('A', 'a:=3');

    assert.equal(runtime.getBlock('A').calculation.status, 'idle');
    assert.equal(runtime.getBlock('B').calculation.status, 'dirty');
});

test('changing source marks transitive downstream blocks dirty', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({ id:'A', type:'formula', source:'a:=2', taskId:'task-1' });
    runtime.addBlock({ id:'B', type:'formula', source:'b:=a+1', taskId:'task-1' });
    runtime.addBlock({ id:'C', type:'formula', source:'c:=b*10', taskId:'task-1' });

    runtime.getBlock('B').calculation.status = 'success';
    runtime.getBlock('C').calculation.status = 'success';

    runtime.setBlockSource('A', 'a:=3');

    assert.equal(runtime.getBlock('B').calculation.status, 'dirty');
    assert.equal(runtime.getBlock('C').calculation.status, 'dirty');
});

test('changing dependencies dirties blocks from old dependency graph', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({ id:'A', type:'formula', source:'a:=2', taskId:'task-1' });
    runtime.addBlock({ id:'B', type:'formula', source:'b:=a+1', taskId:'task-1' });
    runtime.addBlock({ id:'C', type:'formula', source:'c:=b*10', taskId:'task-1' });

    runtime.getBlock('C').calculation.status = 'success';

    // B skriver ikke længere b, så B -> C forsvinder fra den nye graph.
    runtime.setBlockSource('B', 'd:=a+1');

    assert.equal(runtime.getBlock('C').calculation.status, 'dirty');
});

test('changing dependencies dirties blocks from new dependency graph', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({ id:'A', type:'formula', source:'a:=2', taskId:'task-1' });
    runtime.addBlock({ id:'B', type:'formula', source:'b:=3', taskId:'task-1' });
    runtime.addBlock({ id:'C', type:'formula', source:'c:=a+1', taskId:'task-1' });

    runtime.getBlock('C').calculation.status = 'success';

    // B bliver nu nearest preceding writer af a for C.
    runtime.setBlockSource('B', 'a:=3');

    assert.equal(runtime.getBlock('C').calculation.status, 'dirty');
});

test('source change only dirties blocks in the same task', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({ id:'A', type:'formula', source:'a:=2', taskId:'task-1' });
    runtime.addBlock({ id:'B', type:'formula', source:'b:=a+1', taskId:'task-1' });

    runtime.addBlock({ id:'X', type:'formula', source:'a:=100', taskId:'task-2' });
    runtime.addBlock({ id:'Y', type:'formula', source:'b:=a+1', taskId:'task-2' });

    runtime.getBlock('B').calculation.status = 'success';
    runtime.getBlock('Y').calculation.status = 'success';

    runtime.setBlockSource('A', 'a:=3');

    assert.equal(runtime.getBlock('B').calculation.status, 'dirty');
    assert.equal(runtime.getBlock('Y').calculation.status, 'success');
});

test('structural invalidation dirties block with changed binding', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-25');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=a+1',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'C',
        type: 'formula',
        source: 'a:=10',
        taskId: 'task-1'
    });

    runtime.getBlock('B').calculation.status = 'success';

    const oldAnalysis = runtime.dependencyAnalysis;

    // A, B, C  ->  A, C, B
    // B skifter provider for a fra A til C.
    runtime.blocks = [
        runtime.getBlock('A'),
        runtime.getBlock('C'),
        runtime.getBlock('B')
    ];

    runtime.rebuildDependencyAnalysis();

    const affected =
        runtime.invalidateStructuralChanges(oldAnalysis);

    assert.deepEqual(affected, new Set(['B']));
    assert.equal(
        runtime.getBlock('B').calculation.status,
        'dirty'
    );
});

test('structural invalidation dirties downstream blocks', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-26');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=a+1',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'C',
        type: 'formula',
        source: 'c:=b+1',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'D',
        type: 'formula',
        source: 'a:=10',
        taskId: 'task-1'
    });

    runtime.getBlock('B').calculation.status = 'success';
    runtime.getBlock('C').calculation.status = 'success';

    const oldAnalysis = runtime.dependencyAnalysis;

    // A, B, C, D  ->  A, D, B, C
    //
    // B: a -> A bliver a -> D.
    // C: b -> B er uændret.
    //
    // B skal derfor findes via bindings,
    // mens C skal findes via downstream.
    runtime.blocks = [
        runtime.getBlock('A'),
        runtime.getBlock('D'),
        runtime.getBlock('B'),
        runtime.getBlock('C')
    ];

    runtime.rebuildDependencyAnalysis();

    const affected =
        runtime.invalidateStructuralChanges(oldAnalysis);

    assert.deepEqual(
        affected,
        new Set(['B', 'C'])
    );

    assert.equal(
        runtime.getBlock('B').calculation.status,
        'dirty'
    );

    assert.equal(
        runtime.getBlock('C').calculation.status,
        'dirty'
    );
});

test('structural invalidation stays within task boundaries', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-27');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=a+1',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'C',
        type: 'formula',
        source: 'a:=10',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'X',
        type: 'formula',
        source: 'a:=100',
        taskId: 'task-2'
    });

    runtime.addBlock({
        id: 'Y',
        type: 'formula',
        source: 'b:=a+1',
        taskId: 'task-2'
    });

    runtime.getBlock('B').calculation.status = 'success';
    runtime.getBlock('Y').calculation.status = 'success';

    const oldAnalysis = runtime.dependencyAnalysis;

    // Kun task-1 ændrer semantik:
    // A, B, C -> A, C, B
    runtime.blocks = [
        runtime.getBlock('A'),
        runtime.getBlock('C'),
        runtime.getBlock('B'),
        runtime.getBlock('X'),
        runtime.getBlock('Y')
    ];

    runtime.rebuildDependencyAnalysis();

    const affected =
        runtime.invalidateStructuralChanges(oldAnalysis);

    assert.deepEqual(affected, new Set(['B']));

    assert.equal(
        runtime.getBlock('B').calculation.status,
        'dirty'
    );

    assert.equal(
        runtime.getBlock('Y').calculation.status,
        'success'
    );
});


test('formula block starts with generation zero', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2'
    });

    assert.equal(
        runtime.getBlock('A').calculation.generation,
        0
    );
});

test('changing formula source increments generation', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2'
    });

    runtime.setBlockSource('A', 'a:=3');

    assert.equal(
        runtime.getBlock('A').calculation.generation,
        1
    );
});

test('stale calculation result does not overwrite dirty state', async () => {
    let resolveCalculation;

    const engine = {
        calculate() {
            return new Promise(resolve => {
                resolveCalculation = resolve;
            });
        },

        async getTaskState() {
            return {
                type: 'scope',
                task_id: 'unused',
                variables: []
            };
        }
    };

    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2'
    });

    const calculation = runtime.calculateBlock('A');

    assert.equal(
        runtime.getBlock('A').calculation.status,
        'running'
    );

    runtime.markBlockDirty('A');

    assert.equal(
        runtime.getBlock('A').calculation.status,
        'dirty'
    );

    resolveCalculation({
        type: 'success'
    });

    const result = await calculation;

    assert.equal(result, null);

    assert.equal(
        runtime.getBlock('A').calculation.status,
        'dirty'
    );
});

test('stale calculation error does not overwrite dirty state', async () => {
    let rejectCalculation;

    const engine = {
        calculate() {
            return new Promise((resolve, reject) => {
                rejectCalculation = reject;
            });
        },

        async getTaskState() {
            return {
                type: 'scope',
                task_id: 'unused',
                variables: []
            };
        }
    };

    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2'
    });

    const calculation = runtime.calculateBlock('A');

    runtime.markBlockDirty('A');

    rejectCalculation(new Error('Gammel fejl'));

    const result = await calculation;

    assert.equal(result, null);

    const block = runtime.getBlock('A');

    assert.equal(block.calculation.status, 'dirty');
    assert.equal(block.calculation.generation, 1);
});

test('dirty block can be recalculated successfully', async () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2'
    });

    const block = runtime.getBlock('A');

    block.calculation.status = 'success';
    block.calculation.result = { type: 'scalar', value: '2' };

    runtime.markBlockDirty('A');

    assert.equal(block.calculation.status, 'dirty');
    assert.equal(block.calculation.generation, 1);

    const result = await runtime.calculateBlock('A');

    assert.equal(block.calculation.status, 'success');
    assert.equal(block.calculation.generation, 1);
    assert.strictEqual(block.calculation.result, result);
});

test('dirty block can be recalculated into error state', async () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2'
    });

    const block = runtime.getBlock('A');

    block.calculation.status = 'success';
    runtime.markBlockDirty('A');

    engine.calculateError = new Error('Ny beregningsfejl');

    await assert.rejects(
        () => runtime.calculateBlock('A'),
        /Ny beregningsfejl/
    );

    assert.equal(block.calculation.status, 'error');
    assert.equal(block.calculation.generation, 1);
    assert.equal(
        block.calculation.error.message,
        'Ny beregningsfejl'
    );
});

test('recalculateDirty recalculates dirty dependency chain', async () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=a+1',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'C',
        type: 'formula',
        source: 'c:=b*10',
        taskId: 'task-1'
    });

    runtime.getBlock('B').calculation.status = 'dirty';
    runtime.getBlock('C').calculation.status = 'dirty';

    await runtime.recalculateDirty('task-1');

    assert.equal(runtime.getBlock('B').calculation.status, 'success');
    assert.equal(runtime.getBlock('C').calculation.status, 'success');
});

test('recalculateDirty follows document order', async () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=a+1',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'D',
        type: 'formula',
        source: 'd:=a-4',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'C',
        type: 'formula',
        source: 'c:=b*10',
        taskId: 'task-1'
    });

    for (const id of ['B', 'D', 'C']) {
        runtime.getBlock(id).calculation.status = 'dirty';
    }

    const order = [];
    const originalCalculateBlock =
        runtime.calculateBlock.bind(runtime);

    runtime.calculateBlock = async blockId => {
        order.push(blockId);
        return originalCalculateBlock(blockId);
    };

    await runtime.recalculateDirty('task-1');

    assert.deepEqual(order, ['B', 'D', 'C']);
});

test('recalculateDirty only recalculates requested task', async () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'X',
        type: 'formula',
        source: 'x:=100',
        taskId: 'task-2'
    });

    runtime.getBlock('A').calculation.status = 'dirty';
    runtime.getBlock('X').calculation.status = 'dirty';

    await runtime.recalculateDirty('task-1');

    assert.equal(
        runtime.getBlock('A').calculation.status,
        'success'
    );

    assert.equal(
        runtime.getBlock('X').calculation.status,
        'dirty'
    );
});

test('recalculateDirty skips clean formula blocks', async () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=3',
        taskId: 'task-1'
    });

    runtime.getBlock('A').calculation.status = 'success';
    runtime.getBlock('B').calculation.status = 'dirty';

    await runtime.recalculateDirty('task-1');

    assert.equal(engine.calculateCalls.length, 1);
    assert.equal(runtime.getBlock('A').calculation.status, 'success');
    assert.equal(runtime.getBlock('B').calculation.status, 'success');
});

test('recalculateDirty skips downstream blocks after calculation error', async () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-18');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=a+1',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'C',
        type: 'formula',
        source: 'c:=b*10',
        taskId: 'task-1'
    });

    runtime.getBlock('B').calculation.status = 'dirty';
    runtime.getBlock('C').calculation.status = 'dirty';

    const originalCalculateBlock =
        runtime.calculateBlock.bind(runtime);

    runtime.calculateBlock = async blockId => {
        if (blockId === 'B') {
            const block = runtime.getBlock('B');

            block.calculation = {
                ...block.calculation,
                status: 'error',
                result: null,
                error: {
                    message: 'B failed'
                }
            };

            throw new Error('B failed');
        }

        return originalCalculateBlock(blockId);
    };

    await runtime.recalculateDirty('task-1');

    assert.equal(runtime.getBlock('B').calculation.status, 'error');
    assert.equal(runtime.getBlock('C').calculation.status, 'dirty');
});

test('recalculateDirty continues with independent branch after calculation error', async () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-19');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=a+1',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'C',
        type: 'formula',
        source: 'c:=b*10',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'D',
        type: 'formula',
        source: 'd:=a-4',
        taskId: 'task-1'
    });

    for (const id of ['B', 'C', 'D']) {
        runtime.getBlock(id).calculation.status = 'dirty';
    }

    const originalCalculateBlock =
        runtime.calculateBlock.bind(runtime);

    runtime.calculateBlock = async blockId => {
        if (blockId === 'B') {
            const block = runtime.getBlock('B');

            block.calculation = {
                ...block.calculation,
                status: 'error',
                result: null,
                error: {
                    message: 'B failed'
                }
            };

            throw new Error('B failed');
        }

        return originalCalculateBlock(blockId);
    };

    await runtime.recalculateDirty('task-1');

    assert.equal(runtime.getBlock('B').calculation.status, 'error');
    assert.equal(runtime.getBlock('C').calculation.status, 'dirty');
    assert.equal(runtime.getBlock('D').calculation.status, 'success');
});

test('recalculateDirty skips all transitive downstream blocks after calculation error', async () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-20');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=a+1',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'C',
        type: 'formula',
        source: 'c:=b*10',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'E',
        type: 'formula',
        source: 'e:=c+5',
        taskId: 'task-1'
    });

    for (const id of ['B', 'C', 'E']) {
        runtime.getBlock(id).calculation.status = 'dirty';
    }

    const originalCalculateBlock =
        runtime.calculateBlock.bind(runtime);

    runtime.calculateBlock = async blockId => {
        if (blockId === 'B') {
            const block = runtime.getBlock('B');

            block.calculation = {
                ...block.calculation,
                status: 'error',
                result: null,
                error: {
                    message: 'B failed'
                }
            };

            throw new Error('B failed');
        }

        return originalCalculateBlock(blockId);
        
    };

    await runtime.recalculateDirty('task-1');

    assert.equal(runtime.getBlock('B').calculation.status, 'error');
    assert.equal(runtime.getBlock('C').calculation.status, 'dirty');
    assert.equal(runtime.getBlock('E').calculation.status, 'dirty');
});

test('recalculateFrom calculates source block before dirty downstream blocks', async () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-21');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=a+1',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'C',
        type: 'formula',
        source: 'c:=b*10',
        taskId: 'task-1'
    });

    runtime.getBlock('B').calculation.status = 'idle';
    runtime.getBlock('C').calculation.status = 'dirty';

    const order = [];
    const originalCalculateBlock =
        runtime.calculateBlock.bind(runtime);

    runtime.calculateBlock = async blockId => {
        order.push(blockId);
        return originalCalculateBlock(blockId);
    };

    await runtime.recalculateFrom('B');

    assert.deepEqual(order, ['B', 'C']);
    assert.equal(runtime.getBlock('B').calculation.status, 'success');
    assert.equal(runtime.getBlock('C').calculation.status, 'success');
});

test('recalculateFrom recalculates other dirty branches in the same task', async () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-22');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=a+1',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'C',
        type: 'formula',
        source: 'c:=b*10',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'X',
        type: 'formula',
        source: 'x:=100',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'Y',
        type: 'formula',
        source: 'y:=x+1',
        taskId: 'task-1'
    });

    runtime.getBlock('C').calculation.status = 'dirty';
    runtime.getBlock('Y').calculation.status = 'dirty';

    await runtime.recalculateFrom('B');

    assert.equal(runtime.getBlock('B').calculation.status, 'success');
    assert.equal(runtime.getBlock('C').calculation.status, 'success');
    assert.equal(runtime.getBlock('Y').calculation.status, 'success');
});

test('recalculateFrom skips failed downstream but continues independent dirty branches', async () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-23');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=a+1',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'C',
        type: 'formula',
        source: 'c:=b*10',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'D',
        type: 'formula',
        source: 'd:=a-4',
        taskId: 'task-1'
    });

    runtime.getBlock('C').calculation.status = 'dirty';
    runtime.getBlock('D').calculation.status = 'dirty';

    const originalCalculateBlock =
        runtime.calculateBlock.bind(runtime);

    runtime.calculateBlock = async blockId => {
        if (blockId === 'B') {
            const block = runtime.getBlock('B');

            block.calculation = {
                ...block.calculation,
                status: 'error',
                result: null,
                error: {
                    message: 'B failed'
                }
            };

            throw new Error('B failed');
        }

        return originalCalculateBlock(blockId);
    };

    await assert.rejects(
        runtime.recalculateFrom('B'),
        /B failed/
    );

    assert.equal(runtime.getBlock('B').calculation.status, 'error');
    assert.equal(runtime.getBlock('C').calculation.status, 'dirty');
    assert.equal(runtime.getBlock('D').calculation.status, 'success');
});

test('recalculateFrom does not recalculate dirty blocks in another task', async () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-24');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=a+1',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'X',
        type: 'formula',
        source: 'x:=100',
        taskId: 'task-2'
    });

    runtime.addBlock({
        id: 'Y',
        type: 'formula',
        source: 'y:=x+1',
        taskId: 'task-2'
    });

    runtime.getBlock('Y').calculation.status = 'dirty';

    await runtime.recalculateFrom('B');

    assert.equal(runtime.getBlock('B').calculation.status, 'success');
    assert.equal(runtime.getBlock('Y').calculation.status, 'dirty');
});

test('moveBlock moves block to final document index', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-28');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=2'
    });

    runtime.addBlock({
        id: 'C',
        type: 'formula',
        source: 'c:=3'
    });

    runtime.moveBlock('B', 2);

    assert.deepEqual(
        runtime.getBlocks().map(block => block.id),
        ['A', 'C', 'B']
    );
});

test('moveBlock dirties block when effective provider changes', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-29');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=a+1',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'C',
        type: 'formula',
        source: 'a:=10',
        taskId: 'task-1'
    });

    runtime.getBlock('B').calculation.status = 'success';

    // A, B, C -> A, C, B
    // B's provider for a changes from A to C.
    const affected = runtime.moveBlock('C', 1);

    assert.deepEqual(
        runtime.getBlocks().map(block => block.id),
        ['A', 'C', 'B']
    );

    assert.deepEqual(
        affected,
        new Set(['B'])
    );

    assert.equal(
        runtime.getBlock('B').calculation.status,
        'dirty'
    );
});

test('moveBlock preserves calculation state when bindings do not change', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-30');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=2',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=a+1',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'X',
        type: 'formula',
        source: 'x:=100',
        taskId: 'task-1'
    });

    runtime.getBlock('B').calculation.status = 'success';

    // A, B, X -> A, X, B
    //
    // B still reads a from A.
    const affected = runtime.moveBlock('X', 1);

    assert.deepEqual(
        runtime.getBlocks().map(block => block.id),
        ['A', 'X', 'B']
    );

    assert.deepEqual(
        affected,
        new Set()
    );

    assert.equal(
        runtime.getBlock('B').calculation.status,
        'success'
    );
});

test('moveBlock rejects invalid moves without mutating document', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-31');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=2'
    });

    const originalOrder =
        runtime.getBlocks().map(block => block.id);

    assert.throws(
        () => runtime.moveBlock('missing', 0),
        /findes ikke/
    );

    assert.deepEqual(
        runtime.getBlocks().map(block => block.id),
        originalOrder
    );

    assert.throws(
        () => runtime.moveBlock('A', 99),
        /Ugyldigt block index/
    );

    assert.deepEqual(
        runtime.getBlocks().map(block => block.id),
        originalOrder
    );
});

test('removeBlock removes block from document', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-32');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=2'
    });

    runtime.addBlock({
        id: 'C',
        type: 'formula',
        source: 'c:=3'
    });

    const affected = runtime.removeBlock('B');

    assert.deepEqual(
        runtime.getBlocks().map(block => block.id),
        ['A', 'C']
    );

    assert.deepEqual(
        affected,
        new Set()
    );
});

test('removeBlock dirties block when provider falls back to earlier definition', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-33');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=1',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'a:=2',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'C',
        type: 'formula',
        source: 'c:=a',
        taskId: 'task-1'
    });

    runtime.getBlock('C').calculation.status = 'success';

    // Før:
    // C: a -> B
    //
    // Efter remove B:
    // C: a -> A
    const affected = runtime.removeBlock('B');

    assert.deepEqual(
        runtime.getBlocks().map(block => block.id),
        ['A', 'C']
    );

    assert.deepEqual(
        affected,
        new Set(['C'])
    );

    assert.equal(
        runtime.getBlock('C').calculation.status,
        'dirty'
    );
});

test('removeBlock dirties transitive downstream blocks', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-34');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=1',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'a:=2',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'C',
        type: 'formula',
        source: 'c:=a',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'D',
        type: 'formula',
        source: 'd:=c+1',
        taskId: 'task-1'
    });

    runtime.getBlock('C').calculation.status = 'success';
    runtime.getBlock('D').calculation.status = 'success';

    // C ændrer binding: a -> B bliver a -> A.
    // D beholder bindingen c -> C,
    // men skal invalides som downstream af C.
    const affected = runtime.removeBlock('B');

    assert.deepEqual(
        affected,
        new Set(['C', 'D'])
    );

    assert.equal(
        runtime.getBlock('C').calculation.status,
        'dirty'
    );

    assert.equal(
        runtime.getBlock('D').calculation.status,
        'dirty'
    );
});

test('removeBlock preserves calculation state when removed block is semantically irrelevant', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-35');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=1',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'X',
        type: 'formula',
        source: 'x:=100',
        taskId: 'task-1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=a+1',
        taskId: 'task-1'
    });

    runtime.getBlock('B').calculation.status = 'success';

    const affected = runtime.removeBlock('X');

    assert.deepEqual(
        runtime.getBlocks().map(block => block.id),
        ['A', 'B']
    );

    assert.deepEqual(
        affected,
        new Set()
    );

    assert.equal(
        runtime.getBlock('B').calculation.status,
        'success'
    );
});

test('removeBlock rejects unknown block without mutating document', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-36');

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=2'
    });

    const originalOrder =
        runtime.getBlocks().map(block => block.id);

    assert.throws(
        () => runtime.removeBlock('missing'),
        /findes ikke/
    );

    assert.deepEqual(
        runtime.getBlocks().map(block => block.id),
        originalOrder
    );
});

test('insertBlock inserts block at requested document index', () => {
    const runtime = new DocumentRuntime(
        makeFakeEngine(),
        'doc-1'
    );

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=1'
    });

    runtime.addBlock({
        id: 'C',
        type: 'formula',
        source: 'c:=a'
    });

    const affected = runtime.insertBlock(
        {
            id: 'B',
            type: 'formula',
            source: 'b:=2'
        },
        1
    );

    assert.deepEqual(
        runtime.getBlocks().map(block => block.id),
        ['A', 'B', 'C']
    );

    assert.equal(
        runtime.getBlock('B').calculation.status,
        'idle'
    );

    assert.deepEqual([...affected], []);
});

test('insertBlock dirties existing block when inserted writer becomes its provider', () => {
    const runtime = new DocumentRuntime(
        makeFakeEngine(),
        'doc-1'
    );

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=1'
    });

    runtime.addBlock({
        id: 'C',
        type: 'formula',
        source: 'c:=a'
    });

    runtime.getBlock('C').calculation.status = 'success';

    const affected = runtime.insertBlock(
        {
            id: 'B',
            type: 'formula',
            source: 'a:=10'
        },
        1
    );

    assert.equal(
        runtime.getBlock('B').calculation.status,
        'idle'
    );

    assert.equal(
        runtime.getBlock('C').calculation.status,
        'dirty'
    );

    assert.deepEqual(
        new Set(affected),
        new Set(['C'])
    );
});


test('insertBlock dirties transitive downstream blocks', () => {
    const runtime = new DocumentRuntime(
        makeFakeEngine(),
        'doc-1'
    );

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=1'
    });

    runtime.addBlock({
        id: 'C',
        type: 'formula',
        source: 'c:=a'
    });

    runtime.addBlock({
        id: 'D',
        type: 'formula',
        source: 'd:=c+1'
    });

    runtime.getBlock('C').calculation.status = 'success';
    runtime.getBlock('D').calculation.status = 'success';

    const affected = runtime.insertBlock(
        {
            id: 'B',
            type: 'formula',
            source: 'a:=10'
        },
        1
    );

    assert.equal(
        runtime.getBlock('C').calculation.status,
        'dirty'
    );

    assert.equal(
        runtime.getBlock('D').calculation.status,
        'dirty'
    );

    assert.deepEqual(
        new Set(affected),
        new Set(['C', 'D'])
    );
});


test('insertBlock preserves calculation state when insertion is semantically irrelevant', () => {
    const runtime = new DocumentRuntime(
        makeFakeEngine(),
        'doc-1'
    );

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=1'
    });

    runtime.addBlock({
        id: 'C',
        type: 'formula',
        source: 'c:=a'
    });

    runtime.getBlock('C').calculation.status = 'success';

    const affected = runtime.insertBlock(
        {
            id: 'X',
            type: 'formula',
            source: 'x:=100'
        },
        1
    );

    assert.equal(
        runtime.getBlock('X').calculation.status,
        'idle'
    );

    assert.equal(
        runtime.getBlock('C').calculation.status,
        'success'
    );

    assert.deepEqual([...affected], []);
});


test('insertBlock allows insertion at end of document', () => {
    const runtime = new DocumentRuntime(
        makeFakeEngine(),
        'doc-1'
    );

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=1'
    });

    runtime.addBlock({
        id: 'B',
        type: 'formula',
        source: 'b:=a'
    });

    const affected = runtime.insertBlock(
        {
            id: 'C',
            type: 'formula',
            source: 'c:=b'
        },
        runtime.getBlocks().length
    );

    assert.deepEqual(
        runtime.getBlocks().map(block => block.id),
        ['A', 'B', 'C']
    );

    assert.equal(
        runtime.getBlock('C').calculation.status,
        'idle'
    );

    assert.deepEqual([...affected], []);
});


test('insertBlock rejects invalid insertion without mutating document', () => {
    const runtime = new DocumentRuntime(
        makeFakeEngine(),
        'doc-1'
    );

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=1'
    });

    const before = runtime.getBlocks();

    assert.throws(
        () => runtime.insertBlock(
            {
                id: 'B',
                type: 'formula',
                source: 'b:=2'
            },
            2
        ),
        /Ugyldigt block index/
    );

    assert.deepEqual(runtime.getBlocks(), before);
    assert.equal(runtime.getBlock('B'), null);
});

test('insertBlock accepts incomplete formula source and preserves valid surrounding bindings', () => {
    const runtime = new DocumentRuntime(makeFakeEngine(), 'doc-1');
    runtime.addBlock({id: 'A', type: 'formula', source: 'a:=1'});
    runtime.addBlock({id: 'C', type: 'formula', source: 'c:=a'});
    assert.doesNotThrow(() => runtime.insertBlock({id: 'B', type: 'formula', source: 'a:='}, 1));
    assert.deepEqual(runtime.getBlocks().map(b => b.id), ['A', 'B', 'C']);
    assert.deepEqual(runtime.getBlock('B').dependencies, {reads: [], writes: []});
    assert.equal(runtime.getDependencyGraph('default').getUpstream('C')[0], 'A');
    assert.equal(runtime.deriveSemanticTask().analysis.bindings.get('C').get('a'), 'A');
    assert.equal(runtime.deriveSemanticTask().snapshot.blocks[1].parseError !== null, true);
});

test('insertBlock rejects duplicate id without mutating document', () => {
    const runtime = new DocumentRuntime(
        makeFakeEngine(),
        'doc-1'
    );

    runtime.addBlock({
        id: 'A',
        type: 'formula',
        source: 'a:=1'
    });

    runtime.addBlock({
        id: 'C',
        type: 'formula',
        source: 'c:=a'
    });

    const beforeBlocks = runtime.getBlocks();
    const beforeGraph = runtime.getDependencyGraph('default');

    assert.throws(
        () => runtime.insertBlock(
            {
                id: 'A',
                type: 'formula',
                source: 'a:=100'
            },
            1
        ),
        /Block-id findes allerede/
    );

    assert.deepEqual(
        runtime.getBlocks(),
        beforeBlocks
    );

    assert.equal(
        runtime.getDependencyGraph('default'),
        beforeGraph
    );
});
