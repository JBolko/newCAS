import test from 'node:test';
import assert from 'node:assert/strict';

import { CASEngine } from '../../src/js/cas-engine.js';


test('getTaskState returns parsed task state', async () => {
    const transformer = {};
    const engine = new CASEngine(transformer);

    let receivedCode = null;

    engine.pyodide = {
        async runPythonAsync(code) {
            receivedCode = code;

            return JSON.stringify({
                type: 'scope',
                task_id: 'task-1',
                variables: [
                    { name: 'a', expr: '5' }
                ]
            });
        }
    };

    const state = await engine.getTaskState('task-1');

    assert.equal(
        receivedCode,
        'get_task_state_json("task-1")'
    );

    assert.deepEqual(state, {
        type: 'scope',
        task_id: 'task-1',
        variables: [
            { name: 'a', expr: '5' }
        ]
    });
});


test('getTaskState uses default task', async () => {
    const engine = new CASEngine({});

    let receivedCode = null;

    engine.pyodide = {
        async runPythonAsync(code) {
            receivedCode = code;

            return JSON.stringify({
                type: 'scope',
                task_id: 'default',
                variables: []
            });
        }
    };

    const state = await engine.getTaskState();

    assert.equal(
        receivedCode,
        'get_task_state_json("default")'
    );

    assert.equal(state.task_id, 'default');
});


test('getTaskState rejects use before initialization', async () => {
    const engine = new CASEngine({});

    await assert.rejects(
        () => engine.getTaskState('task-1'),
        /ikke initialiseret/
    );
});