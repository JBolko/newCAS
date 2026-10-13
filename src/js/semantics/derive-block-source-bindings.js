/** P0020 Slice 3: derive source-occurrence binding facts from a block analysis.
 * No evaluator, DocumentRuntime mutation, or result availability lookup.
 * Builtin-vs-FunctionValue call-name resolution and symbolic argument policies
 * remain P0019 integration work; report call targets separately, do not guess.
 */
import { resolveBlockSourceName } from './analyze-source-blocks.js';

function visit(node, refs, calls, bound = new Set()) {
  if (!node || typeof node !== 'object') throw new TypeError('invalid expression AST');
  switch (node.type) {
    case 'Literal': case 'Quantity': return;
    case 'Variable':
      if (!bound.has(node.name)) refs.push(node.name);
      return;
    case 'BinaryExpression': visit(node.left,refs,calls,bound); visit(node.right,refs,calls,bound); return;
    case 'UnaryExpression': visit(node.argument,refs,calls,bound); return;
    case 'PowerExpression': visit(node.base,refs,calls,bound);visit(node.exponent,refs,calls,bound);return;
    case 'Equation': visit(node.left,refs,calls,bound);visit(node.right,refs,calls,bound);return;
    case 'FunctionCall':
      calls.push(node.name); for (const arg of node.args) visit(arg,refs,calls,bound);return;
    case 'Derivative':
      calls.push(node.name); for (const arg of node.args) visit(arg,refs,calls,bound);return;
    case 'List': for(const item of node.elements) visit(item,refs,calls,bound);return;
    case 'Vector': for(const item of node.components) visit(item,refs,calls,bound);return;
    case 'Access':
      if (!bound.has(node.container)) refs.push(node.container);
      visit(node.index,refs,calls,bound);return;
    case 'Conversion': visit(node.expr,refs,calls,bound);return;
    default: throw new TypeError(`unsupported AST node: ${String(node.type)}`);
  }
}

export function deriveBlockSourceBindings(analysis) {
  if (!analysis || !Array.isArray(analysis.entries) || !Array.isArray(analysis.writers))
    throw new TypeError('expected block analysis');
  const blocks=[];
  for(const entry of analysis.entries) {
    if(entry.parseError !== null) {
      blocks.push(Object.freeze({blockId:entry.blockId, parseError:entry.parseError,
        references:Object.freeze([]), callTargets:Object.freeze([])}));
      continue;
    }
    const program=entry.ast;
    if(!Array.isArray(program) || program.length !== 1)
      throw new TypeError('expected one parsed statement per formula block');
    const ast=program[0], refs=[], calls=[];
    if(ast.type==='Assignment') visit(ast.value,refs,calls);
    else if(ast.type==='FunctionDefinition') visit(ast.body,refs,calls,new Set(ast.params));
    else visit(ast,refs,calls);
    const unique=[...new Set(refs)];
    const references=unique.map(name=>Object.freeze({name,
      binding:resolveBlockSourceName(analysis,entry.blockId,name)}));
    blocks.push(Object.freeze({blockId:entry.blockId, parseError:null,
      references:Object.freeze(references),
      // No inference of built-in versus user-defined function here.
      callTargets:Object.freeze([...new Set(calls)])}));
  }
  return Object.freeze({taskScopeId:analysis.taskScopeId, blocks:Object.freeze(blocks)});
}
