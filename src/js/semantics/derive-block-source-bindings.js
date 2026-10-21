/** P0020: source occurrence binding facts from a block analysis.
 * P0021 S93f: selected P0008 symbolic roles govern source occurrences,
 * without performing document evaluation or inventing default binders.
 */
import {resolveBlockSourceName} from './analyze-source-blocks.js';
import {findSelectedOperationSpec} from '../operations/selected-operation-catalog.js';
import {planSourceOccurrenceRoles,UnsupportedSourceOperationRole} from './plan-source-occurrence-roles.js';

function visit(node, refs, calls, bound, analysis, blockId) {
  if (!node || typeof node !== 'object') throw new TypeError('invalid expression AST');
  const nested = (child, scope=bound) => visit(child,refs,calls,scope,analysis,blockId);
  switch (node.type) {
    case 'Literal': case 'Quantity': return;
    case 'Variable': if (!bound.has(node.name)) refs.push(node.name); return;
    case 'BinaryExpression': nested(node.left); nested(node.right); return;
    case 'UnaryExpression': nested(node.argument); return;
    case 'PowerExpression': nested(node.base); nested(node.exponent); return;
    case 'Equation': nested(node.left); nested(node.right); return;
    case 'FunctionCall': {
      calls.push(node.name);
      let roles = null;
      const spec = findSelectedOperationSpec(node.name);
      // A document writer with the same callable spelling makes selection
      // ambiguous. Never introduce an operation-local binder in that case.
      if (spec && resolveBlockSourceName(analysis,blockId,node.name).kind !== 'provider-reference') {
        try {
          const candidate = planSourceOccurrenceRoles(node,spec);
          if (candidate.status === 'selected') roles = candidate;
        } catch (error) {
          if (!(error instanceof UnsupportedSourceOperationRole)) throw error;
          // Ill-formed targets or unsupported scoped signatures do NOT bind.
          // Keep ordinary reads visible so attestation can fail closed.
        }
      }
      for (let i = 0; i < node.args.length; i++) {
        const occurrence = roles?.occurrences[i];
        if (occurrence?.role === 'symbolic') continue; // local identity, not a read
        const names = occurrence?.governedBy ?? [];
        nested(node.args[i], names.length ? new Set([...bound,...names]) : bound);
      }
      return;
    }
    case 'Derivative': calls.push(node.name); for (const arg of node.args) nested(arg); return;
    case 'List': for (const item of node.elements) nested(item); return;
    case 'Vector': for (const item of node.components) nested(item); return;
    case 'Access': if (!bound.has(node.container)) refs.push(node.container); nested(node.index); return;
    case 'Conversion':
      // The grammar also admits conversion of a statement. This is not a
      // complete definition or a supported expression: preserve the source,
      // but do not invent a nested writer, lexical scope or partial reads.
      if (node.expr?.type === 'Assignment' || node.expr?.type === 'FunctionDefinition') return;
      nested(node.expr); return;
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
    const visitBody=(node,bound=new Set())=>visit(node,refs,calls,bound,analysis,entry.blockId);
    if(ast.type==='Assignment') visitBody(ast.value);
    else if(ast.type==='FunctionDefinition') visitBody(ast.body,new Set(ast.params));
    else visitBody(ast);
    const unique=[...new Set(refs)];
    const references=unique.map(name=>Object.freeze({name,
      binding:resolveBlockSourceName(analysis,entry.blockId,name)}));
    blocks.push(Object.freeze({blockId:entry.blockId, parseError:null,
      references:Object.freeze(references),
      // This is a name-level dependency projection, NOT a per-occurrence IR
      // attestation. Mixed symbolic/source-name uses require an IR contract.
      callTargets:Object.freeze([...new Set(calls)])}));
  }
  return Object.freeze({taskScopeId:analysis.taskScopeId, blocks:Object.freeze(blocks)});
}
