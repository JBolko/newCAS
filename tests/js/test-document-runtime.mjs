import test from 'node:test';
import assert from 'node:assert/strict';

import { DocumentRuntime } from '../../src/js/document-runtime.js';


function makeFakeEngine() {
    return {
        calculateCalls: [],
        stateCalls: [],

        async calculate(ast, taskId) {
            this.calculateCalls.push({ ast, taskId });

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