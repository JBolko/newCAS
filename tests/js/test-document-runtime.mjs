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

test('invalid source does not mutate existing formula state', () => {
    const engine = makeFakeEngine();
    const runtime = new DocumentRuntime(engine, 'document-17');

    runtime.addBlock({
        id: 'formula-1',
        type: 'formula',
        source: 'b:=2*a'
    });

    assert.throws(
        () => runtime.setBlockSource(
            'formula-1',
            'b:=('
        )
    );

    const block = runtime.getBlock('formula-1');

    assert.equal(block.source, 'b:=2*a');

    assert.deepEqual(
        block.dependencies,
        {
            reads: ['a'],
            writes: ['b']
        }
    );
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


test('markBlockDirty preserves previous result', () => {
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

    assert.equal(block.calculation.result, result);
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
    assert.equal(block.calculation.result, result);
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