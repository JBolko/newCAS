/** P0021 S93b: structural Peggy expression traversal to immutable Semantic IR.
 *
 * This is a compiler-internal, policy-free traversal: no source parsing,
 * symbol lookup, operation selection, attestation, execution, or fallback.
 * Each caller retains the authority to resolve variables and function calls.
 * Context is caller-owned (e.g. a lexical binder scope), never global state.
 */
export function lowerSourceExpressionTree(root, {
  arithmetic, resolveVariable, resolveCall, reject, context = null,
} = {}) {
  if (!arithmetic || typeof arithmetic.literal !== 'function' ||
      typeof arithmetic.unary !== 'function' || typeof arithmetic.binary !== 'function' ||
      typeof arithmetic.power !== 'function' || typeof resolveVariable !== 'function' ||
      typeof resolveCall !== 'function' || typeof reject !== 'function') {
    throw new TypeError('P0021 source tree: explicit arithmetic and resolution callbacks required');
  }
  const visit = (node, scope = context) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return reject('invalid expression node');
    switch (node.type) {
      case 'Literal': return arithmetic.literal(node.value);
      case 'Variable': return resolveVariable(node, scope);
      case 'FunctionCall': return resolveCall(node, scope, visit);
      case 'UnaryExpression': return arithmetic.unary(node.op, () => visit(node.argument, scope));
      case 'BinaryExpression': return arithmetic.binary(node.op,
        visit(node.left, scope), visit(node.right, scope));
      case 'PowerExpression': return arithmetic.power(
        visit(node.base, scope), visit(node.exponent, scope));
      default: return reject(`unsupported node type ${String(node.type)}`);
    }
  };
  return visit(root);
}
