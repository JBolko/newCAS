/**
 * transformer.js - Konverterer AST til SymPy-kompatibel Python-kode.
 * Opdateret til rev. 0704279
 */
export class Transformer {
    constructor() {
        // Her kan vi senere tilføje settings (f.eks. Angle Mode)
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
                // Nogle variable skal måske beskyttes eller transformeres senere
                return node.name;
            
            case 'BinaryExpression':
                return `(${this.translate(node.left)} ${ops[node.op]} ${this.translate(node.right)})`;
            
            case 'UnaryExpression':
                return `(-${this.translate(node.argument)})`;
            
            case 'PowerExpression':
                return `(${this.translate(node.base)} ** ${this.translate(node.exponent)})`;
            
            case 'FunctionCall':
                const args = node.args.map(a => this.translate(a)).join(', ');
                return `${node.name}(${args})`;
            
            case 'Equation':
                // Vi bruger SymPys Eq(venstre, højre) til ligninger
                return `Eq(${this.translate(node.left)}, ${this.translate(node.right)})`;
            
            case 'Assignment': 
                return `${node.name} = ${this.translate(node.value)}`;

            case 'FunctionDefinition': 
                const params = node.params.join(', ');
                return `${node.name} = Lambda((${params}), ${this.translate(node.body)})`;

            // --- NYE NODER FRA REVIDERET GRAMMATIK ---

            case 'List':
                return `[${node.elements.map(e => this.translate(e)).join(', ')}]`;

            case 'Vector':
                // En vektor i newCAS bliver til en SymPy Matrix (kolonnevektor som standard)
                const components = node.components.map(c => `[${this.translate(c)}]`).join(', ');
                return `Matrix([${components}])`;

            case 'Quantity':
                // Enheder håndteres lettest ved at gange tallet med en enheds-variabel
                // Vi antager at SymPy har enheder defineret (f.eks. fra sympy.physics.units)
                let unitClean = node.unit.replace(/\^/g, '**').trim();
                return `(${node.value} * ${unitClean})`;

            case 'Access':
                // Liste/Vektor opslag: data[0]. SymPy (Python) bruger 0-baseret indeksering.
                return `${node.container}[${this.translate(node.index)}]`;

            case 'Conversion':
                let targetClean = node.targetUnit
                    .replace(/[\[\]]/g, '')     // fjern [ og ]
                    .replace(/\^/g, '**')       // ^ → **
                    .trim();
                
                // Hvis targetClean er tom eller ugyldig, falder vi tilbage
                if (!targetClean) {
                    return this.translate(node.expr);   // ingen konvertering
                }
                
                return `convert_to_unit(${this.translate(node.expr)}, "${targetClean}")`;turn `convert_to_unit(${this.translate(node.expr)}, "${targetClean}")`;

            default:
                console.warn("Ukendt AST-node:", node.type);
                return "";
        }
    }
}