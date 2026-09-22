/**
 * cas-engine.js
 * Initialiserer Pyodide og eksponerer calculate() til resten af appen.
 *
 * Python-filregistret er udtrukket til python-files.js — ret filnavne der.
 *
 * Fejlhåndtering:
 *   Python-exceptions fanges og returneres som { type:'error' } af run_in_task.
 *   JS-niveau-fejl (Pyodide-crash, hukommelse, tilstandskorruption) re-kastes
 *   så main.js kan vise en "motoren er nede"-besked i stedet for en celle-fejl.
 */

import { PYTHON_FILES } from './python-files.js';

const PYODIDE_BASE = 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/';
const PYTHON_BASE  = 'src/python/';
const CAS_ROOT     = '/cas';

export class CASEngine {
    /**
     * @param {object}   transformer  - Transformer-instans
     * @param {Function} [onProgress] - Valgfri: onProgress(step, total, label)
     *   Kaldes for hvert trin under init() så UI kan vise fremskridt.
     */
    constructor(transformer, onProgress = null) {
        this.transformer = transformer;
        this.pyodide     = null;
        this.onProgress  = onProgress ?? (() => {});
        this._ready      = false;
    }

    // ── Initialisering ────────────────────────────────────────────────────────

    async init() {
        try {
            this.onProgress(1, 3, 'Indlæser Pyodide (WebAssembly)…');
            this.pyodide = await loadPyodide({ indexURL: PYODIDE_BASE });

            this.onProgress(2, 3, 'Henter SymPy…');
            await this.pyodide.loadPackage('sympy');

            this.onProgress(3, 3, 'Loader Python-pakke…');
            await this._loadPythonPackage();

            this._ready = true;
            console.log('✅ CASEngine klar.');
        } catch (err) {
            console.error('❌ Engine-initialisering fejlede:', err);
            throw err;   // lad main.js reagere med en synlig "motoren er nede"-besked
        }
    }

    get isReady() { return this._ready; }

    // ── Beregning ─────────────────────────────────────────────────────────────

    /**
     * Oversætter AST → Python, kører det i task-scope, returnerer resultatobjekt.
     *
     * Fejltyper:
     *   Python-exceptions → fanges af run_in_task og returneres som
     *                        { type:'error', code, message } — IKKE en undtagelse her.
     *   JS/Pyodide-fejl   → kastes videre som undtagelse (ENGINE_CRASH).
     *                        main.js skal håndtere disse forskelligt fra celle-fejl.
     */
    async calculate(ast, taskId = 'default') {
        if (!this._ready) throw new Error('CASEngine er ikke initialiseret endnu.');

        const pythonCode = this.transformer.toPython(ast);

        // Python-undtagelser er allerede håndteret inde i run_in_task og
        // returneres som JSON. Det der kan kaste her er kun JS/Pyodide-fejl.
        const raw = await this.pyodide.runPythonAsync(
            `run_in_task(${JSON.stringify(taskId)}, ${JSON.stringify(pythonCode)})`
        );
        // runPythonAsync kaster selv ved JS-niveau-fejl — ingen catch her.
        // Fejlen bobler op til main.js som kan vise "motor-fejl".
        return JSON.parse(raw);
    }

    async getTaskState(taskId = 'default') {
        if (!this.pyodide) {
            throw new Error('CASEngine er ikke initialiseret.');
        }

        const raw = await this.pyodide.runPythonAsync(
            `get_task_state_json(${JSON.stringify(taskId)})`
        );

        return JSON.parse(raw);
    }

    // ── Settings-integration ──────────────────────────────────────────────────

    /**
     * Opdaterer vinkeltilstand i Python-motoren og genopbygger base_context.
     * Kaldes automatisk via settings.onChange('angleMode', ...) i main.js.
     *
     * @param {'deg'|'rad'} mode
     */
    async setAngleMode(mode) {
        if (!this._ready) return;
        if (mode !== 'deg' && mode !== 'rad') {
            console.warn(`setAngleMode: ukendt tilstand '${mode}' — ignoreret`);
            return;
        }
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
        console.log(`✓ Vinkeltilstand sat til '${mode}'`);
    }

    // ── Privat: filsystem-opsætning ───────────────────────────────────────────

    async _loadPythonPackage() {
        const FS = this.pyodide.FS;

        this._ensureDir(FS, CAS_ROOT);
        const subdirs = new Set(
            PYTHON_FILES
                .filter(f => f.includes('/'))
                .map(f => `${CAS_ROOT}/${f.split('/')[0]}`)
        );
        for (const dir of subdirs) this._ensureDir(FS, dir);

        await Promise.all(PYTHON_FILES.map(async relPath => {
            const url  = `${PYTHON_BASE}${relPath}`;
            const resp = await fetch(url);
            if (!resp.ok) throw new Error(
                `Kan ikke hente Python-fil: ${relPath} (HTTP ${resp.status}) — ` +
                `er filen committed og tilgængelig på ${url}?`
            );
            FS.writeFile(`${CAS_ROOT}/${relPath}`, await resp.text());
        }));

        await this.pyodide.runPythonAsync(`
import sys
if '${CAS_ROOT}' not in sys.path:
    sys.path.insert(0, '${CAS_ROOT}')
    
from bootstrap import run_in_task, get_task_state_json
import __main__

__main__.run_in_task = run_in_task
__main__.get_task_state_json = get_task_state_json
`);
    }

    _ensureDir(FS, path) {
        try { FS.mkdir(path); } catch (_) { /* Findes allerede */ }
    }
}
