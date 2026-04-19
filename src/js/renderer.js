/**
 * renderer.js
 * Ansvarlig for at oversætte et JSON-resultatobjekt fra CAS-motoren
 * til synligt output i en celle (KaTeX + decimal).
 *
 * Holder al præsentationslogik ude af main.js, og gør det let at
 * tilføje nye result-typer (regression, hypotesetest, plot) ét sted.
 */

import { getFriendlyMessage } from './error-catalog.js';

export function renderResult(result, latexDiv, decimalDiv, settings) {
    decimalDiv.textContent = '';

    if (result.type === 'error') {
        // Her bruger vi nu vores nye modul
        latexDiv.innerHTML = `<span class="cas-error">${getFriendlyMessage(result)}</span>`;
        return;
    }

    if (result.type === 'success') {
        // Tildeling el. statement uden output — vis ingenting
        latexDiv.innerHTML = '';
        return;
    }

    // ─── LaTeX-formatering per result-type ──────────────────────────────────────

    function getDisplayLatex(result) {
        switch (result.type) {
            case 'list':
                return `\\left\\{ ${result.latex} \\right\\}`;
            case 'scalar':
            case 'regression':
            case 'hypothesis_test':
            default:
                return result.latex ?? '';
        }
    }

    // ─── Decimal-formatering ─────────────────────────────────────────────────────

    function formatDecimal(decimalStr, separator = ',') {
        if (!decimalStr) return null;
        // Erstat kun det første punktum (fx "123.456" → "123,456")
        return `≈\u2009${decimalStr.replace('.', separator)}`;
    }

    // Render LaTeX
    const displayLatex = getDisplayLatex(result);
    if (displayLatex) {
        window.katex.render(displayLatex, latexDiv, {
            throwOnError: false,
            displayMode: false,
            output: 'htmlAndMathml',  // nødvendigt for skærmlæsere
        });
    } else {
        latexDiv.innerHTML = '';
    }

    // Vis decimal kun for ikke-rent-symbolske resultater
    if (result.decimal && !result.is_symbolic) {
        const sep = settings?.user?.decimalSeparator ?? ',';
        decimalDiv.textContent = formatDecimal(result.decimal, sep);
    }
}

    /**
     * Renderer en parse-fejl (fra Peggy-parseren, ikke fra Python).
     */
    export function renderParseError(err, latexDiv, decimalDiv) {
        decimalDiv.textContent = '';
        // Vi sender selve fejlobjektet til kataloget
        latexDiv.innerHTML = `<span class="cas-error">${getFriendlyMessage(err)}</span>`;
    }