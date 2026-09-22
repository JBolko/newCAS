import test from 'node:test';
import assert from 'node:assert/strict';

import { parse } from '../../src/js/parser.mjs';
import { analyzeDependencies } from '../../src/js/dependency-analyzer.js';


function dependencies(source) {
    return analyzeDependencies(parse(source));
}


test('constant assignment writes variable without reads', () => {
    assert.deepEqual(
        dependencies('a:=2'),
        {
            reads: [],
            writes: ['a']
        }
    );
});


test('assignment reads rhs variables and writes lhs', () => {
    assert.deepEqual(
        dependencies('b:=2*a'),
        {
            reads: ['a'],
            writes: ['b']
        }
    );
});


test('duplicate reads are returned once', () => {
    assert.deepEqual(
        dependencies('c:=a+b+a'),
        {
            reads: ['a', 'b'],
            writes: ['c']
        }
    );
});


test('expression reads variables without writes', () => {
    assert.deepEqual(
        dependencies('a+b'),
        {
            reads: ['a', 'b'],
            writes: []
        }
    );
});


test('function definition excludes local parameters from reads', () => {
    assert.deepEqual(
        dependencies('f(x):=a*x'),
        {
            reads: ['a'],
            writes: ['f']
        }
    );
});


test('function call reads variables in arguments', () => {
    assert.deepEqual(
        dependencies('sin(a+b)'),
        {
            reads: ['a', 'b'],
            writes: []
        }
    );
});


test('equation reads both sides', () => {
    assert.deepEqual(
        dependencies('a=b+c'),
        {
            reads: ['a', 'b', 'c'],
            writes: []
        }
    );
});


test('vector reads its components', () => {
    assert.deepEqual(
        dependencies('[a;b;2]'),
        {
            reads: ['a', 'b'],
            writes: []
        }
    );
});


test('conversion reads expression but not target unit', () => {
    assert.deepEqual(
        dependencies('a -> [m]'),
        {
            reads: ['a'],
            writes: []
        }
    );
});


test('access reads container and index expression', () => {
    assert.deepEqual(
        dependencies('v[i]'),
        {
            reads: ['i', 'v'],
            writes: []
        }
    );
});