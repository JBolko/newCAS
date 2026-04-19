/**
 * main.js
 * UI-lag: event-handling, celle-administration og opstart.
 * Al præsentationslogik er delegeret til renderer.js.
 */

import { parse }           from './parser.mjs';
import { Transformer }     from './transformer.js';
import { CASEngine }       from './cas-engine.js';
import { settings }        from './settings.js';
import { renderResult,
         renderParseError } from './renderer.js';

// ─── Initialisering ──────────────────────────────────────────────────────────

const transformer = new Transformer(settings);
const engine      = new CASEngine(transformer);
const sdot        = document.getElementById('sdot');

engine.init().then(() => {
    if (sdot) sdot.classList.add('ready');
    console.log('newCAS klar.');
}).catch(err => {
    console.error('Motor-initialisering fejlede:', err);
    if (sdot) sdot.classList.add('error');
});

// ─── Celleberegning ──────────────────────────────────────────────────────────

async function evaluateCell(cell) {
    const inputField = cell.querySelector('.math-input');
    const latexDiv   = cell.querySelector('.latex-output');
    const decimalDiv = cell.querySelector('.decimal-output');
    const input      = inputField.value.trim();

    if (!input) return;

    // Hent task-id fra den nærmeste opgaveblok (scope-isolering)
    const assignment = cell.closest('.assignment');
    const taskId     = assignment?.id ?? 'default';

    cell.classList.add('working');
    try {
        const ast    = parse(input);
        const result = await engine.calculate(ast, taskId);
        renderResult(result, latexDiv, decimalDiv, settings);
    } catch (err) {
        renderParseError(err, latexDiv, decimalDiv);
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

    const cellHtml = `
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
    `;

    container.insertAdjacentHTML('beforeend', cellHtml);
    container.lastElementChild.querySelector('.math-input').focus();
}
