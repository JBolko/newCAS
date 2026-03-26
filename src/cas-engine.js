export class CASEngine {
    constructor(transformer) {
        this.transformer = transformer;
        this.pyodide = null;
    }

    async init() {
    try {
        console.log("Initialiserer Pyodide...");

        // Brug en nyere og mere stabil Pyodide version + eksplicit indexURL
        this.pyodide = await loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/"
        });

        console.log("Pyodide indlæst – indlæser sympy... (dette kan tage 10-30 sekunder første gang)");

        // Load sympy direkte – det er den anbefalede måde for indbyggede pakker
        await this.pyodide.loadPackage("sympy");

        console.log("SymPy indlæst – opretter wrapper...");

        // Python setup – tilføjet 'factor' eksplicit
        const pythonSetup = `
import json
from sympy import *
from sympy import latex, N, simplify, factor, symbols

x, y, z, t = symbols('x y z t')

def wrap_result(res):
    try:
        if isinstance(res, (list, tuple)):
            return json.dumps({
                "type": "list",
                "latex": [latex(r) for r in res],
                "decimal": [str(N(r)) for r in res]
            })
        
        return json.dumps({
            "type": "scalar",
            "latex": latex(res),
            "decimal": str(N(res)),
            "is_symbolic": bool(getattr(res, 'free_symbols', False))
        })
    except Exception as e:
        return json.dumps({"type": "error", "message": str(e)})
`;

        await this.pyodide.runPythonAsync(pythonSetup);
        
        console.log("✅ CASEngine er klar med SymPy + factor!");

    } catch (err) {
        console.error("❌ Fejl under Pyodide/SymPy opsætning:", err);
        throw err;
    }
}

    async calculate(ast) {
    if (!this.pyodide) {
        throw new Error("Vent venligst – systemet er stadig ved at starte op.");
    }
    
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