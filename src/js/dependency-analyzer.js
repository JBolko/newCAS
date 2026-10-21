/**
 * dependency-analyzer.js
 *
 * Udleder symbolafhængigheder fra newCAS AST.
 *
 * Analyzerens ansvar er kun at identificere:
 *   - reads: symboler som læses
 *   - writes: symboler som defineres
 *
 * Den bygger ikke dependency graph og udfører ingen beregninger.
 */

export function analyzeDependencies(ast) {
    const state = {
        reads: new Set(),
        writes: new Set()
    };

    visit(ast, state);

    return {
        reads: [...state.reads].sort(),
        writes: [...state.writes].sort()
    };
}


function visit(node, state) {
    if (node == null) {
        return;
    }

    // Program returneres af parseren som et array af statements.
    if (Array.isArray(node)) {
        for (const item of node) {
            visit(item, state);
        }
        return;
    }

    if (typeof node !== 'object') {
        return;
    }

    switch (node.type) {
        case 'Literal':
            return;

        case 'Variable':
            state.reads.add(node.name);
            return;

        case 'Assignment':
            state.writes.add(node.name);
            visit(node.value, state);
            return;

        case 'FunctionDefinition':
            visitFunctionDefinition(node, state);
            return;

        case 'BinaryExpression':
            visit(node.left, state);
            visit(node.right, state);
            return;

        case 'UnaryExpression':
            visit(node.argument, state);
            return;

        case 'PowerExpression':
            visit(node.base, state);
            visit(node.exponent, state);
            return;

        case 'FunctionCall':
            for (const arg of node.args ?? []) {
                visit(arg, state);
            }
            return;

        case 'Derivative':
            state.reads.add(node.name);

            for (const arg of node.args ?? []) {
                visit(arg, state);
            }
            return;

        case 'Equation':
            visit(node.left, state);
            visit(node.right, state);
            return;

        case 'List':
            for (const element of node.elements ?? []) {
                visit(element, state);
            }
            return;

        case 'Vector':
            for (const component of node.components ?? []) {
                visit(component, state);
            }
            return;

        case 'Quantity':
            // Enheden er metadata/string, ikke et symbol.
            return;

        case 'Conversion':
            // A conversion wrapping a statement is parseable source data,
            // not a definition. Keep the legacy graph projection consistent
            // with source writer establishment; no nested writes or reads.
            if (node.expr?.type === 'Assignment' || node.expr?.type === 'FunctionDefinition') {
                return;
            }
            visit(node.expr, state);
            return;

        case 'Access':
            state.reads.add(node.container);
            visit(node.index, state);
            return;

        default:
            throw new Error(
                `Dependency-analyse understøtter ikke AST-type: ${node.type}`
            );
    }
}


function visitFunctionDefinition(node, state) {
    state.writes.add(node.name);

    /*
     * Funktionsparametre er lokale bindings.
     *
     * f(x) := a*x
     *
     * læser derfor a, men ikke x.
     */
    const localParameters = new Set(node.params ?? []);
    const localState = {
        reads: new Set(),
        writes: state.writes
    };

    visit(node.body, localState);

    for (const name of localState.reads) {
        if (!localParameters.has(name)) {
            state.reads.add(name);
        }
    }
}
