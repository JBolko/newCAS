/**
 * transformer.js
 * Oversætter et newCAS AST til SymPy-kompatibel Python-kode.
 *
 * Modtager et settings-objekt ved instantiering så angle-mode og
 * andre indstillinger kan påvirke output uden global state.
 */

// Binære operatorer — ^ håndteres via PowerExpression-noden, ikke her
const OPS = { '+': '+', '-': '-', '*': '*', '/': '/' };

// Retiring source-to-Python engine only. No imports into P0021 Semantic IR.
import {compileLegacyQuantityUnit, compileLegacyConversionUnit} from './legacy/compile-legacy-unit.js';

export class Transformer {
    constructor(settings) {
        this.settings = settings;
    }

    /** Offentlig indgang — oversætter et Program-array eller en enkelt node */
    toPython(node) {
        return this.translate(node);
    }

    translate(node) {
        if (Array.isArray(node)) {
            return node.map(n => this.translate(n)).join('\n');
        }
        if (!node) return '';

        switch (node.type) {
            case 'Literal':
                return node.value.toString();

            case 'Variable':
                return node.name;

            case 'BinaryExpression':
                return `(${this.translate(node.left)} ${OPS[node.op]} ${this.translate(node.right)})`;

            case 'UnaryExpression':
                return `(-${this.translate(node.argument)})`;

            case 'PowerExpression':
                return `(${this.translate(node.base)} ** ${this.translate(node.exponent)})`;

            case 'FunctionCall':
                return this.translateFunctionCall(node);

            case 'Equation':
                return `Eq(${this.translate(node.left)}, ${this.translate(node.right)})`;

            case 'Assignment':
                return `${node.name} = ${this.translate(node.value)}`;

            case 'FunctionDefinition': {
                // Bruger Python 'def' i stedet for SymPy Lambda.
                // Lambda er symbolsk og bypasser wrappers i base_context (fx deg-aware sin).
                // 'def' slår navne op i globalt scope ved kaldstidspunkt — korrekt adfærd.
                const params = node.params.join(', ');
                const body   = this.translate(node.body);
                return `def ${node.name}(${params}):\n    return ${body}`;
            }

            case 'List':
                return `[${node.elements.map(e => this.translate(e)).join(', ')}]`;

            case 'Vector': {
                const components = node.components
                    .map(c => `[${this.translate(c)}]`)
                    .join(', ');
                return `Matrix([${components}])`;
            }

            case 'Quantity': {
                const unitExpression = compileLegacyQuantityUnit(node.unit);
                return `(${node.value} * ${unitExpression})`;
            }

            case 'Access':
                return `${node.container}[${this.translate(node.index)}]`;

            case 'Conversion': {
                const targetLiteral = compileLegacyConversionUnit(node.targetUnit);
                return `convert_to_unit(${this.translate(node.expr)}, ${targetLiteral})`;
            }

            case 'Derivative': {
                // DerivativeCall fra grammatikken: f'(x), f''(x), f'(2) osv.
                // To tilfælde:
                //   f'(x) — argument er variabel: diff(f(x), x, n)
                //   f'(2) — argument er tal/udtryk: diff(f(x), x, n).subs(x, 2)
                const argNode = node.args[0];
                const argStr  = this.translate(argNode);
                const isVar   = argNode?.type === 'Variable';
                const wrt     = isVar ? argStr : (argNode?.name ?? 'x');

                if (isVar) {
                    return `diff(${node.name}(${argStr}), ${wrt}, ${node.order})`;
                } else {
                    // Symbolsk differentier, substituer derefter
                    return `diff(${node.name}(_x_), _x_, ${node.order}).subs(_x_, ${argStr})`;
                }
            }

            default:
                console.warn('Ukendt AST-node:', node.type);
                return '';
        }
    }

    // ─── Private helper ─────────────────────────────────────────────────────

    translateFunctionCall(node) {
        // Vinkelkonvertering (deg↔rad) håndteres nu af Python-laget (context.py).
        // Transformer er angle-agnostisk og sender argumenter uændret.
        const args = node.args.map(arg => this.translate(arg));
        return `${node.name}(${args.join(', ')})`;
    }
}
