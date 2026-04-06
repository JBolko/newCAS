/**
 * main.js - Opdateret til Notebook/Cell struktur
 */
import { parse } from './parser.mjs';
import { Transformer } from './transformer.js';
import { CASEngine } from './cas-engine.js';
import { settings } from './settings.js';

// 1. Initialisér maskinerne
const transformer = new Transformer();
const engine = new CASEngine(transformer);

// Vi har ikke én knap længere, så vi bruger status-dotten til feedback
const sdot = document.getElementById('sdot');

// 2. Initialisér motoren
engine.init().then(() => {
    if (sdot) sdot.classList.add('ready');
    console.log("Systemet er klar - CAS er indlæst i Notebook-mode!");
});

// 3. Event Listener: Lyt efter Enter i ALLE matematik-felter
document.addEventListener('keydown', async (e) => {
    // Tjek om det er Enter (uden Shift) og om vi er i et matematik-felt
    if (e.key === 'Enter' && !e.shiftKey && e.target.classList.contains('math-input')) {
        e.preventDefault(); // Stop linjeskift i feltet

        const inputField = e.target;
        const cell = inputField.closest('.cell');
        const input = inputField.value.trim();

        if (!input) return;

        // Find output-områderne i netop denne celle
        const latexDiv = cell.querySelector('.latex-output');
        const decimalDiv = cell.querySelector('.decimal-output');

        // Vis at vi arbejder (valgfrit - kræver CSS klasse .working)
        cell.classList.add('working');

        try {
            // A. Parse input til AST
            const ast = parse(input);
            
            // B. Kør beregning via engine
            const result = await engine.calculate(ast);
            console.log("Celle Resultat:", result);

            // C. Vis resultat med KaTeX
            if (result.type !== "error") {
                let displayLatex = result.latex;

                if (result.type === "list") {
                    displayLatex = `\\left\\{ ${result.latex} \\right\\}`;
                }

                // Render det primære resultat i denne celles latex-felt
                window.katex.render(displayLatex, latexDiv, {
                    throwOnError: false,
                    displayMode: false // false ser ofte bedre ud inde i celler
                });

                // D. Vis decimal-visning
                if (result.decimal) {
                    const sep = settings.user.decimalSeparator || ',';
                    decimalDiv.innerHTML = `&asymp; ${result.decimal.replace('.', sep)}`;
                } else {
                    decimalDiv.innerHTML = "";
                }
            } else {
                latexDiv.innerHTML = `<span style="color:var(--accent2)">Fejl: ${result.message}</span>`;
                decimalDiv.innerHTML = "";
            }

        } catch (err) {
            console.error("Fejl under beregning:", err);
            latexDiv.innerHTML = `<span style="color:var(--accent2)">Syntaksfejl: ${err.message}</span>`;
        } finally {
            cell.classList.remove('working');
        }
    }
});

// 4. Knappen "Tilføj felt" (Hvis du vil have den til at virke med det samme)
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('add-cell-btn')) {
        addNewCell();
    }
});

function addNewCell() {
    const container = document.querySelector('.cells-container');
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