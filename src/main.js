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
    outputElement.innerText = result;
  } catch (err) {
    outputElement.innerText = "Syntaksfejl: " + err.message;
  }
}

// Event listener til din knap
document.getElementById('run-btn').addEventListener('click', handleCompute);