/**
 * transformer.js - Konverterer AST til SymPy-kompatibel Python-kode.
 */
export class Transformer {
    constructor() {
        // Her kan vi senere tilføje settings
    }

    toPython(node) {
        return this.translate(node);
    }

    translate(node) {
        if (Array.isArray(node)) {
            return node.map(n => this.translate(n)).join('\n');
        }

        if (!node) return "";

        const ops = { 
            '+': '+', 
            '-': '-', 
            '*': '*', 
            '/': '/', 
            '^': '**' 
        };

        switch (node.type) {
            case 'Literal': 
                return node.value.toString();

            case 'Variable': 
                return node.name;

            case 'BinaryExpression':
                return `(${this.translate(node.left)} ${ops[node.op]} ${this.translate(node.right)})`;

            case 'PowerExpression':
                return `(${this.translate(node.base)} ** ${this.translate(node.exponent)})`;

            case 'UnaryExpression':
                return `(-${this.translate(node.argument)})`;

            case 'Assignment': 
                return `${node.name} = ${this.translate(node.value)}`;

            case 'FunctionDefinition': 
                const params = node.params.join(', ');
                return `${node.name} = Lambda((${params}), ${this.translate(node.body)})`;

            case 'FunctionCall':
                const args = node.args.map(a => this.translate(a)).join(', ');
                return `${node.name}(${args})`;

            case 'Equation':
                return `Eq(${this.translate(node.left)}, ${this.translate(node.right)})`;

            case 'List':
                return `[${node.elements.map(e => this.translate(e)).join(', ')}]`;

            default:
                console.warn("Ukendt AST-node:", node.type);
                return "";
        }
    }
}