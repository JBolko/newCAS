export class CASEngine {
    constructor(transformer) {
        this.transformer = transformer;
        this.pyodide = null;
    }

    async init() {
        try {
            console.log("Initialiserer Pyodide...");

            // Vi beholder din load-logik præcis som den var
            this.pyodide = await loadPyodide({
                indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.1/full/" 
            });

            console.log("Pyodide indlæst – henter SymPy...");
            await this.pyodide.loadPackage("sympy");

            console.log("Henter setup.py...");
            const response = await fetch('src/python/setup.py'); 
            
            if (!response.ok) {
                throw new Error(`Kunne ikke finde setup.py på stien: ${response.url}`);
            }
            
            const pythonCode = await response.text();
            
            console.log("Eksekverer Python-setup...");
            await this.pyodide.runPythonAsync(pythonCode);

            console.log("✅ CASEngine er klar med SymPy!");

        } catch (err) {
            console.error("❌ Fejl under Pyodide/SymPy opsætning:", err);
            throw err;
        }
    }

    // Her er den opdaterede calculate-metode
    async calculate(ast, taskId = "default") {
        if (!this.pyodide) throw new Error("Pyodide er ikke klar endnu");

        // 1. Transformer din AST til Python-kode
        const pythonCode = this.transformer.toPython(ast);

        try {
            // 2. Vi kalder run_in_task i setup.py
            // JSON.stringify sørger for at pythonCode (f.eks. x+1) bliver sendt som en sikker streng
            const result = await this.pyodide.runPythonAsync(`
                run_in_task("${taskId}", ${JSON.stringify(pythonCode)})
            `);

            // 3. Vi parser det JSON-svar vi får fra Python (via wrap_result eller success-beskeden)
            return JSON.parse(result);
        } catch (err) {
            console.error("Fejl under beregning:", err);
            return { type: "error", message: err.message };
        }
    }
}