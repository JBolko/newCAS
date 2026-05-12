/**
 * transformer.js
 * Oversætter et newCAS AST til SymPy-kompatibel Python-kode.
 *
 * Modtager et settings-objekt ved instantiering så angle-mode og
 * andre indstillinger kan påvirke output uden global state.
 */

// Binære operatorer — ^ håndteres via PowerExpression-noden, ikke her
const OPS = { '+': '+', '-': '-', '*': '*', '/': '/' };

// Mapping fra brugervenlige enhedsnavne til Python-interne navne i base_context.
// Formål: undgå konflikter med Python-funktioner og SymPy-navne.
// Brugeren skriver [min], [N], [g] — Python-koden bruger minute, newton, gram.
//
// Regler for hvad der skal aliases:
//   'min'  → 'minute'  konflikter med min() funktionen
//   'N'    → 'newton'  konflikter med SymPy's N() (numerisk evaluering)
//   'g'    → 'gram'    konflikter med g = 9,82 m/s² konstanten
//   'E'    → 'eV'      (ikke i brug endnu, men E konflikter med Eulers tal)
//
// Enheder der IKKE aliases — de har unikke navne uden konflikter:
//   m, km, cm, mm, dm, s, ms, h, kg, mg, J, kJ, MJ, W, kW, kWh,
//   Pa, hPa, bar, A, mA, V, kV, C, Ohm, K, degC, deltaC
const UNIT_ALIASES = {
    'min': 'minute',   // min({data}) vs 5[min]
    'N':   'newton',   // N(expr) vs 5[N]
    'g':   'gram',     // g = 9.82 m/s² vs 5[g]
};

/** Oversætter en enhedsstreng fra brugernotation til Python-internt navn.
 *  Håndterer sammensatte enheder som "kg*m/s**2" korrekt ved at splitte
 *  på operatorer og kun aliase hele token-ord. */
function resolveUnit(unitStr) {
    // Erstat hvert helt "ord" (enhedsnavn) med sit alias hvis det findes.
    // Regex matcher kun hele token: "min" i "km/min" oversættes, men "m" i "km" ikke.
    return unitStr.replace(/[A-Za-z_][A-Za-z0-9_]*/g, token =>
        UNIT_ALIASES[token] ?? token
    );
}

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
                // replace(^→**) + alias (min→minute, N→newton, g→gram)
                const unitClean = resolveUnit(node.unit.replace(/\^/g, '**').trim());
                return `(${node.value} * ${unitClean})`;
            }

            case 'Access':
                return `${node.container}[${this.translate(node.index)}]`;

            case 'Conversion': {
                // replace([]→'') + replace(^→**) + alias
                const targetClean = resolveUnit(
                    node.targetUnit
                        .replace(/[\[\]]/g, '')
                        .replace(/\^/g, '**')
                        .trim()
                );
                if (!targetClean) return this.translate(node.expr);
                return `convert_to_unit(${this.translate(node.expr)}, "${targetClean}")`;
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
