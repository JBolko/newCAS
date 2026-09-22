/**
 * main.js
 * UI-koordinator: opstart, event-handling og celle-administration.
 * Al præsentationslogik er delegeret til renderer.js.
 */

import { parse }            from './parser.mjs';
import { Transformer }      from './transformer.js';
import { CASEngine }        from './cas-engine.js';
import { settings }         from './settings.js';
import { renderResult,
         renderParseError } from './renderer.js';

// ─── Opstart ──────────────────────────────────────────────────────────────────

const transformer = new Transformer(settings);
const engine      = new CASEngine(transformer);
const sdot        = document.getElementById('sdot');

engine.init()
    .then(() => {
        sdot?.classList.add('ready');

        // Kobl settings.angleMode → engine.setAngleMode.
        // Fra nu af er vinkeltilstanden altid synkroniseret: ændres settings.user.angleMode
        // via settings.set('angleMode', ...) opdateres motoren automatisk.

        settings.onChange('angleMode', mode => engine.setAngleMode(mode));
    })
    .catch(err => {
        // Motor-fejl under opstart — vis en synlig fejl i UI, ikke blot i konsollen.
        // Disse fejl er alvorlige (Pyodide/SymPy kunne ikke indlæses) og skal skilles
        // fra normale celle-fejl som eleven håndterer selv.
        sdot?.classList.add('error');
        showEngineCrash(err);
    });

// ─── Motor-fejlvisning ────────────────────────────────────────────────────────

function showEngineCrash(err) {
    const banner = document.createElement('div');
    banner.className = 'engine-crash-banner';
    banner.innerHTML = `
        <strong>Motoren kunne ikke starte.</strong>
        Genindlæs siden og prøv igen.
        <details><summary>Teknisk detalje</summary><code>${err.message}</code></details>
    `;
    document.body.prepend(banner);
    console.error('ENGINE CRASH:', err);
}

// ─── Celleberegning ──────────────────────────────────────────────────────────

async function evaluateCell(cell) {
    const inputField = cell.querySelector('.math-input');
    const latexDiv   = cell.querySelector('.latex-output');
    const decimalDiv = cell.querySelector('.decimal-output');
    const input      = inputField.value.trim();
    if (!input) return;

    const assignment = cell.closest('.assignment');
    const taskId     = assignment?.id ?? 'default';

    cell.classList.add('working');
    try {
        const ast    = parse(input);
        const result = await engine.calculate(ast, taskId);
        renderResult(result, latexDiv, decimalDiv, settings);
    } catch (err) {
        // Her skelnes mellem parse-fejl og motor-crash:
        //   Parse-fejl (Peggy SyntaxError) → vis i cellen som normal fejl
        //   JS/Pyodide-fejl (ENGINE_CRASH)  → vis global crash-banner
        if (err?.name === 'SyntaxError') {
            renderParseError(err, latexDiv, decimalDiv);
        } else {
            showEngineCrash(err);
        }
    } finally {
        cell.classList.remove('working');
    }
}

// ─── Event listeners ─────────────────────────────────────────────────────────

document.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    if (!e.target.classList.contains('math-input')) return;
    e.preventDefault();
    await evaluateCell(e.target.closest('.cell'));
});

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('add-cell-btn')) {
        addNewCell(e.target.closest('.assignment'));
    }
});

// ─── Celle-administration ────────────────────────────────────────────────────

function addNewCell(assignment) {
    const container = (assignment ?? document).querySelector('.cells-container');
    if (!container) return;

    const newId = document.querySelectorAll('.cell').length + 1;
    container.insertAdjacentHTML('beforeend', `
        <div class="cell math-cell" id="cell-${newId}">
            <div class="cell-input-wrapper">
                <span class="cell-label">In [${newId}]:</span>
                <input type="text" class="math-input" placeholder="Skriv matematik...">
            </div>
            <div class="cell-output-wrapper">
                <div class="latex-output"></div>
                <div class="decimal-output"></div>
            </div>
        </div>
    `);
    container.lastElementChild.querySelector('.math-input').focus();
}
