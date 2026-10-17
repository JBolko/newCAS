/** P0021 Slice 93a — shared, pure arithmetic lowering for selected Semantic IR.
 * This owns only arithmetic syntax → IR composition. It NEVER resolves names,
 * chooses a backend, parses input or reads the document. The caller owns the
 * OperationSpec selection and the already-lowered operand nodes.
 */
import {expression} from '../values/value.js';
import {valueLiteral, isSemanticIRNode} from './semantic-ir.js';

const fail = message => { throw new TypeError(`P0021 arithmetic IR: ${message}`); };
const OPERATORS = Object.freeze({'+':'add','*':'multiply'});
const integer = value => valueLiteral(expression({op:'integer',value:String(value)}));

export function createSelectedArithmeticLowering(select) {
  if (typeof select !== 'function') fail('explicit selected-operation callback required');
  const checked = node => {
    if (!isSemanticIRNode(node)) fail('lowered operand must be Semantic IR');
    return node;
  };
  const selected = (operation, args) => checked(select(operation, args.map(checked)));
  const minusOne = () => integer(-1);
  const negate = node => selected('multiply',[minusOne(),node]);
  const power = (base, exponent) => selected('power',[base,exponent]);
  return Object.freeze({
    literal(value) {
      if (!Number.isSafeInteger(value) || value < 0) fail('only nonnegative safe integer literals supported');
      return integer(value);
    },
    unary(operator, getOperand) {
      // Validate BEFORE descending into untrusted AST: preserve fail-closed
      // resolution order for malformed unary operators in both callers.
      if (operator !== '-') fail(`unsupported unary operator ${String(operator)}`);
      if (typeof getOperand !== 'function') fail('unary operand supplier required');
      return negate(getOperand());
    },
    binary(operator, lhs, rhs) {
      if (operator === '-') return selected('add',[lhs,negate(rhs)]);
      if (operator === '/') return selected('multiply',[lhs,power(rhs,minusOne())]);
      const operation = OPERATORS[operator];
      if (!operation) fail(`unsupported binary operator ${String(operator)}`);
      return selected(operation,[lhs,rhs]);
    },
    power,
  });
}
