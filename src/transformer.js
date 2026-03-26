/**
 * transformer.js - Konverterer AST til SymPy-kompatibel Python-kode.
 */

export function translateASTtoPython(node) {
  if (Array.isArray(node)) {
    return node.map(translateASTtoPython).join('\n');
  }

  if (!node) return "";

  const ops = { 
    '+': '+', 
    '-': '-', 
    '*': '*', 
    '/': '/', 
    '^': '**' };

  switch (node.type) {
    case 'Literal': 
      return node.value.toString();

    case 'Variable': 
      return node.name;

    case 'BinaryExpression':
      // Denne fanger +, -, * og /
      return `(${translateASTtoPython(node.left)} ${ops[node.op]} ${translateASTtoPython(node.right)})`;

    case 'PowerExpression':
      // Denne fanger ^ og oversætter til Python's **
      // Vi bruger 'base' og 'exponent', da det er det, dit AST viser
      return `(${translateASTtoPython(node.base)} ** ${translateASTtoPython(node.exponent)})`;

    case 'UnaryExpression':
      return `(-${translateASTtoPython(node.argument)})`;

    case 'Assignment': 
      return `${node.name} = ${translateASTtoPython(node.value)}`;

    case 'FunctionDefinition': 
      const params = node.params.join(', ');
      return `${node.name} = Lambda((${params}), ${translateASTtoPython(node.body)})`;

        case 'FunctionCall':
      const args = node.args.map(translateASTtoPython).join(', ');
      return `${node.name}(${args})`;

    case 'Equation':
      return `Eq(${translateASTtoPython(node.left)}, ${translateASTtoPython(node.right)})`;

    case 'Quantity':
      // Kalder en Python-hjælpefunktion 'parse_units' defineret i cas-engine.js
      return `(${node.value} * parse_units("${node.unit}"))`;

    case 'List':
      return `[${node.elements.map(translateASTtoPython).join(', ')}]`;

    case 'Vector':
      return `Matrix([[${node.components.map(translateASTtoPython).join(', ')}]])`;

    case 'Access':
      // Konverterer fra 1-baseret (elev) til 0-baseret (Python) indeks
      return `${node.container}[${translateASTtoPython(node.index)} - 1]`;

    default:
      console.warn("Ukendt AST-node:", node.type);
      return "";
  }
}