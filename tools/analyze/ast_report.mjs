import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from '../../src/js/parser.mjs';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '../..');

const CASES = [
    { name: 'literal',             input: '42',              expect: 'Literal' },
    { name: 'variable',            input: 'x',               expect: 'Variable' },
    { name: 'binary',              input: '2 + 3',           expect: 'BinaryExpression' },
    { name: 'unary',               input: '-x',              expect: 'UnaryExpression' },
    { name: 'power',               input: 'x^2',             expect: 'PowerExpression' },
    { name: 'function-call',       input: 'sin(x)',          expect: 'FunctionCall' },
    { name: 'equation',            input: 'x = 2',           expect: 'Equation' },
    { name: 'assignment',          input: 'a := 5',          expect: 'Assignment' },
    { name: 'function-definition', input: 'f(x) := x^2',     expect: 'FunctionDefinition' },
    { name: 'list',                input: '{1; 2; 3}',       expect: 'List' },
    { name: 'vector',              input: '[1; 2; 3]',       expect: 'Vector' },
    { name: 'quantity',            input: '5 [m]',           expect: 'Quantity' },
    { name: 'conversion',          input: '5 [m] -> [cm]',   expect: 'Conversion' },
    { name: 'access',              input: 'v[1]',            expect: 'Access' },
    { name: 'derivative',          input: "f'(x)",           expect: 'Derivative' },
];

const TRANSFORMER_PATH = path.join(ROOT, 'src', 'js', 'transformer.js');

function collectTransformerNodeTypes() {
    const source = fs.readFileSync(TRANSFORMER_PATH, 'utf8');
    const result = new Set();

    const pattern = /case\s+['"]([^'"]+)['"]\s*:/g;

    for (const match of source.matchAll(pattern)) {
        result.add(match[1]);
    }

    return result;
}

function collectNodeTypes(value, result = new Set()) {
    if (Array.isArray(value)) {
        for (const item of value) {
            collectNodeTypes(item, result);
        }
        return result;
    }

    if (value && typeof value === 'object') {
        if (typeof value.type === 'string') {
            result.add(value.type);
        }

        for (const child of Object.values(value)) {
            collectNodeTypes(child, result);
        }
    }

    return result;
}


const allNodeTypes = new Set();
const cases = [];


for (const testCase of CASES) {
    try {
        const ast = parse(testCase.input);
        const nodeTypes = [...collectNodeTypes(ast)].sort();

        const expectedFound = nodeTypes.includes(testCase.expect);

        if (!expectedFound) {
            throw new Error(
                `Expected AST node '${testCase.expect}', ` +
                `found: ${nodeTypes.join(', ')}`
            );
        }

        for (const type of nodeTypes) {
            allNodeTypes.add(type);
        }

        cases.push({
            name: testCase.name,
            input: testCase.input,
            expect: testCase.expect,
            ok: true,
            node_types: nodeTypes
        });
    } catch (error) {
        cases.push({
            name: testCase.name,
            input: testCase.input,
            expect: testCase.expect,
            ok: false,
            error: error.message
        });
    }
}

const transformerNodeTypes = collectTransformerNodeTypes();

const parserNodeTypes = new Set(allNodeTypes);

const parserNotSupportedByTransformer =
    [...parserNodeTypes]
        .filter(type => !transformerNodeTypes.has(type))
        .sort();

const transformerNotCoveredByParserCases =
    [...transformerNodeTypes]
        .filter(type => !parserNodeTypes.has(type))
        .sort();

const report = {
    version: 3,
    parser: 'src/js/parser.mjs',
    transformer: 'src/js/transformer.js',
    cases,
    node_types: [...allNodeTypes].sort(),
    transformer_node_types: [...transformerNodeTypes].sort(),
    consistency: {
        parser_not_supported_by_transformer:
            parserNotSupportedByTransformer,
        transformer_not_covered_by_parser_cases:
            transformerNotCoveredByParserCases
    }
};


const reportsDir = path.join(ROOT, 'tools', 'reports');

fs.mkdirSync(reportsDir, { recursive: true });

const out = path.join(reportsDir, 'ast.json');

fs.writeFileSync(
    out,
    JSON.stringify(report, null, 2),
    'utf8'
);


console.log('newCAS AST Report\n');

console.log(`Cases:      ${cases.length}`);
console.log(`Successful: ${cases.filter(c => c.ok).length}`);
console.log(`Failed:     ${cases.filter(c => !c.ok).length}`);
console.log(`Node types: ${allNodeTypes.size}\n`);

for (const item of cases) {
    console.log(
        `${item.ok ? '[OK]' : '[FAIL]'} ${item.name}: ${item.input}`
    );

    if (!item.ok) {
        console.log(`       ${item.error}`);
    }
}

console.log('\nAST node types');
console.log('--------------');

for (const type of [...allNodeTypes].sort()) {
    console.log(type);
}

console.log('\nConsistency');
console.log('-----------');

if (parserNotSupportedByTransformer.length === 0) {
    console.log('[OK] All parser node types are supported by Transformer');
} else {
    console.log(
        '[FAIL] Parser node types missing from Transformer: ' +
        parserNotSupportedByTransformer.join(', ')
    );
}

if (transformerNotCoveredByParserCases.length === 0) {
    console.log('[OK] All Transformer node types are covered by parser cases');
} else {
    console.log(
        '[FAIL] Transformer node types not covered by parser cases: ' +
        transformerNotCoveredByParserCases.join(', ')
    );
}

console.log('\nReport written: tools/reports/ast.json');


// Parserfejl eller parser/transformer-drift skal fejle i build-driveren.
const hasErrors =
    cases.some(c => !c.ok) ||
    parserNotSupportedByTransformer.length > 0 ||
    transformerNotCoveredByParserCases.length > 0;

if (hasErrors) {
    process.exitCode = 1;
}