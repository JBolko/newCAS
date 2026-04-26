/**
 * cas-engine.js
 * Initialiserer Pyodide og loader Python-pakken ind i det virtuelle filsystem.
 *
 * Python-koden er organiseret som en rigtig pakke med undermoduler.
 * Vi fetcher alle .py-filer og skriver dem til /cas/ i Pyodide-FS,
 * tilføjer /cas til sys.path og kører bootstrap.py.
 */

const PYODIDE_BASE = 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/';
const PYTHON_BASE  = 'src/python/';
const CAS_ROOT     = '/cas';

// Alle Python-filer relativt til src/python/
const PYTHON_FILES = [
    '__init__.py',
    'bootstrap.py',
    'cas_math/__init__.py',
    'cas_math/calculus.py',
    'cas_math/statistics.py',
    'cas_math/distributions.py',
    'core/__init__.py',
    'core/context.py',
    'core/executor.py',
    'core/scope.py',
    'output/__init__.py',
    'output/errors.py',
    'output/result.py',
    'units/__init__.py',
    'units/convert.py',
    'units/definitions.py',
];

export class CASEngine {
    constructor(transformer) {
        this.transformer = transformer;
        this.pyodide     = null;
    }

    async init() {
        try {
            console.log('Initialiserer Pyodide...');
            this.pyodide = await loadPyodide({ indexURL: PYODIDE_BASE });
            console.log('Henter SymPy...');
            await this.pyodide.loadPackage('sympy');

            console.log('Loader Python-pakke...');
            await this._loadPythonPackage();

            console.log('✅ CASEngine klar.');
        } catch (err) {
            console.error('❌ Engine-initialisering fejlede:', err);
            throw err;
        }
    }

    async _loadPythonPackage() {
        const FS = this.pyodide.FS;

        // Opret /cas og alle undermapper
        this._ensureDir(FS, CAS_ROOT);
        const subdirs = new Set(
            PYTHON_FILES
                .filter(f => f.includes('/'))
                .map(f => `${CAS_ROOT}/${f.split('/')[0]}`)
        );
        for (const dir of subdirs) this._ensureDir(FS, dir);

        // Fetch alle .py-filer parallelt og skriv til FS
        await Promise.all(PYTHON_FILES.map(async relPath => {
            const resp = await fetch(`${PYTHON_BASE}${relPath}`);
            if (!resp.ok) throw new Error(`Kunne ikke hente ${relPath} (${resp.status})`);
            FS.writeFile(`${CAS_ROOT}/${relPath}`, await resp.text());
        }));

        // Sæt sys.path og kør bootstrap
        await this.pyodide.runPythonAsync(`
import sys
if '${CAS_ROOT}' not in sys.path:
    sys.path.insert(0, '${CAS_ROOT}')
from bootstrap import run_in_task
import __main__
__main__.run_in_task = run_in_task
`);
    }

    _ensureDir(FS, path) {
        try { FS.mkdir(path); } catch (_) { /* Findes allerede */ }
    }

    async calculate(ast, taskId = 'default') {
        if (!this.pyodide) throw new Error('Pyodide er ikke klar endnu');

        const pythonCode = this.transformer.toPython(ast);
        try {
            const raw = await this.pyodide.runPythonAsync(
                `run_in_task(${JSON.stringify(taskId)}, ${JSON.stringify(pythonCode)})`
            );
            return JSON.parse(raw);
        } catch (err) {
            console.error('Fejl under beregning:', err);
            return { type: 'error', code: 'UNKNOWN', message: err.message };
        }
    }

    /**
     * Opdaterer angle mode og genopbygger base_context.
     * Kald denne når settings ændres i UI.
     */
    async setAngleMode(mode) {
        if (!this.pyodide) return;
        await this.pyodide.runPythonAsync(`
import __main__
__main__.ANGLE_MODE = '${mode}'
from core.context import build_base_context
from core import executor
new_ctx, new_forbidden = build_base_context()
executor.BASE_CONTEXT.clear()
executor.BASE_CONTEXT.update(new_ctx)
executor.FORBIDDEN_SYMBOLS = new_forbidden
`);
    }
}
