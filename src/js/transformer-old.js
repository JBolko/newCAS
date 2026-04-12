/**
 * transformer.js - Konverterer AST til SymPy-kompatibel Python-kode.
 * Opdateret til rev. 0704279
 */
export class Transformer {
    constructor(settings) {
        this.settings = settings;
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
                let args = node.args.map(arg => this.translate(arg));
                
                // --- HER ER FIXET ---
                const isDeg = this.settings?.user?.angleMode === 'deg';
                const trigFuncs = ['sin', 'cos', 'tan', 'sec', 'csc', 'cot'];
                const arcFuncs = ['asin', 'acos', 'atan', 'acot', 'asec', 'acsc'];

                // console.log('Settings:', this.settings)  // Fjern i produktion

                if (isDeg && trigFuncs.includes(node.name)) {
                    // Vi pakker argumentet ind i omregningen til radianer
                    args[0] = `((${args[0]}) * pi / 180)`;
                }

                if (isDeg && arcFuncs.includes(node.name)) {
                    // Vi returnerer direkte her, da vi skal gange HELE resultatet med 180/pi
                    return `((${node.name}(${args.join(', ')})) * 180 / pi)`;
                }
                // ---------------------

                return `${node.name}(${args.join(', ')})`;
            
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
                
                return `convert_to_unit(${this.translate(node.expr)}, "${targetClean}")`;

            default:
                console.warn("Ukendt AST-node:", node.type);
                return "";
        }
    }
}