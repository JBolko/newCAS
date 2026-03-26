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
        window.katex.render(result.latex, outputElement, {
          throwOnError: false,
          displayMode: true
        });
        
        // Valgfrit: Hvis du har et felt til decimaltal, kan du tilføje det her
        // decimalElement.innerText = "≈ " + result.decimal;

      } else {
        outputElement.innerHTML = `<span style="color:red">Fejl: ${result.message}</span>`;
      }

    } catch (err) {
      console.error("Fejl under beregning:", err);
      outputElement.innerText = "Syntaksfejl: " + err.message;
    }
  });
}

// 3. Start motoren (Kører i baggrunden)
console.log("Starter CASEngine...");
try {
    await engine.init();
    console.log("✅ CAS systemet er 100% klar!");
    calculateBtn.disabled = false;           // Hvis du vil aktivere knappen
    calculateBtn.textContent = "Beregn";     // Hvis du vil ændre teksten
} catch (err) {
    console.error("CAS kunne ikke starte:", err);
    outputElement.innerHTML = `<span style="color:red">Fejl ved opstart af CAS: ${err.message}</span>`;
}
