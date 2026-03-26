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
from sympy import latex, N, simplify

def wrap_result(res):
    try:
        # Standard-output struktur for en skalar
        output = {
            "type": "scalar",
            "latex": latex(res),
            "ascii": str(res),
            "decimal": None,
            "is_symbolic": True
        }

        # Tilføj decimaltal hvis muligt
        if hasattr(res, 'is_number') and res.is_number:
            output["decimal"] = str(N(res, 10))
            output["is_symbolic"] = False
        
        # Håndter lister/mængder (f.eks. fra solve)
        if hasattr(res, '__iter__') or "Set" in str(type(res)):
            output["type"] = "list"
            output["elements"] = [latex(item) for item in res]
            
        return json.dumps(output)
    except Exception as e:
        return json.dumps({"type": "error", "message": str(e)})
        `;

        // Kør setup-koden i Python én gang
        await this.pyodide.runPythonAsync(pythonSetup);
        console.log("CASEngine er klar med wrap_result!");
    }

    async calculate(ast) {
        if (!this.pyodide) throw new Error("Pyodide ikke initialiseret");

        // 1. Lav AST om til Python-streng via din transformer
        const pythonCode = this.transformer.toPython(ast);

        // 2. Kør koden og pak resultatet ind via wrap_result
        const wrappedCommand = `wrap_result(simplify(${pythonCode}))`;

        try {
            const jsonResult = await this.pyodide.runPythonAsync(wrappedCommand);
            return JSON.parse(jsonResult);
        } catch (error) {
            console.error("Fejl i beregning:", error);
            return { type: "error", message: error.message };
        }
    }
}