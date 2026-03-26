export class CASEngine {
    constructor(transformer) {
        this.transformer = transformer;
        this.pyodide = null;
    }

    async init() {
        console.log("Initialiserer Pyodide...");
        // Hent Pyodide fra den globale context (index.html skal have scriptet)
        this.pyodide = await loadPyodide();
        
        // Indlæs SymPy
        await this.pyodide.loadPackage("sympy");

        // Her definerer vi vores "Wrapper" i Python. 
        // Læg mærke til backticks ` ` - det gør det til en streng i JS.
        const pythonSetup = `
import json
from sympy import *
# Vi importerer specifikt de her for at være sikre på, de er tilgængelige
from sympy import latex, N, simplify, symbols

# Her definerer vi standard symboler, så de altid virker
x, y, z, t = symbols('x y z t')

def wrap_result(res):
    try:
        # Hvis resultatet er en liste (f.eks. ved solve)
        if isinstance(res, (list, tuple)):
            return json.dumps({
                "type": "list",
                "latex": [latex(r) for r in res],
                "decimal": [str(N(r)) for r in res]
            })
        
        # Standard skalært resultat (som sqrt(8))
        return json.dumps({
            "type": "scalar",
            "latex": latex(res),
            "decimal": str(N(res)),
            "is_symbolic": bool(res.free_symbols)
        })
    except Exception as e:
        return json.dumps({"type": "error", "message": str(e)})
`;

        // Kør setup-koden i Python én gang
        await this.pyodide.runPythonAsync(pythonSetup);
        console.log("CASEngine er klar med wrap_result!");
    }

    async calculate(ast) {
    if (!this.pyodide) throw new Error("Pyodide er ikke klar endnu");

    // 1. Transformer din AST til Python-kode (f.eks. "sqrt(8)")
    const pythonCode = this.transformer.toPython(ast);

    // 2. Kør koden i Python og brug wrap_result til at få JSON tilbage
    // Vi bruger simplify() så SymPy altid prøver at gøre udtrykket pænt
    const result = await this.pyodide.runPythonAsync(`wrap_result(simplify(${pythonCode}))`);

    // 3. Lav JSON-strengen fra Python om til et JS-objekt
    return JSON.parse(result);
}
}