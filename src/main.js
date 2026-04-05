/**
 * main.js - Entry point for applikationen.
 */

import { parse } from './parser.mjs';
import { Transformer } from './transformer.js';
import { CASEngine } from './cas-engine.js';

// 1. Skab maskinerne
const transformer = new Transformer();
const engine = new CASEngine(transformer);

// Hent HTML-elementer
const calculateBtn = document.getElementById('run-btn'); // Rettet til 'run-btn' jf. CSS
const mathInput = document.getElementById('cas-input');  // Rettet til 'cas-input' jf. CSS
const outputElement = document.getElementById('cas-output');

// Knappen skal være disabled indtil motoren er klar
calculateBtn.disabled = true;
calculateBtn.innerText = "Indlæser CAS...";

// 1. Initialiser motoren
engine.init().then(() => {
    calculateBtn.disabled = false;
    calculateBtn.innerText = "Beregn";
    console.log("Systemet er klar - CAS er indlæst!");
});

engine.onStatusUpdate = (msg) => {
    outputElement.innerText = msg;
};

// 2. Event listener (Flyttet op så den registreres med det samme)
if (!calculateBtn || !mathInput || !outputElement) {
    console.error("FEJL: Kunne ikke finde de nødvendige HTML-elementer!");
} else {
  calculateBtn.addEventListener('click', async (e) => {
    console.log("KNAPPEN ER TRYKKET!");
    e.preventDefault();

    // Tjek om engine overhovedet er klar
    if (!engine.pyodide) {
        outputElement.innerText = "Vent venligst... Motoren er stadig ved at varme op.";
        return;
    }

    const input = mathInput.value.trim();
    if (!input) return;

    try {
      // 1. Parse input til AST
      const ast = parse(input);
      
      // 2. Kør beregning via engine (som nu returnerer objektet)
      const result = await engine.calculate(ast);
      console.log("CAS Resultat:", result);

      // 3. Vis resultat med KaTeX
      if (result.type !== "error") {
        let displayLatex = result.latex;

        // Hvis det er en liste (f.eks. fra solve eller sort), 
        // pakker vi det ind i mængde-parenteser for et professionelt look
        if (result.type === "list") {
          displayLatex = `\\left\\{ ${result.latex} \\right\\}`;
        }

        // Render det primære resultat
        window.katex.render(displayLatex, outputElement, {
          throwOnError: false,
          displayMode: true
        });

        // Tilføj decimal-visning under det eksakte resultat (hvis togglen er tænkt ind)
        if (result.decimal) {
          const decDiv = document.createElement('div');
          decDiv.className = "decimal-output"; // Så du kan style den i CSS
          decDiv.style.fontSize = "0.85em";
          decDiv.style.color = "#666";
          decDiv.style.textAlign = "center";
          decDiv.style.marginTop = "5px";
          decDiv.innerHTML = `&asymp; ${result.decimal}`;
          outputElement.appendChild(decDiv);
        }
    } else {
      // Din eksisterende fejlhåndtering
      outputElement.innerHTML = `<span style="color:red">Fejl: ${result.message}</span>`;
    }

    } catch (err) {
      console.error("Fejl under beregning:", err);
      outputElement.innerText = "Syntaksfejl: " + err.message;
    }
  });
}