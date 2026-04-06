export class CASEngine {
    constructor(transformer) {
        this.transformer = transformer;
        this.pyodide = null;
    }

    async init() {
    try {
        console.log("Initialiserer Pyodide...");

        // Sørg for at denne version matcher din <script> i index.html!
        this.pyodide = await loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.1/full/" 
        });

        console.log("Pyodide indlæst – henter SymPy...");
        await this.pyodide.loadPackage("sympy");

        console.log("Henter setup.py...");
        // RETTET: fjernet det ekstra 's' i stien
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

    async calculate(ast) {
    if (!this.pyodide) throw new Error("Pyodide er ikke klar endnu");

    // 1. Transformer din AST til Python-kode
    const pythonCode = this.transformer.toPython(ast);

    // 2. KØR KODEN DIREKTE (vi har allerede simplify inde i wrap_result)
    // Vi fjerner simplify() herfra, så den ikke crasher på lister
    const result = await this.pyodide.runPythonAsync(`wrap_result(${pythonCode})`);

    // 3. Lav JSON-strengen om til et JS-objekt
    return JSON.parse(result);
}
}