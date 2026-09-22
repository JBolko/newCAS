import test from 'node:test';
import assert from 'node:assert/strict';

import { DocumentRuntime } from '../../src/js/document-runtime.js';


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
            calculation: {
                status: 'idle',
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
        taskId: 'algebra'
    });

    const ast = {
        type: 'Literal',
        value: 5
    };

    await runtime.calculateBlock('formula-1', ast);

    assert.deepEqual(engine.calculateCalls, [
        {
            ast,
            taskId: 'document-17:algebra'
        }
    ]);
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
        () => runtime.calculateBlock(
            'text-1',
            { type: 'Literal', value: 5 }
        ),
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

    const ast = {
        type: 'Literal',
        value: 5
    };

    await runtime.calculateBlock('formula-1', ast);

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

    await runtime.calculateBlock(
        'formula-1',
        { type: 'Literal', value: 5 }
    );

    runtime.setBlockSource('formula-1', '6');

    const block = runtime.getBlock('formula-1');

    assert.equal(block.source, '6');

    assert.deepEqual(block.calculation, {
        status: 'idle',
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

    const calculation = runtime.calculateBlock(
        'formula-1',
        { type: 'Literal', value: 5 }
    );

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
        source: 'bad input',
        taskId: 'algebra'
    });

    engine.calculateError = new Error('Testfejl');

    await assert.rejects(
        () => runtime.calculateBlock(
            'formula-1',
            { type: 'Invalid' }
        ),
        /Testfejl/
    );

    const block = runtime.getBlock('formula-1');

    assert.deepEqual(block.calculation, {
        status: 'error',
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
        source: 'bad input'
    });

    engine.calculateError = new Error('Testfejl');

    await assert.rejects(
        () => runtime.calculateBlock(
            'formula-1',
            { type: 'Invalid' }
        )
    );

    runtime.setBlockSource('formula-1', '5');

    assert.deepEqual(
        runtime.getBlock('formula-1').calculation,
        {
            status: 'idle',
            result: null,
            error: null
        }
    );
});