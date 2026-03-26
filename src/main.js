/**
 * main.js - Entry point for applikationen.
 */

import { parse } from './parser.mjs';
import { Transformer } from './transformer.js';
import { CASEngine } from './cas-engine.js';

// 1. Skab maskinerne
const transformer = new Transformer();
const engine = new CASEngine(transformer);

// 2. Start motoren (Top-level await)
try {
    await engine.init();
    console.log("CAS systemet er 100% klar med wrap_result!");
} catch (err) {
    console.error("CAS kunne ikke starte:", err);
}

async function handleCompute() {
  const input = document.getElementById('cas-input').value;
  const outputElement = document.getElementById('cas-output');
  
  try {
    // 1. Parse input til AST
    const ast = parse(input);
    
    // 2. Transformer AST til Python kode
    const result = await engine.calculate(ast);
    console.log("Genereret Python:", result);
    
    // 3. Kør beregning i Pyodide
    // const result = await calculate(pythonCode);
    
    // 4. Vis resultat
    if (result.type !== "error") {
        // Vi bruger KaTeX til at tegne result.latex ind i dit outputElement
        // Sørg for at outputElement er en div eller span
        katex.render(result.latex, outputElement, {
            throwOnError: false,
            displayMode: true // Dette centrerer og gør matematikken tydelig
        });

        // Valgfrit: Hvis du også vil vise decimaltallet et sted:
        // decimalElement.innerText = "≈ " + result.decimal;
        
    } else {
        outputElement.innerText = "CAS Fejl: " + result.message;
    }
}

// Event listener til din knap
document.getElementById('run-btn').addEventListener('click', handleCompute);