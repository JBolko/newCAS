/**
 * main.js - Entry point for applikationen.
 */

import { settings } from './settings.js
import { parse } from './parser.mjs'; // Peggy output
import { translateASTtoPython } from './transformer.js';
import { initCAS, calculate } from './cas-engine.js';

// Initialiser CAS når siden loader
initCAS().then(() => {
  console.log("CAS systemet er klar!");
});

async function handleCompute() {
  const input = document.getElementById('cas-input').value;
  const outputElement = document.getElementById('cas-output');
  
  try {
    // 1. Parse input til AST
    const ast = parse(input);
    
    // 2. Transformer AST til Python kode
    const pythonCode = translateASTtoPython(ast);
    console.log("Genereret Python:", pythonCode);
    
    // 3. Kør beregning i Pyodide
    const result = await calculate(pythonCode);
    
    // 4. Vis resultat
    outputElement.innerText = result;
  } catch (err) {
    outputElement.innerText = "Syntaksfejl: " + err.message;
  }
}

// Event listener til din knap
document.getElementById('run-btn').addEventListener('click', handleCompute);